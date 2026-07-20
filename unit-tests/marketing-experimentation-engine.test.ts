import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ATTACH_DECLARATIVE_PRODUCTION_CRONS } from "../lib/trigger/scheduleActivation.ts";
import {
  applyExperimentMeasurement,
  completeExperimentMeasurement,
  explainExperiment,
  progressExperimentLifecycle,
  shouldRecordExperimentCompletionObservation,
} from "../lib/marketing-experimentation/experiment-engine.ts";
import {
  aggregateObservedOutcome,
  computeVariantComparisonOutcome,
  emptyExperimentMetrics,
  emptyExperimentOutcome,
} from "../lib/marketing-experimentation/experiment-outcomes.ts";
import {
  advanceExperimentStatus,
  canTransitionExperimentStatus,
} from "../lib/marketing-experimentation/experiment-state.ts";
import {
  getExperimentTemplate,
  isSupportedExperimentType,
  listExperimentTemplates,
  listSupportedExperimentTemplates,
  SUPPORTED_EXPERIMENT_TYPES,
} from "../lib/marketing-experimentation/experiment-templates.ts";
import {
  ExperimentStatuses,
  ExperimentTypes,
  type MarketingExperiment,
} from "../lib/marketing-experimentation/experiment-types.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function sampleExperiment(overrides: Partial<MarketingExperiment> = {}): MarketingExperiment {
  return {
    id: "exp-1",
    user_id: "user-1",
    business_profile_id: "biz-1",
    experiment_type: ExperimentTypes.POSTING_TIME,
    title: "Posting time",
    hypothesis: "Mid-week posts earn more engagement than weekend posts.",
    status: ExperimentStatuses.APPROVED,
    variants: [
      { key: "control", label: "Mid-week", description: "Publish Tuesday–Thursday mornings." },
      { key: "treatment", label: "Weekend", description: "Publish Saturday–Sunday mornings." },
    ],
    outcome: emptyExperimentOutcome("engagement"),
    metrics: emptyExperimentMetrics("engagement"),
    created_from_recommendation_id: "rec-1",
    related_campaign_id: null,
    marketing_director_decision_key: "eligibility_rule_v1|...",
    template_id: "tmpl_posting_time_v1",
    source_proposal_id: "prop-1",
    started_at: null,
    measured_at: null,
    completed_at: null,
    schema_version: 1,
    created_at: "2026-07-18T00:00:00.000Z",
    updated_at: "2026-07-18T00:00:00.000Z",
    ...overrides,
  };
}

test("ATTACH_DECLARATIVE_PRODUCTION_CRONS remains false for Experimentation Engine", () => {
  assert.equal(ATTACH_DECLARATIVE_PRODUCTION_CRONS, false);
});

test("template loading: all seven declarative experiment types are present, but only two are supported", () => {
  const templates = listExperimentTemplates();
  assert.equal(templates.length, 7);
  for (const type of Object.values(ExperimentTypes)) {
    const template = getExperimentTemplate(type);
    assert.ok(template, type);
    assert.equal(template!.variants.length, 2, type);
    assert.equal(template!.variants[0]!.key, "control");
    assert.equal(template!.variants[1]!.key, "treatment");
  }

  assert.deepEqual(SUPPORTED_EXPERIMENT_TYPES, ["posting_time", "review_request_timing"]);
  const supported = listSupportedExperimentTemplates();
  assert.equal(supported.length, 2);
  assert.ok(supported.every((t) => t.supported));

  const unsupported = templates.filter((t) => !t.supported);
  assert.equal(unsupported.length, 5);
  for (const template of unsupported) {
    assert.ok(template.deferralReason && template.deferralReason.length > 0, template.id);
  }
});

test("isSupportedExperimentType matches SUPPORTED_EXPERIMENT_TYPES exactly", () => {
  assert.equal(isSupportedExperimentType("posting_time"), true);
  assert.equal(isSupportedExperimentType("review_request_timing"), true);
  assert.equal(isSupportedExperimentType("content_format"), false);
  assert.equal(isSupportedExperimentType("not_a_real_type"), false);
});

test("lifecycle transitions are deterministic and linear", () => {
  const path = [
    ExperimentStatuses.DRAFT,
    ExperimentStatuses.PROPOSED,
    ExperimentStatuses.APPROVED,
    ExperimentStatuses.RUNNING,
    ExperimentStatuses.MEASURING,
    ExperimentStatuses.COMPLETED,
    ExperimentStatuses.ARCHIVED,
  ];
  for (let i = 0; i < path.length - 1; i++) {
    assert.equal(canTransitionExperimentStatus(path[i]!, path[i + 1]!), true);
    assert.equal(advanceExperimentStatus(path[i]!), path[i + 1]!);
  }
  assert.equal(advanceExperimentStatus(ExperimentStatuses.ARCHIVED), ExperimentStatuses.ARCHIVED);
  assert.equal(canTransitionExperimentStatus(ExperimentStatuses.DRAFT, ExperimentStatuses.RUNNING), false);
});

test("transition matrix: every status pair is exhaustively valid or invalid, no forward skips, no backward moves", () => {
  const all = Object.values(ExperimentStatuses);
  const forwardStep: Record<string, string> = {
    draft: "proposed",
    proposed: "approved",
    approved: "running",
    running: "measuring",
    measuring: "completed",
    completed: "archived",
  };

  for (const from of all) {
    for (const to of all) {
      const expected = forwardStep[from] === to;
      assert.equal(
        canTransitionExperimentStatus(from, to),
        expected,
        `${from} -> ${to} should be ${expected ? "valid" : "invalid"}`,
      );
    }
  }

  assert.equal(canTransitionExperimentStatus(ExperimentStatuses.RUNNING, ExperimentStatuses.COMPLETED), false, "measuring cannot be skipped");
  assert.equal(canTransitionExperimentStatus(ExperimentStatuses.COMPLETED, ExperimentStatuses.RUNNING), false, "completed cannot return to running");
  assert.equal(canTransitionExperimentStatus(ExperimentStatuses.ARCHIVED, ExperimentStatuses.RUNNING), false, "archived cannot be restarted");
  assert.equal(canTransitionExperimentStatus(ExperimentStatuses.ARCHIVED, ExperimentStatuses.COMPLETED), false, "archived is terminal");
  assert.equal(canTransitionExperimentStatus(ExperimentStatuses.DRAFT, ExperimentStatuses.MEASURING), false, "measuring cannot occur before running");
});

test("progressExperimentLifecycle advances status with timestamps", () => {
  const approved = sampleExperiment({ status: ExperimentStatuses.APPROVED });
  const running = progressExperimentLifecycle(approved);
  assert.equal(running.status, ExperimentStatuses.RUNNING);
  assert.ok(running.started_at);

  const measuring = progressExperimentLifecycle({ ...approved, ...running } as MarketingExperiment);
  assert.equal(measuring.status, ExperimentStatuses.MEASURING);
});

// --- Honest measurement boundary -----------------------------------------------------

test("aggregateObservedOutcome never claims a winner, never exceeds early confidence", () => {
  const outcome = aggregateObservedOutcome({
    primaryMetric: "engagement",
    aggregateValue: 500,
    measurementStart: "2026-07-01T00:00:00.000Z",
    measurementEnd: "2026-07-15T00:00:00.000Z",
  });
  assert.equal(outcome.direction, "inconclusive");
  assert.equal(outcome.winningVariantKey, null);
  assert.equal(outcome.confidenceLevel, "early");
  assert.equal(outcome.attributionAvailable, false);
  assert.equal(outcome.liftPercent, null);
});

test("aggregateObservedOutcome with a very large aggregate value still never exceeds early confidence", () => {
  // Guards the exact bug this phase fixes: magnitude of an undifferentiated aggregate
  // is not evidence of a variant difference, however large the number is.
  const outcome = aggregateObservedOutcome({
    primaryMetric: "engagement",
    aggregateValue: 1_000_000,
    measurementStart: "2026-07-01T00:00:00.000Z",
    measurementEnd: "2026-07-15T00:00:00.000Z",
  });
  assert.equal(outcome.confidenceLevel, "early");
  assert.equal(outcome.direction, "inconclusive");
});

test("aggregateObservedOutcome with zero aggregate value is still honest, not an error", () => {
  const outcome = aggregateObservedOutcome({
    primaryMetric: "engagement",
    aggregateValue: 0,
    measurementStart: "2026-07-01T00:00:00.000Z",
    measurementEnd: "2026-07-15T00:00:00.000Z",
  });
  assert.equal(outcome.direction, "inconclusive");
  assert.equal(outcome.winningVariantKey, null);
});

test("aggregateObservedOutcome with missing analytics reports insufficient data, not inconclusive", () => {
  const outcome = aggregateObservedOutcome({
    primaryMetric: "engagement",
    aggregateValue: null,
    measurementStart: "2026-07-01T00:00:00.000Z",
    measurementEnd: "2026-07-15T00:00:00.000Z",
  });
  assert.equal(outcome.direction, "insufficient_data");
  assert.equal(outcome.confidenceLevel, "insufficient");
  assert.equal(outcome.winningVariantKey, null);
});

test("aggregateObservedOutcome is deterministic: identical inputs produce identical outcomes", () => {
  const input = {
    primaryMetric: "engagement" as const,
    aggregateValue: 123,
    measurementStart: "2026-07-01T00:00:00.000Z",
    measurementEnd: "2026-07-15T00:00:00.000Z",
  };
  assert.deepEqual(aggregateObservedOutcome(input), aggregateObservedOutcome(input));
});

test("applyExperimentMeasurement never fabricates a winner from an aggregate measurement", () => {
  const experiment = sampleExperiment({ status: ExperimentStatuses.RUNNING });
  const measured = applyExperimentMeasurement(experiment, {
    aggregateValue: 5000,
    measurementStart: "2026-07-01T00:00:00.000Z",
    measurementEnd: "2026-07-15T00:00:00.000Z",
  });
  assert.equal(measured.status, ExperimentStatuses.MEASURING);
  assert.equal(measured.outcome.winningVariantKey, null);
  assert.equal(measured.outcome.attributionAvailable, false);
  assert.equal(measured.metrics.aggregateValue, 5000);
});

test("applyExperimentMeasurement refuses to measure a draft/approved experiment", () => {
  const approved = sampleExperiment({ status: ExperimentStatuses.APPROVED });
  const result = applyExperimentMeasurement(approved, {
    aggregateValue: 80,
    measurementStart: "2026-07-01T00:00:00.000Z",
    measurementEnd: "2026-07-15T00:00:00.000Z",
  });
  assert.equal(result.status, ExperimentStatuses.APPROVED);
  assert.deepEqual(result.metrics, approved.metrics);
});

test("applyExperimentMeasurement refuses to silently overwrite a completed experiment's outcome", () => {
  const completed = sampleExperiment({
    status: ExperimentStatuses.COMPLETED,
    outcome: { ...emptyExperimentOutcome("engagement"), summary: "already recorded" },
  });
  const result = applyExperimentMeasurement(completed, {
    aggregateValue: 1,
    measurementStart: "2026-07-01T00:00:00.000Z",
    measurementEnd: "2026-07-15T00:00:00.000Z",
  });
  assert.equal(result.status, ExperimentStatuses.COMPLETED);
  assert.equal(result.outcome.summary, "already recorded");
});

test("computeVariantComparisonOutcome (future attribution engine, not used by current measurement) still handles ties/zero/divide-by-zero correctly", () => {
  const variants = [
    { key: "control", label: "Control", description: "" },
    { key: "treatment", label: "Treatment", description: "" },
  ];

  const tie = computeVariantComparisonOutcome({
    perVariantMetrics: { ...zeroPair(), engagementA: 50, engagementB: 50 },
    variants,
    primaryMetric: "engagement",
  });
  assert.equal(tie.direction, "inconclusive");
  assert.equal(tie.winningVariantKey, null);

  const zeroBaseline = computeVariantComparisonOutcome({
    perVariantMetrics: zeroPair(),
    variants,
    primaryMetric: "engagement",
  });
  assert.equal(zeroBaseline.direction, "insufficient_data");
  assert.equal(zeroBaseline.liftPercent, null);

  const controlWins = computeVariantComparisonOutcome({
    perVariantMetrics: { ...zeroPair(), engagementA: 500, engagementB: 100 },
    variants,
    primaryMetric: "engagement",
  });
  assert.equal(controlWins.winningVariantKey, "control");
  assert.ok(controlWins.liftPercent !== null && controlWins.liftPercent > 0);

  const treatmentWins = computeVariantComparisonOutcome({
    perVariantMetrics: { ...zeroPair(), engagementA: 100, engagementB: 500 },
    variants,
    primaryMetric: "engagement",
  });
  assert.equal(treatmentWins.winningVariantKey, "treatment");
});

function zeroPair() {
  return {
    engagementA: 0,
    engagementB: 0,
    clicksA: 0,
    clicksB: 0,
    reviewsA: 0,
    reviewsB: 0,
    reachA: 0,
    reachB: 0,
    conversionsA: 0,
    conversionsB: 0,
    publishingConsistencyA: 0,
    publishingConsistencyB: 0,
  };
}

test("completeExperimentMeasurement and observation gate", () => {
  const measuring = sampleExperiment({ status: ExperimentStatuses.MEASURING });
  const completed = completeExperimentMeasurement(measuring);
  assert.equal(completed.status, ExperimentStatuses.COMPLETED);
  assert.ok(completed.completed_at);
  assert.equal(
    shouldRecordExperimentCompletionObservation(ExperimentStatuses.MEASURING, ExperimentStatuses.COMPLETED),
    true,
  );
  assert.equal(
    shouldRecordExperimentCompletionObservation(ExperimentStatuses.COMPLETED, ExperimentStatuses.COMPLETED),
    false,
  );
});

test("completeExperimentMeasurement refuses to skip measuring", () => {
  const running = sampleExperiment({ status: ExperimentStatuses.RUNNING });
  const result = completeExperimentMeasurement(running);
  assert.equal(result.status, ExperimentStatuses.RUNNING);
  assert.equal(result.completed_at, null);
});

test("completeExperimentMeasurement refuses to re-complete an archived experiment", () => {
  const archived = sampleExperiment({ status: ExperimentStatuses.ARCHIVED });
  const result = completeExperimentMeasurement(archived);
  assert.equal(result.status, ExperimentStatuses.ARCHIVED);
});

test("explainExperiment is human-readable, includes status, and never claims confidence above early without attribution", () => {
  const experiment = sampleExperiment({
    status: ExperimentStatuses.COMPLETED,
    outcome: aggregateObservedOutcome({
      primaryMetric: "engagement",
      aggregateValue: 900,
      measurementStart: "2026-07-01T00:00:00.000Z",
      measurementEnd: "2026-07-15T00:00:00.000Z",
    }),
  });
  const text = explainExperiment(experiment);
  assert.match(text, /Posting time/);
  assert.match(text, /completed/i);
  assert.match(text, /Confidence: early/i);
  assert.doesNotMatch(text, /moderate|strong/i);
});

test("regression: Marketing Director / campaigns / publishing modules unchanged by experimentation templates", () => {
  const templates = readFileSync(
    join(root, "lib/marketing-experimentation/experiment-templates.ts"),
    "utf8",
  );
  assert.ok(!/openai|generateRecommendation|publishContent/i.test(templates));

  const md = readFileSync(join(root, "lib/marketing-director/resolveDecision.ts"), "utf8");
  assert.ok(md.includes("resolveMarketingDirectorDecision"));
});

test("migration 028: RLS is enabled, no delete policy, and a status-transition mutation guard trigger exists", () => {
  const migration = readFileSync(
    join(root, "supabase/migrations/028_marketing_experimentation.sql"),
    "utf8",
  );
  assert.match(migration, /alter table public\.marketing_experiments enable row level security/);
  assert.doesNotMatch(migration, /for delete\s*\n\s*on public\.marketing_experiments/i);
  assert.match(migration, /enforce_marketing_experiment_transition/);
  assert.match(migration, /marketing_experiments_guard_transition/);
  assert.match(migration, /before update on public\.marketing_experiments/);
});

test("migration 029: proposals RLS has no insert policy for authenticated, and the proposal-required insert guard trigger exists", () => {
  const migration = readFileSync(
    join(root, "supabase/migrations/029_marketing_experiment_proposals.sql"),
    "utf8",
  );
  assert.match(migration, /alter table public\.marketing_experiment_proposals enable row level security/);
  assert.doesNotMatch(migration, /for insert\s*\n\s*on public\.marketing_experiment_proposals/i);
  assert.match(migration, /enforce_marketing_experiment_proposal_mutation/);
  assert.match(migration, /enforce_marketing_experiment_requires_approved_proposal/);
  assert.match(migration, /before insert on public\.marketing_experiments/);
  assert.match(migration, /source_proposal_id/);
});

test("admin trigger route for proposal evaluation is gated by requireAdminUser and uses the service-role client", () => {
  const route = readFileSync(
    join(root, "app/api/admin/trigger-experiment-proposal-evaluation/route.ts"),
    "utf8",
  );
  assert.match(route, /requireAdminUser/);
  assert.match(route, /createServiceRoleClient/);
});

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
  computeExperimentOutcome,
  emptyExperimentMetrics,
  metricsFromAnalyticsPair,
} from "../lib/marketing-experimentation/experiment-outcomes.ts";
import { planExperimentFromDirector } from "../lib/marketing-experimentation/experiment-planner.ts";
import { parseProposeExperimentRequestBody } from "../lib/marketing-experimentation/experiment-request.ts";
import {
  advanceExperimentStatus,
  canTransitionExperimentStatus,
} from "../lib/marketing-experimentation/experiment-state.ts";
import {
  getExperimentTemplate,
  listExperimentTemplates,
} from "../lib/marketing-experimentation/experiment-templates.ts";
import {
  ExperimentStatuses,
  ExperimentTypes,
  type MarketingExperiment,
} from "../lib/marketing-experimentation/experiment-types.ts";
import { buildExperimentProposalFromDirectorDecision } from "../lib/marketing-director/experimentProposal.ts";
import { resolveMarketingDirectorDecision } from "../lib/marketing-director/resolveDecision.ts";
import type { MarketingDirectorInput } from "../lib/marketing-director/types.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const NOW = new Date("2026-07-18T14:00:00.000Z");
const emptyWins = { reviews: 0, views: 0, calls: 0, clicks: 0, posts: 0, tasksCompleted: 0 };

function mdInput(overrides: Partial<MarketingDirectorInput> = {}): MarketingDirectorInput {
  return {
    gbpConnected: true,
    pendingApprovals: 0,
    unansweredReviews: 0,
    openRecommendations: 0,
    publishingReadyOrScheduled: 0,
    healthState: "healthy",
    weeklyWins: emptyWins,
    seasonalHint: null,
    focusTheme: "improving local visibility",
    isEarlyCustomer: false,
    candidateRecommendations: [],
    topRecommendationDetail: null,
    memoryEvidence: null,
    ...overrides,
  };
}

function sampleExperiment(overrides: Partial<MarketingExperiment> = {}): MarketingExperiment {
  const draft = planExperimentFromDirector({
    experimentType: ExperimentTypes.POSTING_TIME,
    createdFromRecommendationId: "rec-1",
    marketingDirectorDecisionKey: "md|test",
    proposedBy: "marketing_director",
  });
  return {
    id: "exp-1",
    user_id: "user-1",
    business_profile_id: "biz-1",
    ...draft,
    created_at: "2026-07-18T00:00:00.000Z",
    updated_at: "2026-07-18T00:00:00.000Z",
    ...overrides,
  };
}

test("ATTACH_DECLARATIVE_PRODUCTION_CRONS remains false for Experimentation Engine", () => {
  assert.equal(ATTACH_DECLARATIVE_PRODUCTION_CRONS, false);
});

test("template loading: all seven declarative experiment types are present", () => {
  const templates = listExperimentTemplates();
  assert.equal(templates.length, 7);
  for (const type of Object.values(ExperimentTypes)) {
    const template = getExperimentTemplate(type);
    assert.ok(template, type);
    assert.equal(template!.variants.length, 2, type);
  }
});

test("experiment creation: Marketing Director gate required", () => {
  assert.throws(
    () =>
      planExperimentFromDirector({
        experimentType: ExperimentTypes.CTA_VARIATION,
        createdFromRecommendationId: "rec-1",
        marketingDirectorDecisionKey: "x",
        proposedBy: "experiment_engine",
      } as never),
    /Marketing Director/,
  );

  const parsed = parseProposeExperimentRequestBody({
    experimentType: ExperimentTypes.CTA_VARIATION,
    createdFromRecommendationId: "rec-1",
    marketingDirectorDecisionKey: "key",
    proposedBy: "someone_else",
  });
  assert.equal(parsed.ok, false);
});

test("experiment creation: recommendation linkage required", () => {
  assert.throws(
    () =>
      planExperimentFromDirector({
        experimentType: ExperimentTypes.CONTENT_FORMAT,
        createdFromRecommendationId: "   ",
        marketingDirectorDecisionKey: "key",
        proposedBy: "marketing_director",
      }),
    /createdFromRecommendationId/,
  );

  const parsed = parseProposeExperimentRequestBody({
    experimentType: ExperimentTypes.CONTENT_FORMAT,
    marketingDirectorDecisionKey: "key",
    proposedBy: "marketing_director",
  });
  assert.equal(parsed.ok, false);
});

test("identical inputs produce identical experiment plans and outcomes", () => {
  const input = {
    experimentType: ExperimentTypes.MESSAGING_STYLE,
    createdFromRecommendationId: "rec-abc",
    marketingDirectorDecisionKey: "decision|abc",
    relatedCampaignId: "camp-1",
    proposedBy: "marketing_director" as const,
  };
  assert.deepEqual(planExperimentFromDirector(input), planExperimentFromDirector(input));

  const metrics = metricsFromAnalyticsPair({
    variantA: {
      engagement: 40,
      clicks: 20,
      reviews: 4,
      reach: 100,
      conversions: 6,
      publishingConsistency: 3,
    },
    variantB: {
      engagement: 20,
      clicks: 10,
      reviews: 2,
      reach: 50,
      conversions: 3,
      publishingConsistency: 2,
    },
  });
  const variants = planExperimentFromDirector(input).variants;
  assert.deepEqual(
    computeExperimentOutcome({ metrics, variants, primaryMetric: "engagement" }),
    computeExperimentOutcome({ metrics, variants, primaryMetric: "engagement" }),
  );
});

test("Marketing Director handoff helper builds valid proposal", () => {
  const decision = resolveMarketingDirectorDecision(mdInput(), NOW);
  const proposal = buildExperimentProposalFromDirectorDecision(decision, {
    experimentType: ExperimentTypes.REVIEW_REQUEST_TIMING,
    createdFromRecommendationId: "rec-9",
    relatedCampaignId: null,
  });
  assert.equal(proposal.proposedBy, "marketing_director");
  assert.ok(proposal.marketingDirectorDecisionKey.includes(decision.decisionType));
  const plan = planExperimentFromDirector(proposal);
  assert.equal(plan.experiment_type, ExperimentTypes.REVIEW_REQUEST_TIMING);
  assert.equal(plan.status, ExperimentStatuses.DRAFT);
  assert.equal(plan.created_from_recommendation_id, "rec-9");
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

test("progressExperimentLifecycle advances status with timestamps", () => {
  const approved = sampleExperiment({ status: ExperimentStatuses.APPROVED });
  const running = progressExperimentLifecycle(approved);
  assert.equal(running.status, ExperimentStatuses.RUNNING);
  assert.ok(running.started_at);

  const measuring = progressExperimentLifecycle({
    ...approved,
    ...running,
  } as MarketingExperiment);
  assert.equal(measuring.status, ExperimentStatuses.MEASURING);
});

test("deterministic outcome calculation prefers stronger primary metric", () => {
  const experiment = sampleExperiment({ status: ExperimentStatuses.RUNNING });
  const metrics = {
    ...emptyExperimentMetrics(),
    engagementA: 80,
    engagementB: 20,
  };
  const measured = applyExperimentMeasurement(experiment, metrics);
  assert.equal(measured.status, ExperimentStatuses.MEASURING);
  assert.equal(measured.outcome.winningVariantKey, "a");
  assert.match(measured.outcome.summary, /outperformed/);
});

test("completeExperimentMeasurement and observation gate", () => {
  const measuring = sampleExperiment({ status: ExperimentStatuses.MEASURING });
  const completed = completeExperimentMeasurement(measuring);
  assert.equal(completed.status, ExperimentStatuses.COMPLETED);
  assert.ok(completed.completed_at);
  assert.equal(
    shouldRecordExperimentCompletionObservation(
      ExperimentStatuses.MEASURING,
      ExperimentStatuses.COMPLETED,
    ),
    true,
  );
  assert.equal(
    shouldRecordExperimentCompletionObservation(
      ExperimentStatuses.COMPLETED,
      ExperimentStatuses.COMPLETED,
    ),
    false,
  );
});

test("explainExperiment is human-readable and includes status", () => {
  const experiment = sampleExperiment({
    status: ExperimentStatuses.COMPLETED,
    outcome: {
      direction: "variant_a",
      confidenceLevel: "moderate",
      winningVariantKey: "a",
      summary: "Mid-week outperformed Weekend on engagement.",
      primaryMetric: "engagement",
      liftPercent: 40,
    },
  });
  const text = explainExperiment(experiment);
  assert.match(text, /Posting time/);
  assert.match(text, /completed/i);
  assert.match(text, /Confidence/i);
});

test("campaign linkage is preserved on plan", () => {
  const plan = planExperimentFromDirector({
    experimentType: ExperimentTypes.CAMPAIGN_SEQUENCING,
    createdFromRecommendationId: "rec-2",
    marketingDirectorDecisionKey: "md|camp",
    relatedCampaignId: "camp-99",
    proposedBy: "marketing_director",
  });
  assert.equal(plan.related_campaign_id, "camp-99");
  assert.equal(plan.created_from_recommendation_id, "rec-2");
});

test("regression: Marketing Director / campaigns / publishing modules unchanged by experimentation templates", () => {
  const templates = readFileSync(
    join(root, "lib/marketing-experimentation/experiment-templates.ts"),
    "utf8",
  );
  assert.ok(!/openai|generateRecommendation|publishContent/i.test(templates));

  const md = readFileSync(join(root, "lib/marketing-director/resolveDecision.ts"), "utf8");
  assert.ok(md.includes("resolveMarketingDirectorDecision"));
  assert.ok(!md.includes("planExperimentFromDirector"));
});

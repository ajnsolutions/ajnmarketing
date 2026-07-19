import test from "node:test";
import assert from "node:assert/strict";
import { evaluateLearningsForBusiness } from "../lib/marketing-memory/learningService.ts";
import { createFakeSupabaseClient } from "./support/fake-supabase-client.ts";

const USER = "user-1";
const BIZ = "biz-1";

function performanceObservationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: `obs-${Math.random().toString(36).slice(2)}`,
    occurred_at: "2026-06-04T09:00:00Z",
    metric_summary: { performanceScore: 90 },
    context_snapshot_id: "ctx-1",
    ...overrides,
  };
}

function existingLearningRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "learning-1",
    user_id: USER,
    business_profile_id: BIZ,
    learning_family: "timing_performance",
    time_dimension: "day_of_week",
    subject_key: "thursday",
    metric_key: "performance_score",
    direction: "positive",
    status: "active",
    confidence_level: "developing_pattern",
    confidence_components: {},
    sample_size: 5,
    supporting_count: 4,
    contradicting_count: 1,
    neutral_count: 0,
    excluded_count: 0,
    effect_size: 0.2,
    comparison_baseline: "trailing rolling average",
    baseline_value: 50,
    cohort_value: 60,
    first_observed_at: "2026-05-01T00:00:00Z",
    last_observed_at: "2026-06-01T00:00:00Z",
    evaluation_window_days: 180,
    recurrence_pattern: "recurring_weekly",
    seasonal_recurrence_count: 0,
    confounder_codes: [],
    summary: "existing summary",
    internal_rationale: "existing rationale",
    learning_key: `${BIZ}:timing_performance:day_of_week:thursday:performance_score`,
    superseded_by_learning_id: null,
    schema_version: 1,
    evaluated_at: "2026-06-01T00:00:00Z",
    created_at: "2026-05-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    ...overrides,
  };
}

/** A cohort of performance_measured observations that reliably produces exactly one
 * directional (Thursday, positive) timing_performance learning: Thursdays consistently
 * high, Mondays consistently low. market_context_items / evidence_links are configured
 * so the recommendation_action_outcome family finds nothing to evaluate, keeping this
 * fixture focused on a single learning. */
function baseTables(learningsFixture: Parameters<typeof createFakeSupabaseClient>[0]["marketing_memory_learnings"]) {
  return {
    marketing_memory_observations: {
      data: [
        performanceObservationRow({ id: "thu-1" }),
        performanceObservationRow({ id: "thu-2" }),
        performanceObservationRow({ id: "thu-3" }),
        performanceObservationRow({ id: "mon-1", metric_summary: { performanceScore: 10 }, context_snapshot_id: "ctx-2" }),
        performanceObservationRow({ id: "mon-2", metric_summary: { performanceScore: 12 }, context_snapshot_id: "ctx-2" }),
        performanceObservationRow({ id: "mon-3", metric_summary: { performanceScore: 8 }, context_snapshot_id: "ctx-2" }),
      ],
      error: null,
    },
    marketing_memory_context_snapshots: {
      data: [
        { id: "ctx-1", context_summary: { dayOfWeek: "thursday", month: 6, season: "summer" } },
        { id: "ctx-2", context_summary: { dayOfWeek: "monday", month: 6, season: "summer" } },
      ],
      error: null,
    },
    // Empty -> fetchActionOutcomeEvidenceRows resolves no action type for any
    // observation, so the recommendation_action_outcome family contributes nothing.
    marketing_memory_evidence_links: { data: [], error: null },
    marketing_recommendations: { data: [], error: null },
    marketing_memory_learnings: learningsFixture,
  };
}

test("evaluateLearningsForBusiness: creates a new learning when none exists yet for its learning_key", async () => {
  const { client, calls } = createFakeSupabaseClient(
    baseTables((op: string) => {
      if (op === "maybeSingle") return { data: null, error: null }; // no existing row
      if (op === "single") return { data: { id: "new-learning-1", status: "active", direction: "positive", confidence_components: {} }, error: null };
      return { data: null, error: null };
    })
  );

  const summary = await evaluateLearningsForBusiness(client, USER, BIZ, new Date("2026-06-15T00:00:00Z"));

  assert.ok(summary.cohortsEvaluated >= 1);
  assert.ok(summary.learningsCreated >= 1);
  assert.equal(summary.learningsSuperseded, 0);

  const insertCall = calls.find((c) => c.table === "marketing_memory_learnings" && c.op === "insert");
  assert.ok(insertCall);
});

test("evaluateLearningsForBusiness: repeated evaluation of unchanged evidence is idempotent — updates in place, never duplicates", async () => {
  // The fake client's canned responses can't discriminate by query arguments, so every
  // cohort's getLiveLearningByKey lookup receives the same canned "existing row" here
  // regardless of its real learning_key -- unlike a real database, which would only
  // match the one row whose learning_key truly equals the query. This test therefore
  // asserts specifically about the day_of_week/thursday cohort (the one whose direction
  // genuinely matches the canned existing row's direction), rather than asserting zero
  // inserts across every cohort in the fixture.
  const thursdayKey = `${BIZ}:timing_performance:day_of_week:thursday:performance_score`;

  const { client, calls } = createFakeSupabaseClient(
    baseTables((op: string) => {
      if (op === "maybeSingle") return { data: existingLearningRow(), error: null };
      return { data: null, error: null };
    })
  );

  const summary = await evaluateLearningsForBusiness(client, USER, BIZ, new Date("2026-06-15T00:00:00Z"));

  assert.ok(summary.learningsUpdated >= 1);

  const insertsForThursday = calls.filter((c) => {
    if (c.table !== "marketing_memory_learnings" || c.op !== "insert") return false;
    const [payload] = c.args as [Record<string, unknown>];
    return payload.learning_key === thursdayKey;
  });
  assert.equal(insertsForThursday.length, 0, "an unchanged-direction re-evaluation must never insert a new row for that cohort");

  const updatesForThursday = calls.filter((c) => {
    if (c.table !== "marketing_memory_learnings" || c.op !== "update") return false;
    const [payload] = c.args as [Record<string, unknown>];
    return payload.status !== "superseded"; // the update call this cohort should make, not a supersede of some other cohort
  });
  assert.ok(updatesForThursday.length >= 1);
});

test("evaluateLearningsForBusiness: a genuine direction flip supersedes the old learning and creates a new one", async () => {
  const { client, calls } = createFakeSupabaseClient(
    baseTables((op: string) => {
      // Existing row claims NEGATIVE; fresh evidence (Thursdays high, Mondays low)
      // clearly produces POSITIVE -- a real reversal.
      if (op === "maybeSingle") return { data: existingLearningRow({ direction: "negative" }), error: null };
      if (op === "single") return { data: { id: "new-learning-2", status: "active", direction: "positive", confidence_components: {} }, error: null };
      return { data: null, error: null };
    })
  );

  const summary = await evaluateLearningsForBusiness(client, USER, BIZ, new Date("2026-06-15T00:00:00Z"));

  assert.ok(summary.learningsSuperseded >= 1);

  const updateCalls = calls.filter((c) => c.table === "marketing_memory_learnings" && c.op === "update");
  const supersedeCall = updateCalls.find((c) => {
    const [payload] = c.args as [Record<string, unknown>];
    return payload.status === "superseded";
  });
  assert.ok(supersedeCall, "expected an update marking the old learning as superseded");
  const [payload] = supersedeCall!.args as [Record<string, unknown>];
  assert.equal(payload.superseded_by_learning_id, "new-learning-2");
});

test("evaluateLearningsForBusiness: never throws even when every marketing_memory_learnings write fails", async () => {
  const { client } = createFakeSupabaseClient(
    baseTables((op: string) => {
      if (op === "maybeSingle") return { data: null, error: null };
      if (op === "single") return { data: null, error: { code: "42P01", message: "relation missing" } };
      return { data: null, error: { code: "42P01", message: "relation missing" } };
    })
  );

  const summary = await evaluateLearningsForBusiness(client, USER, BIZ, new Date("2026-06-15T00:00:00Z"));
  assert.ok(summary.learningsSkipped >= 1);
  assert.equal(summary.learningsCreated, 0);
});

test("evaluateLearningsForBusiness: total fetch failure (no observation data at all) returns a zeroed summary, never throws", async () => {
  const { client } = createFakeSupabaseClient({
    marketing_memory_observations: { data: null, error: { message: "unreachable" } },
    marketing_memory_context_snapshots: { data: null, error: { message: "unreachable" } },
    marketing_memory_evidence_links: { data: null, error: { message: "unreachable" } },
    marketing_recommendations: { data: null, error: { message: "unreachable" } },
  });

  const summary = await evaluateLearningsForBusiness(client, USER, BIZ, new Date("2026-06-15T00:00:00Z"));
  assert.equal(summary.cohortsEvaluated, 0);
  assert.equal(summary.learningsCreated, 0);
});

test("evaluateLearningsForBusiness: bounded evaluation window is respected (no unbounded historical scan)", async () => {
  const { client, calls } = createFakeSupabaseClient(
    baseTables((op: string) => (op === "maybeSingle" ? { data: null, error: null } : { data: { id: "x", status: "active", direction: "positive", confidence_components: {} }, error: null }))
  );

  await evaluateLearningsForBusiness(client, USER, BIZ, new Date("2026-06-15T00:00:00Z"));

  const gteCall = calls.find((c) => c.table === "marketing_memory_observations" && c.op === "gte");
  assert.ok(gteCall);
  assert.equal(gteCall!.args[0], "occurred_at");

  const limitCall = calls.find((c) => c.table === "marketing_memory_observations" && c.op === "limit");
  assert.ok(limitCall);
});

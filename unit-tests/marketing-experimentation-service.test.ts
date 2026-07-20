import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceExperimentForUser,
  completeExperimentForUser,
  getExperimentDashboardForBusiness,
  measureExperimentForUser,
} from "../lib/marketing-experimentation/experiment-service.ts";
import { toExperimentDashboardCard } from "../lib/marketing-experimentation/experiment-dashboard.ts";
import { emptyExperimentMetrics, emptyExperimentOutcome } from "../lib/marketing-experimentation/experiment-outcomes.ts";
import { ExperimentStatuses, ExperimentTypes } from "../lib/marketing-experimentation/experiment-types.ts";
import { createFakeSupabaseClient, userIdsQueried } from "./support/fake-supabase-client.ts";

const USER = "user-1";
const OTHER = "user-2";
const BIZ = "biz-1";
const REC = "rec-1";

function experimentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "exp-1",
    user_id: USER,
    business_profile_id: BIZ,
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
    created_from_recommendation_id: REC,
    related_campaign_id: null,
    marketing_director_decision_key: "eligibility_rule_v1|x",
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

function snapshotRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "snap-1",
    user_id: USER,
    business_profile_id: BIZ,
    snapshot_date: "2026-07-18",
    google_views: 100,
    searches: 10,
    calls: 4,
    direction_requests: 2,
    website_clicks: 20,
    review_count: 6,
    average_rating: 4.5,
    posts_published: 4,
    engagement_score: 50,
    metadata: {},
    created_at: "2026-07-18T00:00:00.000Z",
    ...overrides,
  };
}

test("cross-tenant isolation: lookups filter by caller user_id and 404 when missing", async () => {
  const { client, calls } = createFakeSupabaseClient({
    marketing_experiments: { data: null, error: null },
  });

  const missing = await advanceExperimentForUser(OTHER, "exp-1", { supabaseClient: client });
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.status, 404);
  assert.deepEqual(userIdsQueried(calls), [OTHER]);
});

test("advanceExperimentForUser progresses lifecycle", async () => {
  const approved = experimentRow({ status: ExperimentStatuses.APPROVED });
  const running = { ...approved, status: ExperimentStatuses.RUNNING };
  const { client } = createFakeSupabaseClient({
    marketing_experiments: (op) => {
      if (op === "maybeSingle") return { data: approved, error: null };
      if (op === "single") return { data: running, error: null };
      return { data: approved, error: null };
    },
  });

  const result = await advanceExperimentForUser(USER, "exp-1", { supabaseClient: client });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.experiment.status, ExperimentStatuses.RUNNING);
});

test("measureExperimentForUser reports an honest aggregate, never a fabricated winner", async () => {
  const running = experimentRow({ status: ExperimentStatuses.RUNNING, started_at: "2026-07-01T00:00:00.000Z" });
  const measured = {
    ...running,
    status: ExperimentStatuses.MEASURING,
    metrics: { primaryMetric: "engagement", aggregateValue: 150, measurementStart: "2026-07-01T00:00:00.000Z", measurementEnd: "2026-07-18T00:00:00.000Z" },
  };
  const { client } = createFakeSupabaseClient({
    marketing_experiments: (op) => {
      if (op === "maybeSingle") return { data: running, error: null };
      return { data: measured, error: null };
    },
  });

  const result = await measureExperimentForUser(USER, "exp-1", {
    supabaseClient: client,
    loadAnalyticsHistory: async () => [
      snapshotRow({ snapshot_date: "2026-07-05", engagement_score: 50 }),
      snapshotRow({ snapshot_date: "2026-07-12", engagement_score: 100 }),
    ],
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.experiment.outcome.winningVariantKey, null);
    assert.equal(result.experiment.outcome.attributionAvailable, false);
  }
});

test("measureExperimentForUser sums the primary KPI across snapshots within the measurement window", async () => {
  const running = experimentRow({ status: ExperimentStatuses.RUNNING, started_at: "2026-07-01T00:00:00.000Z" });
  const { client, calls } = createFakeSupabaseClient({
    marketing_experiments: (op) => {
      if (op === "maybeSingle") return { data: running, error: null };
      return { data: { ...running, status: ExperimentStatuses.MEASURING }, error: null };
    },
  });

  await measureExperimentForUser(USER, "exp-1", {
    supabaseClient: client,
    loadAnalyticsHistory: async () => [
      snapshotRow({ snapshot_date: "2026-06-15", engagement_score: 999 }), // before window — excluded
      snapshotRow({ snapshot_date: "2026-07-05", engagement_score: 50 }),
      snapshotRow({ snapshot_date: "2026-07-12", engagement_score: 100 }),
    ],
  });

  const update = calls.find((call) => call.table === "marketing_experiments" && call.op === "update");
  assert.ok(update, "expected an update() call against marketing_experiments");
  const fields = update!.args[0] as { metrics: { aggregateValue: number | null } };
  assert.equal(fields.metrics.aggregateValue, 150);
});

test("measureExperimentForUser handles missing analytics as insufficient data, not zero", async () => {
  const running = experimentRow({ status: ExperimentStatuses.RUNNING, started_at: "2026-07-01T00:00:00.000Z" });
  const { client, calls } = createFakeSupabaseClient({
    marketing_experiments: (op) => {
      if (op === "maybeSingle") return { data: running, error: null };
      return { data: { ...running, status: ExperimentStatuses.MEASURING }, error: null };
    },
  });

  await measureExperimentForUser(USER, "exp-1", {
    supabaseClient: client,
    loadAnalyticsHistory: async () => [],
  });

  const update = calls.find((call) => call.table === "marketing_experiments" && call.op === "update");
  const fields = update!.args[0] as { metrics: { aggregateValue: number | null }; outcome: { direction: string } };
  assert.equal(fields.metrics.aggregateValue, null);
  assert.equal(fields.outcome.direction, "insufficient_data");
});

test("measureExperimentForUser rejects measuring an approved (not yet running) experiment", async () => {
  const approved = experimentRow({ status: ExperimentStatuses.APPROVED });
  const { client } = createFakeSupabaseClient({
    marketing_experiments: { data: approved, error: null },
  });

  const result = await measureExperimentForUser(USER, "exp-1", {
    supabaseClient: client,
    loadAnalyticsHistory: async () => [],
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 409);
});

test("measureExperimentForUser rejects re-measuring a completed experiment", async () => {
  const completed = experimentRow({ status: ExperimentStatuses.COMPLETED });
  const { client } = createFakeSupabaseClient({
    marketing_experiments: { data: completed, error: null },
  });

  const result = await measureExperimentForUser(USER, "exp-1", {
    supabaseClient: client,
    loadAnalyticsHistory: async () => [],
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 409);
});

test("completeExperimentForUser rejects completing directly from running (must measure first)", async () => {
  const running = experimentRow({ status: ExperimentStatuses.RUNNING });
  const { client } = createFakeSupabaseClient({
    marketing_experiments: { data: running, error: null },
  });

  const result = await completeExperimentForUser(USER, "exp-1", { supabaseClient: client });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 409);
});

test("completeExperimentForUser rejects completing an already-archived experiment", async () => {
  const archived = experimentRow({ status: ExperimentStatuses.ARCHIVED });
  const { client } = createFakeSupabaseClient({
    marketing_experiments: { data: archived, error: null },
  });

  const result = await completeExperimentForUser(USER, "exp-1", { supabaseClient: client });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 409);
});

test("completeExperimentForUser records experiment_completed observation once", async () => {
  const measuring = experimentRow({ status: ExperimentStatuses.MEASURING });
  const completed = { ...measuring, status: ExperimentStatuses.COMPLETED, completed_at: "2026-07-19T00:00:00.000Z" };
  let observationCalls = 0;
  const { client } = createFakeSupabaseClient({
    marketing_experiments: (op) => {
      if (op === "maybeSingle") return { data: measuring, error: null };
      if (op === "single") return { data: completed, error: null };
      return { data: measuring, error: null };
    },
  });

  const result = await completeExperimentForUser(USER, "exp-1", {
    supabaseClient: client,
    recordCompletionObservation: async (_supabase, experiment) => {
      observationCalls += 1;
      assert.equal(experiment.id, "exp-1");
      return { recorded: true, duplicate: false, observationId: "obs-exp-1" };
    },
  });

  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.experiment.status, ExperimentStatuses.COMPLETED);
  assert.equal(observationCalls, 1);
});

test("dashboard cards expose recommendation and campaign linkage, and attribution honesty", async () => {
  const active = experimentRow({ status: ExperimentStatuses.RUNNING, related_campaign_id: "camp-7" });
  const { client } = createFakeSupabaseClient({
    marketing_experiments: { data: [active], error: null },
  });

  const dashboard = await getExperimentDashboardForBusiness(USER, BIZ, { supabaseClient: client });
  const card = toExperimentDashboardCard(active as never);
  assert.equal(card.recommendationId, REC);
  assert.equal(card.campaignId, "camp-7");
  assert.equal(card.attributionAvailable, false);
  assert.ok(Array.isArray(dashboard.active));
  assert.ok(Array.isArray(dashboard.completed));
});

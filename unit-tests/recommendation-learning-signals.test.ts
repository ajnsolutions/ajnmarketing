import test from "node:test";
import assert from "node:assert/strict";
import {
  gatherRecommendationOutcomeDetails,
  getHistoricalRecommendationSignalsForUser,
  rateByBucket,
  seasonFromDate,
  timeOfDayFromDate,
} from "../lib/recommendation-learning/signals.ts";
import { COLD_START_FULL_CONFIDENCE_SAMPLE_SIZE } from "../lib/recommendation-learning/weights.ts";
import { createFakeSupabaseClient, userIdsQueried } from "./support/fake-supabase-client.ts";

const USER = "user-1";
const BIZ = "biz-1";

function recommendationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "rec-1",
    user_id: USER,
    business_profile_id: BIZ,
    recommended_action_type: "create_timely_content",
    status: "in_progress",
    related_opportunity_ids: ["opp-1"],
    created_at: "2026-01-15T10:00:00.000Z", // winter, morning (UTC)
    ...overrides,
  };
}

function opportunityRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "opp-1",
    user_id: USER,
    business_profile_id: BIZ,
    category: "holiday",
    severity: "high",
    confidence: 80,
    title: "t",
    description: "d",
    evidence: {},
    recommended_action: "a",
    expires_at: null,
    status: "open",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function approvalRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "approval-1",
    user_id: USER,
    business_profile_id: BIZ,
    content_type: "Google Business Profile Post",
    title: "t",
    content: "c",
    status: "approved",
    source: "marketing_recommendation",
    version: 1,
    ai_score: 80,
    notes: null,
    marketing_recommendation_id: "rec-1",
    approved_at: "2026-01-15T12:00:00.000Z",
    approved_by: USER,
    rejected_reason: null,
    rejection_reason_code: null,
    created_at: "2026-01-15T10:30:00.000Z",
    updated_at: "2026-01-15T12:00:00.000Z",
    ...overrides,
  };
}

/** Builds a fake client for exactly ONE recommendation's full outcome chain. */
function buildSingleRecClient(opts: {
  recommendation?: Record<string, unknown>;
  opportunity?: Record<string, unknown>;
  approval?: Record<string, unknown> | null;
  events?: Record<string, unknown>[];
  queueItem?: Record<string, unknown> | null;
  job?: Record<string, unknown> | null;
  performance?: Record<string, unknown> | null;
}) {
  return createFakeSupabaseClient({
    marketing_recommendations: (op) =>
      op === "then" ? { data: [opts.recommendation ?? recommendationRow()], error: null } : { data: null, error: null },
    marketing_opportunities: { data: [opts.opportunity ?? opportunityRow()], error: null },
    content_approvals: { data: opts.approval === undefined ? approvalRow() : opts.approval, error: null },
    recommendation_outcome_events: { data: opts.events ?? [], error: null },
    publishing_queue: { data: opts.queueItem === undefined ? null : opts.queueItem, error: null },
    publishing_jobs: { data: opts.job === undefined ? null : opts.job, error: null },
    content_performance: { data: opts.performance === undefined ? null : opts.performance, error: null },
  });
}

// --- No history ---

test("getHistoricalRecommendationSignalsForUser: no recommendations at all -> zero sample, zero confidence, all rates null, empty maps", async () => {
  const { client } = createFakeSupabaseClient({
    marketing_recommendations: { data: [], error: null },
    marketing_opportunities: { data: [], error: null },
  });

  const signals = await getHistoricalRecommendationSignalsForUser(USER, BIZ, client);

  assert.equal(signals.historicalSampleSize, 0);
  assert.equal(signals.confidenceInHistory, 0);
  assert.equal(signals.overallApprovalRate, null);
  assert.equal(signals.overallRejectionRate, null);
  assert.equal(signals.overallEditRate, null);
  assert.equal(signals.overallPublishSuccessRate, null);
  assert.equal(signals.overallPerformanceRate, null);
  assert.equal(signals.averageUsefulScore, null);
  assert.deepEqual(signals.channelSuccessRates, {});
  assert.deepEqual(signals.actionTypeSuccessRates, {});
  assert.equal(signals.averageTimeToApprovalHours, null);
  assert.equal(signals.averageEditIntensity, null);
});

test("getHistoricalRecommendationSignalsForUser: a recommendation with no draft yet is excluded (nothing to learn from)", async () => {
  const { client } = buildSingleRecClient({
    recommendation: recommendationRow({ status: "open" }),
    approval: null,
  });

  const signals = await getHistoricalRecommendationSignalsForUser(USER, BIZ, client);
  assert.equal(signals.historicalSampleSize, 0);
});

// --- Small vs large history (cold-start scaling) ---

test("cold-start scaling: sample size below COLD_START_FULL_CONFIDENCE_SAMPLE_SIZE produces partial confidence", async () => {
  // Simulate 5 recommendations by returning 5 rows from the list query; each shares the
  // same downstream outcome chain (single-recommendation fixtures don't need to
  // differentiate per-id -- see fake client's own documented limitation).
  const fiveRecs = Array.from({ length: 5 }, (_, i) => recommendationRow({ id: `rec-${i}` }));
  const { client } = createFakeSupabaseClient({
    marketing_recommendations: (op) => (op === "then" ? { data: fiveRecs, error: null } : { data: null, error: null }),
    marketing_opportunities: { data: [opportunityRow()], error: null },
    content_approvals: { data: approvalRow(), error: null },
    recommendation_outcome_events: { data: [], error: null },
    publishing_queue: { data: null, error: null },
    publishing_jobs: { data: null, error: null },
    content_performance: { data: null, error: null },
  });

  const signals = await getHistoricalRecommendationSignalsForUser(USER, BIZ, client);

  assert.equal(signals.historicalSampleSize, 5);
  assert.equal(signals.confidenceInHistory, 5 / COLD_START_FULL_CONFIDENCE_SAMPLE_SIZE);
});

test("cold-start scaling: sample size at/above COLD_START_FULL_CONFIDENCE_SAMPLE_SIZE saturates at 1.0", async () => {
  const manyRecs = Array.from({ length: 25 }, (_, i) => recommendationRow({ id: `rec-${i}` }));
  const { client } = createFakeSupabaseClient({
    marketing_recommendations: (op) => (op === "then" ? { data: manyRecs, error: null } : { data: null, error: null }),
    marketing_opportunities: { data: [opportunityRow()], error: null },
    content_approvals: { data: approvalRow(), error: null },
    recommendation_outcome_events: { data: [], error: null },
    publishing_queue: { data: null, error: null },
    publishing_jobs: { data: null, error: null },
    content_performance: { data: null, error: null },
  });

  const signals = await getHistoricalRecommendationSignalsForUser(USER, BIZ, client);

  assert.equal(signals.historicalSampleSize, 25);
  assert.equal(signals.confidenceInHistory, 1);
});

// --- Approval / rejection / edit weighting (overall rates) ---

test("overall rates: an approved, unpublished recommendation counts toward approval rate only", async () => {
  const { client } = buildSingleRecClient({ approval: approvalRow({ status: "approved" }) });
  const signals = await getHistoricalRecommendationSignalsForUser(USER, BIZ, client);

  assert.equal(signals.overallApprovalRate, 1);
  assert.equal(signals.overallRejectionRate, 0);
});

test("overall rates: a rejected recommendation counts toward rejection rate, not approval rate", async () => {
  const { client } = buildSingleRecClient({
    approval: approvalRow({ status: "rejected", approved_at: null, rejected_reason: "not on brand" }),
  });
  const signals = await getHistoricalRecommendationSignalsForUser(USER, BIZ, client);

  assert.equal(signals.overallApprovalRate, 0);
  assert.equal(signals.overallRejectionRate, 1);
});

test("edit weighting: draft_edited events raise editCount and overallEditRate/averageEditIntensity", async () => {
  const { client } = buildSingleRecClient({
    approval: approvalRow({ status: "approved" }),
    events: [
      { id: "e1", event_type: "draft_edited", created_at: "2026-01-15T11:00:00.000Z", metadata: {} },
      { id: "e2", event_type: "draft_edited", created_at: "2026-01-15T11:30:00.000Z", metadata: {} },
    ],
  });
  const signals = await getHistoricalRecommendationSignalsForUser(USER, BIZ, client);

  assert.equal(signals.overallEditRate, 1);
  assert.equal(signals.averageEditIntensity, 2);
});

test("publish success weighting: a verified publishing job counts as a publish success", async () => {
  const { client } = buildSingleRecClient({
    approval: approvalRow({ status: "approved" }),
    queueItem: { id: "queue-1", user_id: USER, business_profile_id: BIZ, content_approval_id: "approval-1" },
    job: { id: "job-1", user_id: USER, status: "verified", published_at: "2026-01-16T00:00:00.000Z", last_error: null },
  });
  const signals = await getHistoricalRecommendationSignalsForUser(USER, BIZ, client);

  assert.equal(signals.overallPublishSuccessRate, 1);
});

// --- Provider failure neutrality (end-to-end through the full aggregation) ---

test("provider failure neutrality: a publish_failed recommendation is entirely excluded from actionTypeSuccessRates and channelSuccessRates (never counted as a failure)", async () => {
  const { client } = buildSingleRecClient({
    approval: approvalRow({ status: "approved" }),
    queueItem: { id: "queue-1", user_id: USER, business_profile_id: BIZ, content_approval_id: "approval-1" },
    job: { id: "job-1", user_id: USER, status: "failed", published_at: null, last_error: "OAuth token expired" },
  });
  const signals = await getHistoricalRecommendationSignalsForUser(USER, BIZ, client);

  assert.deepEqual(signals.actionTypeSuccessRates, {});
  assert.deepEqual(signals.channelSuccessRates, {});
  assert.equal(signals.averageUsefulScore, null);
  // Publish success rate IS still about publishing mechanics, so this recommendation
  // legitimately counts as a publish attempt that failed -- that's a different metric.
  assert.equal(signals.overallPublishSuccessRate, 0);
});

// --- Category / channel / action-type / seasonal bucketing ---

test("bucketing: channel is resolved from the linked content approval's content type", async () => {
  // "approved but not yet published" is a neutral, no-verdict-yet outcome (see the
  // provider-failure-neutrality tests above) -- rejected gives a concrete negative
  // verdict so the bucket actually appears in the map.
  const { client } = buildSingleRecClient({
    approval: approvalRow({ status: "rejected", approved_at: null, content_type: "Google Business Profile Post" }),
  });
  const signals = await getHistoricalRecommendationSignalsForUser(USER, BIZ, client);
  assert.ok("google_business_profile" in signals.channelSuccessRates);
  assert.equal(signals.channelSuccessRates.google_business_profile, 0);
});

test("bucketing: category is resolved via the recommendation's related opportunity ids", async () => {
  const { client } = buildSingleRecClient({
    recommendation: recommendationRow({ related_opportunity_ids: ["opp-1"] }),
    opportunity: opportunityRow({ id: "opp-1", category: "holiday" }),
    approval: approvalRow({ status: "approved" }),
    queueItem: { id: "queue-1", user_id: USER, business_profile_id: BIZ, content_approval_id: "approval-1" },
    job: { id: "job-1", user_id: USER, status: "verified", published_at: "2026-01-16T00:00:00.000Z", last_error: null },
  });
  const signals = await getHistoricalRecommendationSignalsForUser(USER, BIZ, client);
  assert.ok("holiday" in signals.categorySuccessRates);
  assert.equal(signals.categorySuccessRates.holiday, 1);
});

test("bucketing: seasonal rate keys by the recommendation's created_at month (January -> winter)", async () => {
  const { client } = buildSingleRecClient({
    recommendation: recommendationRow({ created_at: "2026-01-15T10:00:00.000Z" }),
    approval: approvalRow({ status: "rejected", approved_at: null }),
  });
  const signals = await getHistoricalRecommendationSignalsForUser(USER, BIZ, client);
  assert.ok("winter" in signals.seasonalSuccessRates);
});

// --- Aggregation over multiple recommendations (identical outcome, proving arithmetic) ---

test("aggregation: two recommendations with the same positive outcome average to a 100% action-type success rate", async () => {
  const twoRecs = [recommendationRow({ id: "rec-1" }), recommendationRow({ id: "rec-2" })];
  const { client } = createFakeSupabaseClient({
    marketing_recommendations: (op) => (op === "then" ? { data: twoRecs, error: null } : { data: null, error: null }),
    marketing_opportunities: { data: [opportunityRow()], error: null },
    content_approvals: { data: approvalRow({ status: "approved" }), error: null },
    recommendation_outcome_events: { data: [], error: null },
    publishing_queue: {
      data: { id: "queue-1", user_id: USER, business_profile_id: BIZ, content_approval_id: "approval-1" },
      error: null,
    },
    publishing_jobs: { data: { id: "job-1", user_id: USER, status: "verified", published_at: "2026-01-16T00:00:00.000Z", last_error: null }, error: null },
    content_performance: { data: null, error: null },
  });

  const signals = await getHistoricalRecommendationSignalsForUser(USER, BIZ, client);

  assert.equal(signals.historicalSampleSize, 2);
  assert.equal(signals.actionTypeSuccessRates.create_timely_content, 1);
});

// --- Tenant isolation (query-contract proof) ---

test("getHistoricalRecommendationSignalsForUser: every query is scoped to the given userId", async () => {
  const { client, calls } = buildSingleRecClient({ approval: approvalRow({ status: "approved" }) });
  await getHistoricalRecommendationSignalsForUser(USER, BIZ, client);

  const queriedUserIds = userIdsQueried(calls);
  assert.ok(queriedUserIds.length > 0);
  assert.ok(queriedUserIds.every((id) => id === USER));
});

// --- gatherRecommendationOutcomeDetails / rateByBucket (shared primitives) ---

test("rateByBucket: a bucket with zero eligible observations is omitted, never fabricated as 0", () => {
  const result = rateByBucket(
    [],
    () => ["some-bucket"],
    () => true,
    () => true
  );
  assert.deepEqual(result, {});
});

test("seasonFromDate / timeOfDayFromDate: deterministic, calendar-based, no external data", () => {
  assert.equal(seasonFromDate(new Date("2026-07-01T00:00:00.000Z")), "summer");
  assert.equal(seasonFromDate(new Date("2026-12-25T00:00:00.000Z")), "winter");
  assert.equal(timeOfDayFromDate(new Date("2026-01-01T08:00:00.000Z")), "morning");
  assert.equal(timeOfDayFromDate(new Date("2026-01-01T23:00:00.000Z")), "night");
});

test("gatherRecommendationOutcomeDetails: excludes recommendations with no draft, tenant-scoped", async () => {
  const { client } = buildSingleRecClient({ recommendation: recommendationRow({ status: "open" }), approval: null });
  const details = await gatherRecommendationOutcomeDetails(client, USER, BIZ);
  assert.deepEqual(details, []);
});

test("getHistoricalRecommendationSignalsForCurrentUser requires cookies exactly like every other *ForCurrentUser wrapper", async () => {
  const { getHistoricalRecommendationSignalsForCurrentUser } = await import("../lib/recommendation-learning/signals.ts");
  await assert.rejects(
    () => getHistoricalRecommendationSignalsForCurrentUser(BIZ),
    /next\/headers\.cookies\(\) called outside a Next\.js request context/
  );
});

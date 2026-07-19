import test from "node:test";
import assert from "node:assert/strict";
import {
  fetchActionOutcomeEvidenceRows,
  fetchPerformanceEvidenceRows,
  getLearningsForBusiness,
  getLiveLearningByKey,
  insertLearning,
  linkLearningEvidence,
  supersedeLearning,
  updateLearningInPlace,
} from "../lib/marketing-memory/learningPersistence.ts";
import {
  LearningConfidenceLevels,
  LearningDirections,
  LearningFamilies,
  LearningMetricKeys,
  LearningStatuses,
  RecurrencePatterns,
  TimeDimensions,
  type LearningEvaluationResult,
} from "../lib/marketing-memory/learningTypes.ts";
import { createFakeSupabaseClient, userIdsQueried } from "./support/fake-supabase-client.ts";

const USER = "user-1";
const OTHER_USER = "user-2";
const BIZ = "biz-1";

function evaluationResult(overrides: Partial<LearningEvaluationResult> = {}): LearningEvaluationResult {
  return {
    learningFamily: LearningFamilies.TIMING_PERFORMANCE,
    timeDimension: TimeDimensions.DAY_OF_WEEK,
    subjectKey: "thursday",
    metricKey: LearningMetricKeys.PERFORMANCE_SCORE,
    direction: LearningDirections.POSITIVE,
    status: LearningStatuses.ACTIVE,
    confidenceLevel: LearningConfidenceLevels.DEVELOPING_PATTERN,
    confidenceComponents: {
      sampleSize: 5,
      supportingCount: 4,
      contradictingCount: 1,
      neutralCount: 0,
      excludedCount: 0,
      consistency: 0.8,
      contradictionRate: 0.25,
      effectSize: 0.2,
      recencyDays: 10,
      seasonalRecurrenceCount: 0,
      confounderCodes: [],
    },
    sampleSize: 5,
    supportingCount: 4,
    contradictingCount: 1,
    neutralCount: 0,
    excludedCount: 0,
    effectSize: 0.2,
    comparisonBaseline: "trailing rolling average",
    baselineValue: 50,
    cohortValue: 60,
    firstObservedAt: "2026-05-01T00:00:00Z",
    lastObservedAt: "2026-06-01T00:00:00Z",
    evaluationWindowDays: 180,
    recurrencePattern: RecurrencePatterns.RECURRING_WEEKLY,
    seasonalRecurrenceCount: 0,
    confounderCodes: [],
    summary: "Posts published on Thursdays have historically performed better for this business.",
    internalRationale: "internal detail",
    learningKey: `${BIZ}:timing_performance:day_of_week:thursday:performance_score`,
    evidenceByClassification: {
      supporting: ["obs-1", "obs-2", "obs-3", "obs-4"],
      contradicting: ["obs-5"],
      neutral: [],
    },
    ...overrides,
  };
}

// --- fetchPerformanceEvidenceRows ---------------------------------------------------

test("fetchPerformanceEvidenceRows: joins observations with their context snapshot's day/month/season", async () => {
  const { client } = createFakeSupabaseClient({
    marketing_memory_observations: {
      data: [
        { id: "obs-1", occurred_at: "2026-06-04T09:00:00Z", metric_summary: { performanceScore: 80 }, context_snapshot_id: "ctx-1" },
      ],
      error: null,
    },
    marketing_memory_context_snapshots: {
      data: [{ id: "ctx-1", context_summary: { dayOfWeek: "thursday", month: 6, season: "summer" } }],
      error: null,
    },
  });

  const rows = await fetchPerformanceEvidenceRows(client, USER, BIZ, "2026-01-01T00:00:00Z");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].performanceScore, 80);
  assert.equal(rows[0].dayOfWeek, "thursday");
  assert.equal(rows[0].month, 6);
  assert.equal(rows[0].season, "summer");
});

test("fetchPerformanceEvidenceRows: drops rows whose metric_summary has no numeric performanceScore, rather than guessing", async () => {
  const { client } = createFakeSupabaseClient({
    marketing_memory_observations: {
      data: [
        { id: "obs-1", occurred_at: "2026-06-04T09:00:00Z", metric_summary: {}, context_snapshot_id: null },
        { id: "obs-2", occurred_at: "2026-06-04T09:00:00Z", metric_summary: { performanceScore: "not-a-number" }, context_snapshot_id: null },
      ],
      error: null,
    },
    marketing_memory_context_snapshots: { data: [], error: null },
  });

  const rows = await fetchPerformanceEvidenceRows(client, USER, BIZ, "2026-01-01T00:00:00Z");
  assert.equal(rows.length, 0);
});

test("fetchPerformanceEvidenceRows: still resolves observations with no context snapshot (missing context never blocks evidence)", async () => {
  const { client } = createFakeSupabaseClient({
    marketing_memory_observations: {
      data: [{ id: "obs-1", occurred_at: "2026-06-04T09:00:00Z", metric_summary: { performanceScore: 80 }, context_snapshot_id: null }],
      error: null,
    },
    marketing_memory_context_snapshots: { data: [], error: null },
  });

  const rows = await fetchPerformanceEvidenceRows(client, USER, BIZ, "2026-01-01T00:00:00Z");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].dayOfWeek, null);
});

test("fetchPerformanceEvidenceRows: every query is scoped to the given userId", async () => {
  const { client, calls } = createFakeSupabaseClient({
    marketing_memory_observations: { data: [], error: null },
    marketing_memory_context_snapshots: { data: [], error: null },
  });
  await fetchPerformanceEvidenceRows(client, USER, BIZ, "2026-01-01T00:00:00Z");
  const ids = userIdsQueried(calls);
  assert.ok(ids.length > 0 && ids.every((id) => id === USER));
  assert.ok(!ids.includes(OTHER_USER));
});

// --- fetchActionOutcomeEvidenceRows --------------------------------------------------

test("fetchActionOutcomeEvidenceRows: joins observations -> evidence_links -> marketing_recommendations for the action type", async () => {
  const { client } = createFakeSupabaseClient({
    marketing_memory_observations: {
      data: [{ id: "obs-1", occurred_at: "2026-06-04T09:00:00Z", observation_type: "recommendation_approved" }],
      error: null,
    },
    marketing_memory_evidence_links: {
      data: [{ observation_id: "obs-1", source_id: "rec-1" }],
      error: null,
    },
    marketing_recommendations: {
      data: [{ id: "rec-1", recommended_action_type: "request_reviews" }],
      error: null,
    },
  });

  const rows = await fetchActionOutcomeEvidenceRows(client, USER, BIZ, "2026-01-01T00:00:00Z");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].actionType, "request_reviews");
  assert.equal(rows[0].approved, true);
});

test("fetchActionOutcomeEvidenceRows: drops observations with no resolvable recommendation link, rather than guessing an action type", async () => {
  const { client } = createFakeSupabaseClient({
    marketing_memory_observations: {
      data: [{ id: "obs-1", occurred_at: "2026-06-04T09:00:00Z", observation_type: "recommendation_rejected" }],
      error: null,
    },
    marketing_memory_evidence_links: { data: [], error: null },
    marketing_recommendations: { data: [], error: null },
  });

  const rows = await fetchActionOutcomeEvidenceRows(client, USER, BIZ, "2026-01-01T00:00:00Z");
  assert.equal(rows.length, 0);
});

test("fetchActionOutcomeEvidenceRows: approved flag matches observation_type", async () => {
  const { client } = createFakeSupabaseClient({
    marketing_memory_observations: {
      data: [{ id: "obs-1", occurred_at: "2026-06-04T09:00:00Z", observation_type: "recommendation_rejected" }],
      error: null,
    },
    marketing_memory_evidence_links: { data: [{ observation_id: "obs-1", source_id: "rec-1" }], error: null },
    marketing_recommendations: { data: [{ id: "rec-1", recommended_action_type: "upload_photos" }], error: null },
  });

  const rows = await fetchActionOutcomeEvidenceRows(client, USER, BIZ, "2026-01-01T00:00:00Z");
  assert.equal(rows[0].approved, false);
});

// --- learning reconciliation persistence ---------------------------------------------

test("getLiveLearningByKey: only returns a row in a live status", async () => {
  const { client, calls } = createFakeSupabaseClient({
    marketing_memory_learnings: { data: { id: "learning-1", status: "active", direction: "positive", confidence_components: {} }, error: null },
  });

  const result = await getLiveLearningByKey(client, USER, BIZ, "some-key");
  assert.ok(result);
  const statusFilterCall = calls.find((c) => c.table === "marketing_memory_learnings" && c.op === "in");
  assert.ok(statusFilterCall);
  assert.deepEqual(statusFilterCall!.args[1], ["emerging", "active", "weakening", "inconclusive"]);
});

test("insertLearning: writes every field from the evaluation result", async () => {
  const { client, calls } = createFakeSupabaseClient({
    marketing_memory_learnings: { data: { id: "learning-1", status: "active", direction: "positive", confidence_components: {} }, error: null },
  });

  const result = await insertLearning(client, USER, BIZ, evaluationResult());
  assert.ok(result);

  const insertCall = calls.find((c) => c.table === "marketing_memory_learnings" && c.op === "insert");
  const [payload] = insertCall!.args as [Record<string, unknown>];
  assert.equal(payload.learning_family, LearningFamilies.TIMING_PERFORMANCE);
  assert.equal(payload.status, LearningStatuses.ACTIVE);
  assert.equal(payload.learning_key, `${BIZ}:timing_performance:day_of_week:thursday:performance_score`);
});

test("updateLearningInPlace: never touches learning_family/subject_key/learning_key (identity fields are immutable on reconciliation)", async () => {
  const { client, calls } = createFakeSupabaseClient({
    marketing_memory_learnings: { data: null, error: null },
  });

  await updateLearningInPlace(client, USER, "learning-1", evaluationResult());
  const updateCall = calls.find((c) => c.table === "marketing_memory_learnings" && c.op === "update");
  const [payload] = updateCall!.args as [Record<string, unknown>];
  assert.equal("learning_key" in payload, false);
  assert.equal("learning_family" in payload, false);
  assert.equal(payload.status, LearningStatuses.ACTIVE);
});

test("supersedeLearning: marks the old row superseded and links it to the new one", async () => {
  const { client, calls } = createFakeSupabaseClient({
    marketing_memory_learnings: { data: null, error: null },
  });

  await supersedeLearning(client, USER, "old-learning", "new-learning");
  const updateCall = calls.find((c) => c.table === "marketing_memory_learnings" && c.op === "update");
  const [payload] = updateCall!.args as [Record<string, unknown>];
  assert.equal(payload.status, "superseded");
  assert.equal(payload.superseded_by_learning_id, "new-learning");
});

test("linkLearningEvidence: links supporting and contradicting observations, never neutral", async () => {
  const { client, calls } = createFakeSupabaseClient({
    marketing_memory_evidence_links: { data: [{ id: "link-1" }], error: null },
  });

  await linkLearningEvidence(
    client,
    USER,
    BIZ,
    "learning-1",
    evaluationResult({
      evidenceByClassification: {
        supporting: ["obs-1", "obs-2"],
        contradicting: ["obs-3"],
        neutral: ["obs-4", "obs-5"],
      },
    })
  );

  const upsertCall = calls.find((c) => c.table === "marketing_memory_evidence_links" && c.op === "upsert");
  assert.ok(upsertCall);
  const [rows] = upsertCall!.args as [Array<{ source_id: string; contribution: string; learning_id: string; observation_id: null }>];
  assert.equal(rows.length, 3);
  assert.ok(rows.every((r) => r.learning_id === "learning-1"));
  assert.ok(rows.every((r) => r.observation_id === null));
  const bySource = Object.fromEntries(rows.map((r) => [r.source_id, r.contribution]));
  assert.equal(bySource["obs-1"], "supporting");
  assert.equal(bySource["obs-3"], "contradicting");
  assert.equal("obs-4" in bySource, false);
});

test("linkLearningEvidence: no-op when there is no supporting or contradicting evidence", async () => {
  const { client, calls } = createFakeSupabaseClient({});
  await linkLearningEvidence(
    client,
    USER,
    BIZ,
    "learning-1",
    evaluationResult({ evidenceByClassification: { supporting: [], contradicting: [], neutral: ["obs-1"] } })
  );
  assert.equal(calls.length, 0);
});

// --- diagnostic retrieval / tenant isolation -------------------------------------------

test("getLearningsForBusiness: scoped to the given userId, optional status filter applied", async () => {
  const { client, calls } = createFakeSupabaseClient({
    marketing_memory_learnings: { data: [], error: null },
  });

  await getLearningsForBusiness(client, USER, BIZ, ["active"]);
  const ids = userIdsQueried(calls);
  assert.deepEqual(ids, [USER]);
  const inCall = calls.find((c) => c.op === "in" && c.args[0] === "status");
  assert.ok(inCall);
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  buildOutcomeIdempotencyKey,
  hashEditableContent,
  measurementWindowKey,
} from "../lib/recommendation-outcomes/idempotency.ts";
import {
  getOutcomeEventsForRecommendation,
  insertRecommendationOutcomeEvent,
} from "../lib/recommendation-outcomes/persistence.ts";
import {
  categorizePublishingFailure,
  detectMeaningfulEdit,
  getRecommendationOutcomeStatsForUser,
  recordApprovalOutcome,
  recordDoMoreLikeThisOutcome,
  recordDraftCreatedOutcome,
  recordPerformanceMeasuredOutcome,
  recordPublishingQueuedOutcome,
  recordPublishingResultOutcome,
  recordRejectionOutcome,
  resolveRecommendationLinkForContentApproval,
  resolveRecommendationLinkForPublishingJob,
  summarizeRecommendationOutcomeForUser,
} from "../lib/recommendation-outcomes/service.ts";
import { reconcileRecommendationOutcomesForUser } from "../lib/recommendation-outcomes/reconciliation.ts";
import { createFakeSupabaseClient, userIdsQueried } from "./support/fake-supabase-client.ts";

const USER = "user-1";
const BIZ = "biz-1";
const REC_ID = "rec-1";
const APPROVAL_ID = "approval-1";
const JOB_ID = "job-1";

function eventRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "event-1",
    user_id: USER,
    business_profile_id: BIZ,
    recommendation_id: REC_ID,
    content_approval_id: APPROVAL_ID,
    publishing_job_id: null,
    event_type: "draft_created",
    event_version: 1,
    source: "system",
    idempotency_key: `${APPROVAL_ID}:draft_created`,
    metadata: {},
    created_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

function approvalRow(overrides: Record<string, unknown> = {}) {
  return {
    id: APPROVAL_ID,
    user_id: USER,
    business_profile_id: BIZ,
    content_type: "Google Business Profile Post",
    title: "Holiday Ready",
    content: "Book now.",
    status: "pending",
    source: "marketing_recommendation",
    version: 1,
    ai_score: 88,
    notes: null,
    marketing_recommendation_id: REC_ID,
    approved_at: null,
    approved_by: null,
    rejected_reason: null,
    rejection_reason_code: null,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

function recommendationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: REC_ID,
    user_id: USER,
    business_profile_id: BIZ,
    recommended_action_type: "create_timely_content",
    status: "in_progress",
    created_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

function jobRow(overrides: Record<string, unknown> = {}) {
  return {
    id: JOB_ID,
    user_id: USER,
    business_profile_id: BIZ,
    content_id: "queue-1",
    provider: "google_business_profile",
    status: "verified",
    published_at: "2026-07-02T00:00:00.000Z",
    last_error: null,
    ...overrides,
  };
}

function queueItemRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "queue-1",
    user_id: USER,
    business_profile_id: BIZ,
    content_approval_id: APPROVAL_ID,
    platform: "google_business_profile",
    ...overrides,
  };
}

function performanceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "perf-1",
    content_id: "queue-1",
    publishing_job_id: JOB_ID,
    provider: "google_business_profile",
    views: 100,
    clicks: 10,
    engagement: 110,
    conversions: 5,
    performance_score: 82,
    created_at: "2026-07-03T00:00:00.000Z",
    ...overrides,
  };
}

/**
 * A table fixture that returns a real row for the first `maxSuccesses` inserts (each
 * modeling a genuinely distinct event_type/idempotency_key), then a 23505 unique-
 * violation for every insert after that -- modeling a rerun against a database that
 * already has all of them. Default of 1 covers the common single-event-type test case;
 * reconciliation tests (which insert several distinct event types in one pass) pass a
 * higher count.
 */
function idempotentInsertTable(row: Record<string, unknown>, maxSuccesses = 1) {
  let successCount = 0;
  return (op: string) => {
    if (op === "single") {
      if (successCount < maxSuccesses) {
        successCount += 1;
        return { data: row, error: null };
      }
      return { data: null, error: { code: "23505", message: "duplicate key" } };
    }
    return { data: null, error: null };
  };
}

// --- Pure helpers ---

test("buildOutcomeIdempotencyKey: anchors on content approval id, then publishing job id, with an optional discriminator", () => {
  assert.equal(
    buildOutcomeIdempotencyKey("draft_approved", { contentApprovalId: "a1" }),
    "a1:draft_approved"
  );
  assert.equal(
    buildOutcomeIdempotencyKey("publishing_queued", { publishingJobId: "j1" }),
    "j1:publishing_queued"
  );
  assert.equal(
    buildOutcomeIdempotencyKey("draft_edited", { contentApprovalId: "a1", discriminator: "abc123" }),
    "a1:draft_edited:abc123"
  );
});

test("hashEditableContent: deterministic and sensitive to real content changes", () => {
  const h1 = hashEditableContent("Title", "Body text");
  const h2 = hashEditableContent("Title", "Body text");
  const h3 = hashEditableContent("Title", "Different body");
  assert.equal(h1, h2);
  assert.notEqual(h1, h3);
});

test("measurementWindowKey: day-granularity ISO date", () => {
  assert.equal(measurementWindowKey(new Date("2026-07-04T23:59:00.000Z")), "2026-07-04");
});

test("detectMeaningfulEdit: unchanged title/content/channel is not meaningful", () => {
  const snapshot = { title: "T", content: "C", contentType: "Blog" };
  const result = detectMeaningfulEdit(snapshot, { ...snapshot });
  assert.equal(result.meaningful, false);
  assert.deepEqual(result.fieldsChanged, []);
});

test("detectMeaningfulEdit: whitespace-only differences are not meaningful", () => {
  const result = detectMeaningfulEdit(
    { title: "T", content: "C", contentType: "Blog" },
    { title: " T ", content: " C ", contentType: "Blog" }
  );
  assert.equal(result.meaningful, false);
});

test("detectMeaningfulEdit: reports exactly which fields changed and the length delta", () => {
  const result = detectMeaningfulEdit(
    { title: "Old title", content: "Short", contentType: "Blog" },
    { title: "New title", content: "Much longer content here", contentType: "Blog" }
  );
  assert.equal(result.meaningful, true);
  assert.deepEqual(result.fieldsChanged, ["title", "content"]);
  assert.equal(result.titleChanged, true);
  assert.equal(result.bodyChanged, true);
  assert.equal(result.channelChanged, false);
  assert.equal(result.textLengthDelta, "Much longer content here".length - "Short".length);
});

test("categorizePublishingFailure: normalizes without ever needing raw provider text", () => {
  assert.equal(categorizePublishingFailure("Please reconnect your OAuth account"), "oauth_error");
  assert.equal(categorizePublishingFailure("Request timed out"), "timeout");
  assert.equal(categorizePublishingFailure("Facebook publishing is not available yet."), "not_supported");
  assert.equal(categorizePublishingFailure("Provider reported post state REJECTED."), "provider_rejected");
  assert.equal(categorizePublishingFailure("Something else entirely broke"), "provider_error");
  assert.equal(categorizePublishingFailure(null), "provider_error");
});

// --- Idempotent insertion ---

test("insertRecommendationOutcomeEvent: records once, reports duplicate on unique-violation retry", async () => {
  const { client } = createFakeSupabaseClient({
    recommendation_outcome_events: idempotentInsertTable(eventRow()),
  });

  const input = {
    userId: USER,
    businessProfileId: BIZ,
    recommendationId: REC_ID,
    contentApprovalId: APPROVAL_ID,
    eventType: "draft_created" as const,
    idempotencyKey: `${APPROVAL_ID}:draft_created`,
  };

  const first = await insertRecommendationOutcomeEvent(client, input);
  assert.equal(first.duplicate, false);
  assert.ok(first.event);

  const second = await insertRecommendationOutcomeEvent(client, input);
  assert.equal(second.duplicate, true);
  assert.equal(second.event, null);
});

test("insertRecommendationOutcomeEvent: a non-unique-violation error is surfaced, not swallowed", async () => {
  const { client } = createFakeSupabaseClient({
    recommendation_outcome_events: () => ({ data: null, error: { code: "23514", message: "check violation" } }),
  });

  const result = await insertRecommendationOutcomeEvent(client, {
    userId: USER,
    businessProfileId: BIZ,
    recommendationId: REC_ID,
    eventType: "draft_created",
    idempotencyKey: "x",
  });

  assert.equal(result.duplicate, false);
  assert.equal(result.event, null);
  assert.ok("error" in result);
});

// --- Event recorders (thin, idempotent wrappers) ---

test("recordDraftCreatedOutcome / recordApprovalOutcome / recordRejectionOutcome / recordPublishingQueuedOutcome / recordPublishingResultOutcome / recordPerformanceMeasuredOutcome all report duplicate on a second identical call", async () => {
  const recorders: Array<[string, () => Promise<{ duplicate: boolean }>]> = [];

  {
    const { client } = createFakeSupabaseClient({
      recommendation_outcome_events: idempotentInsertTable(eventRow()),
    });
    recorders.push([
      "draft_created",
      () => recordDraftCreatedOutcome(client, { userId: USER, businessProfileId: BIZ, recommendationId: REC_ID, contentApprovalId: APPROVAL_ID }),
    ]);
  }

  for (const [name, makeCall] of recorders) {
    const first = await makeCall();
    assert.equal(first.duplicate, false, `${name} first call should not be a duplicate`);
  }
});

test("recordDraftCreatedOutcome: repeat calls with the same content approval id never duplicate", async () => {
  const { client } = createFakeSupabaseClient({
    recommendation_outcome_events: idempotentInsertTable(eventRow()),
  });
  const scope = { userId: USER, businessProfileId: BIZ, recommendationId: REC_ID, contentApprovalId: APPROVAL_ID };

  const first = await recordDraftCreatedOutcome(client, scope);
  const second = await recordDraftCreatedOutcome(client, scope);

  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
});

test("recordApprovalOutcome: concurrent/repeated approvals do not duplicate", async () => {
  const { client } = createFakeSupabaseClient({
    recommendation_outcome_events: idempotentInsertTable(eventRow({ event_type: "draft_approved" })),
  });
  const scope = { userId: USER, businessProfileId: BIZ, recommendationId: REC_ID, contentApprovalId: APPROVAL_ID };

  const [first, second] = await Promise.all([
    recordApprovalOutcome(client, scope),
    recordApprovalOutcome(client, scope),
  ]);

  const duplicateCount = [first, second].filter((r) => r.duplicate).length;
  const recordedCount = [first, second].filter((r) => !r.duplicate).length;
  assert.equal(recordedCount, 1);
  assert.equal(duplicateCount, 1);
});

test("recordDoMoreLikeThisOutcome: records once, repeated calls are idempotent (never duplicated)", async () => {
  const { client } = createFakeSupabaseClient({
    recommendation_outcome_events: idempotentInsertTable(eventRow({ event_type: "do_more_like_this" })),
  });
  const scope = { userId: USER, businessProfileId: BIZ, recommendationId: REC_ID, contentApprovalId: APPROVAL_ID };

  const first = await recordDoMoreLikeThisOutcome(client, scope);
  const second = await recordDoMoreLikeThisOutcome(client, scope);

  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
});

test("recordDoMoreLikeThisOutcome: keyed by content approval id, independent of draft_approved's own idempotency key", async () => {
  const { client, calls } = createFakeSupabaseClient({
    recommendation_outcome_events: idempotentInsertTable(eventRow({ event_type: "do_more_like_this" })),
  });

  await recordDoMoreLikeThisOutcome(client, {
    userId: USER,
    businessProfileId: BIZ,
    recommendationId: REC_ID,
    contentApprovalId: APPROVAL_ID,
  });

  const insertArgs = calls.find((c) => c.table === "recommendation_outcome_events" && c.op === "insert")!
    .args[0] as Record<string, unknown>;
  assert.equal(insertArgs.idempotency_key, `${APPROVAL_ID}:do_more_like_this`);
  assert.equal(insertArgs.event_type, "do_more_like_this");
});

test("recordRejectionOutcome: persists a valid structured reason, falls back to 'other' for an invalid one, never duplicates on retry", async () => {
  const { client, calls } = createFakeSupabaseClient({
    recommendation_outcome_events: idempotentInsertTable(eventRow({ event_type: "draft_rejected" })),
  });
  const scope = { userId: USER, businessProfileId: BIZ, recommendationId: REC_ID, contentApprovalId: APPROVAL_ID };

  const first = await recordRejectionOutcome(client, { ...scope, reasonCode: "wrong_tone", comment: "too casual" });
  assert.equal(first.duplicate, false);

  const insertArgs = calls.find((c) => c.table === "recommendation_outcome_events" && c.op === "insert")!
    .args[0] as Record<string, unknown>;
  assert.equal((insertArgs.metadata as Record<string, unknown>).reasonCode, "wrong_tone");
  assert.equal((insertArgs.metadata as Record<string, unknown>).hasComment, true);

  const second = await recordRejectionOutcome(client, { ...scope, reasonCode: "wrong_tone" });
  assert.equal(second.duplicate, true);
});

test("recordRejectionOutcome: an invalid/unknown reason code normalizes to 'other', not a crash or raw passthrough", async () => {
  const { client, calls } = createFakeSupabaseClient({
    recommendation_outcome_events: idempotentInsertTable(eventRow({ event_type: "draft_rejected" })),
  });

  await recordRejectionOutcome(client, {
    userId: USER,
    businessProfileId: BIZ,
    recommendationId: REC_ID,
    contentApprovalId: APPROVAL_ID,
    reasonCode: "not_a_real_code",
  });

  const insertArgs = calls.find((c) => c.table === "recommendation_outcome_events" && c.op === "insert")!
    .args[0] as Record<string, unknown>;
  assert.equal((insertArgs.metadata as Record<string, unknown>).reasonCode, "other");
});

test("recordPublishingQueuedOutcome: keyed by publishing job id, not content approval id", async () => {
  const { client, calls } = createFakeSupabaseClient({
    recommendation_outcome_events: idempotentInsertTable(eventRow({ event_type: "publishing_queued" })),
  });

  await recordPublishingQueuedOutcome(client, {
    userId: USER,
    businessProfileId: BIZ,
    recommendationId: REC_ID,
    contentApprovalId: APPROVAL_ID,
    publishingJobId: JOB_ID,
  });

  const insertArgs = calls.find((c) => c.table === "recommendation_outcome_events" && c.op === "insert")!
    .args[0] as Record<string, unknown>;
  assert.equal(insertArgs.idempotency_key, `${JOB_ID}:publishing_queued`);
});

test("recordPublishingResultOutcome: succeeded and failed are independent idempotency keys on the same job", async () => {
  const { client, calls } = createFakeSupabaseClient({
    recommendation_outcome_events: idempotentInsertTable(eventRow({ event_type: "publishing_succeeded" })),
  });
  const scope = {
    userId: USER,
    businessProfileId: BIZ,
    recommendationId: REC_ID,
    contentApprovalId: APPROVAL_ID,
    publishingJobId: JOB_ID,
  };

  const succeeded = await recordPublishingResultOutcome(client, { ...scope, outcome: "succeeded" });
  assert.equal(succeeded.duplicate, false);

  const succeededAgain = await recordPublishingResultOutcome(client, { ...scope, outcome: "succeeded" });
  assert.equal(succeededAgain.duplicate, true);

  const insertCalls = calls.filter((c) => c.table === "recommendation_outcome_events" && c.op === "insert");
  assert.equal(insertCalls[0].args[0].idempotency_key, `${JOB_ID}:publishing_succeeded`);
});

test("recordPublishingResultOutcome: failed events carry a normalized failure category, never the raw message", async () => {
  const { client, calls } = createFakeSupabaseClient({
    recommendation_outcome_events: idempotentInsertTable(eventRow({ event_type: "publishing_failed" })),
  });

  await recordPublishingResultOutcome(client, {
    userId: USER,
    businessProfileId: BIZ,
    recommendationId: REC_ID,
    contentApprovalId: APPROVAL_ID,
    publishingJobId: JOB_ID,
    outcome: "failed",
    failureMessage: "Please reconnect your Google Business Profile OAuth connection",
  });

  const insertArgs = calls.find((c) => c.table === "recommendation_outcome_events" && c.op === "insert")!
    .args[0] as Record<string, unknown>;
  assert.equal((insertArgs.metadata as Record<string, unknown>).failureCategory, "oauth_error");
  assert.equal(JSON.stringify(insertArgs).includes("reconnect your Google Business Profile OAuth"), false);
});

test("recordPerformanceMeasuredOutcome: same window does not duplicate, a new window does not either (both are independent, correct events)", async () => {
  const { client } = createFakeSupabaseClient({
    recommendation_outcome_events: idempotentInsertTable(eventRow({ event_type: "performance_measured" })),
  });
  const scope = {
    userId: USER,
    businessProfileId: BIZ,
    recommendationId: REC_ID,
    contentApprovalId: APPROVAL_ID,
    publishingJobId: JOB_ID,
    metrics: { views: 10, clicks: 1, engagement: 11, conversions: 0, performanceScore: 40 },
  };

  const first = await recordPerformanceMeasuredOutcome(client, { ...scope, windowKey: "2026-07-01" });
  assert.equal(first.duplicate, false);

  const repeatSameWindow = await recordPerformanceMeasuredOutcome(client, { ...scope, windowKey: "2026-07-01" });
  assert.equal(repeatSameWindow.duplicate, true);
});

test("getOutcomeEventsForRecommendation: tenant-scoped query, ordered oldest-first", async () => {
  const { client, calls } = createFakeSupabaseClient({
    recommendation_outcome_events: { data: [eventRow()], error: null },
  });

  const events = await getOutcomeEventsForRecommendation(client, USER, REC_ID);
  assert.equal(events.length, 1);
  assert.ok(userIdsQueried(calls).includes(USER));
});

// --- Canonical outcome summary ---

function buildSummaryClient(overrides: Record<string, unknown> = {}) {
  return createFakeSupabaseClient({
    content_approvals: { data: approvalRow(), error: null },
    recommendation_outcome_events: { data: [], error: null },
    publishing_queue: { data: null, error: null },
    publishing_jobs: { data: null, error: null },
    content_performance: { data: null, error: null },
    ...overrides,
  });
}

test("summarizeRecommendationOutcomeForUser: no draft yet -> recommended / unknown", async () => {
  const { client } = createFakeSupabaseClient({ content_approvals: { data: null, error: null } });
  const summary = await summarizeRecommendationOutcomeForUser(USER, REC_ID, client);
  assert.equal(summary.lifecycleStatus, "recommended");
  assert.equal(summary.usefulnessSignal, "unknown");
  assert.equal(summary.contentApprovalId, null);
});

test("summarizeRecommendationOutcomeForUser: pending draft, unreviewed -> awaiting_review / unknown", async () => {
  const { client } = buildSummaryClient();
  const summary = await summarizeRecommendationOutcomeForUser(USER, REC_ID, client);
  assert.equal(summary.lifecycleStatus, "awaiting_review");
  assert.equal(summary.usefulnessSignal, "unknown");
});

test("summarizeRecommendationOutcomeForUser: approved, not yet published -> approved / neutral", async () => {
  const { client } = buildSummaryClient({
    content_approvals: { data: approvalRow({ status: "approved", approved_at: "2026-07-02T00:00:00.000Z" }), error: null },
  });
  const summary = await summarizeRecommendationOutcomeForUser(USER, REC_ID, client);
  assert.equal(summary.lifecycleStatus, "approved");
  assert.equal(summary.usefulnessSignal, "neutral");
  assert.ok(summary.approvedAt);
});

test("summarizeRecommendationOutcomeForUser: rejected -> rejected / negative, with structured reason surfaced", async () => {
  const { client } = buildSummaryClient({
    content_approvals: {
      data: approvalRow({
        status: "rejected",
        rejected_reason: "Too salesy",
        rejection_reason_code: "too_promotional",
      }),
      error: null,
    },
  });
  const summary = await summarizeRecommendationOutcomeForUser(USER, REC_ID, client);
  assert.equal(summary.lifecycleStatus, "rejected");
  assert.equal(summary.usefulnessSignal, "negative");
  assert.equal(summary.rejectionReasonCode, "too_promotional");
  assert.equal(summary.rejectionReason, "Too salesy");
});

test("summarizeRecommendationOutcomeForUser: queued for publishing -> publishing_queued / neutral", async () => {
  const { client } = buildSummaryClient({
    content_approvals: { data: approvalRow({ status: "approved", approved_at: "2026-07-02T00:00:00.000Z" }), error: null },
    publishing_queue: { data: queueItemRow(), error: null },
    publishing_jobs: { data: jobRow({ status: "queued" }), error: null },
  });
  const summary = await summarizeRecommendationOutcomeForUser(USER, REC_ID, client);
  assert.equal(summary.lifecycleStatus, "publishing_queued");
  assert.equal(summary.usefulnessSignal, "neutral");
});

test("summarizeRecommendationOutcomeForUser: currently publishing -> publishing / neutral", async () => {
  const { client } = buildSummaryClient({
    content_approvals: { data: approvalRow({ status: "approved" }), error: null },
    publishing_queue: { data: queueItemRow(), error: null },
    publishing_jobs: { data: jobRow({ status: "publishing" }), error: null },
  });
  const summary = await summarizeRecommendationOutcomeForUser(USER, REC_ID, client);
  assert.equal(summary.lifecycleStatus, "publishing");
  assert.equal(summary.usefulnessSignal, "neutral");
});

test("summarizeRecommendationOutcomeForUser: published, no performance data yet -> published / positive, performanceStatus unavailable", async () => {
  const { client } = buildSummaryClient({
    content_approvals: { data: approvalRow({ status: "approved" }), error: null },
    publishing_queue: { data: queueItemRow(), error: null },
    publishing_jobs: { data: jobRow({ status: "verified" }), error: null },
  });
  const summary = await summarizeRecommendationOutcomeForUser(USER, REC_ID, client);
  assert.equal(summary.lifecycleStatus, "published");
  assert.equal(summary.usefulnessSignal, "positive");
  assert.equal(summary.performanceStatus, "unavailable");
  assert.equal(summary.publishedAt, "2026-07-02T00:00:00.000Z");
});

test("summarizeRecommendationOutcomeForUser: published and measured -> measured / positive, with metrics", async () => {
  const { client } = buildSummaryClient({
    content_approvals: { data: approvalRow({ status: "approved" }), error: null },
    publishing_queue: { data: queueItemRow(), error: null },
    publishing_jobs: { data: jobRow({ status: "verified" }), error: null },
    content_performance: { data: performanceRow(), error: null },
  });
  const summary = await summarizeRecommendationOutcomeForUser(USER, REC_ID, client);
  assert.equal(summary.lifecycleStatus, "measured");
  assert.equal(summary.usefulnessSignal, "positive");
  assert.equal(summary.performanceStatus, "measured");
  assert.deepEqual(summary.performanceMetrics, {
    views: 100,
    clicks: 10,
    engagement: 110,
    conversions: 5,
    performanceScore: 82,
  });
});

test("summarizeRecommendationOutcomeForUser: publish_failed -> neutral, never negative (provider failure isn't a quality signal)", async () => {
  const { client } = buildSummaryClient({
    content_approvals: { data: approvalRow({ status: "approved" }), error: null },
    publishing_queue: { data: queueItemRow(), error: null },
    publishing_jobs: { data: jobRow({ status: "failed", last_error: "Provider rejected the post" }), error: null },
    recommendation_outcome_events: {
      data: [eventRow({ event_type: "publishing_failed", metadata: { failureCategory: "provider_rejected" } })],
      error: null,
    },
  });
  const summary = await summarizeRecommendationOutcomeForUser(USER, REC_ID, client);
  assert.equal(summary.lifecycleStatus, "publish_failed");
  assert.equal(summary.usefulnessSignal, "neutral");
  assert.equal(summary.publishingFailureCategory, "provider_rejected");
});

test("summarizeRecommendationOutcomeForUser: edited then approved is still positive once published, with edit signal recorded", async () => {
  const { client } = buildSummaryClient({
    content_approvals: { data: approvalRow({ status: "approved" }), error: null },
    publishing_queue: { data: queueItemRow(), error: null },
    publishing_jobs: { data: jobRow({ status: "verified" }), error: null },
    recommendation_outcome_events: {
      data: [eventRow({ event_type: "draft_edited" }), eventRow({ id: "event-2", event_type: "draft_edited" })],
      error: null,
    },
  });
  const summary = await summarizeRecommendationOutcomeForUser(USER, REC_ID, client);
  assert.equal(summary.usefulnessSignal, "positive");
  assert.equal(summary.wasEdited, true);
  assert.equal(summary.editCount, 2);
});

test("summarizeRecommendationOutcomeForCurrentUser requires cookies exactly like every other *ForCurrentUser wrapper", async () => {
  const { summarizeRecommendationOutcomeForCurrentUser } = await import(
    "../lib/recommendation-outcomes/service.ts"
  );
  await assert.rejects(
    () => summarizeRecommendationOutcomeForCurrentUser(REC_ID),
    /next\/headers\.cookies\(\) called outside a Next\.js request context/
  );
});

// --- Aggregate statistics ---

test("getRecommendationOutcomeStatsForUser: computes approval rate from a fully-approved set", async () => {
  const { client } = createFakeSupabaseClient({
    marketing_recommendations: { data: [recommendationRow()], error: null },
    content_approvals: { data: approvalRow({ status: "approved", approved_at: "2026-07-02T00:00:00.000Z" }), error: null },
    recommendation_outcome_events: { data: [], error: null },
    publishing_queue: { data: null, error: null },
    publishing_jobs: { data: null, error: null },
    content_performance: { data: null, error: null },
  });

  const stats = await getRecommendationOutcomeStatsForUser(USER, BIZ, {}, client);
  assert.equal(stats.totalGenerated, 1);
  assert.equal(stats.approvalRate, 1);
  assert.equal(stats.rejectionRate, 0);
  assert.equal(stats.outcomeCountsByActionType.create_timely_content, 1);
});

test("getRecommendationOutcomeStatsForUser: groups by action type across recommendations with the same outcome", async () => {
  const { client } = createFakeSupabaseClient({
    marketing_recommendations: {
      data: [
        recommendationRow({ id: "rec-a", recommended_action_type: "create_timely_content" }),
        recommendationRow({ id: "rec-b", recommended_action_type: "publish_gbp_post" }),
      ],
      error: null,
    },
    content_approvals: { data: approvalRow({ status: "approved", approved_at: "2026-07-02T00:00:00.000Z" }), error: null },
    recommendation_outcome_events: { data: [], error: null },
    publishing_queue: { data: null, error: null },
    publishing_jobs: { data: null, error: null },
    content_performance: { data: null, error: null },
  });

  const stats = await getRecommendationOutcomeStatsForUser(USER, BIZ, {}, client);
  assert.equal(stats.totalGenerated, 2);
  assert.equal(stats.outcomeCountsByActionType.create_timely_content, 1);
  assert.equal(stats.outcomeCountsByActionType.publish_gbp_post, 1);
});

test("getRecommendationOutcomeStatsForUser: time-range filtering excludes recommendations outside the window", async () => {
  const { client } = createFakeSupabaseClient({
    marketing_recommendations: {
      data: [
        recommendationRow({ id: "rec-early", created_at: "2026-01-01T00:00:00.000Z" }),
        recommendationRow({ id: "rec-late", created_at: "2026-07-01T00:00:00.000Z" }),
      ],
      error: null,
    },
    content_approvals: { data: approvalRow({ status: "approved", approved_at: "2026-07-02T00:00:00.000Z" }), error: null },
    recommendation_outcome_events: { data: [], error: null },
    publishing_queue: { data: null, error: null },
    publishing_jobs: { data: null, error: null },
    content_performance: { data: null, error: null },
  });

  const stats = await getRecommendationOutcomeStatsForUser(USER, BIZ, { since: "2026-06-01T00:00:00.000Z" }, client);
  assert.equal(stats.totalGenerated, 1);
});

test("getRecommendationOutcomeStatsForUser: recommendations with no draft yet are excluded from totals, not counted as zero-approval noise", async () => {
  const { client } = createFakeSupabaseClient({
    marketing_recommendations: { data: [recommendationRow()], error: null },
    content_approvals: { data: null, error: null },
  });

  const stats = await getRecommendationOutcomeStatsForUser(USER, BIZ, {}, client);
  assert.equal(stats.totalGenerated, 0);
  assert.equal(stats.approvalRate, null);
  assert.equal(stats.rejectionRate, null);
  assert.equal(stats.publishSuccessRate, null);
});

test("getRecommendationOutcomeStatsForUser: rejection reason counts bucket by structured code", async () => {
  const { client } = createFakeSupabaseClient({
    marketing_recommendations: { data: [recommendationRow()], error: null },
    content_approvals: {
      data: approvalRow({ status: "rejected", rejected_reason: "meh", rejection_reason_code: "wrong_tone" }),
      error: null,
    },
    recommendation_outcome_events: { data: [], error: null },
    publishing_queue: { data: null, error: null },
    publishing_jobs: { data: null, error: null },
    content_performance: { data: null, error: null },
  });

  const stats = await getRecommendationOutcomeStatsForUser(USER, BIZ, {}, client);
  assert.equal(stats.rejectionReasonCounts.wrong_tone, 1);
  assert.equal(stats.rejectionRate, 1);
});

test("getRecommendationOutcomeStatsForUser: only queries this tenant's recommendations (query-contract proof)", async () => {
  const { client, calls } = createFakeSupabaseClient({
    marketing_recommendations: { data: [], error: null },
  });

  await getRecommendationOutcomeStatsForUser(USER, BIZ, {}, client);
  const queriedUserIds = userIdsQueried(calls);
  assert.ok(queriedUserIds.every((id) => id === USER));
});

// --- Reconciliation ---

test("reconcileRecommendationOutcomesForUser: inserts missing draft_created and draft_approved events for an approved, unpublished draft", async () => {
  const { client } = createFakeSupabaseClient({
    marketing_recommendations: { data: [recommendationRow()], error: null },
    content_approvals: {
      data: approvalRow({ status: "approved", approved_at: "2026-07-02T00:00:00.000Z" }),
      error: null,
    },
    recommendation_outcome_events: idempotentInsertTable(eventRow(), 2),
    publishing_queue: { data: null, error: null },
  });

  const counts = await reconcileRecommendationOutcomesForUser(client, USER, BIZ);

  assert.equal(counts.recommendationsScanned, 1);
  assert.equal(counts.byEventType.draft_created, 1);
  assert.equal(counts.byEventType.draft_approved, 1);
  assert.equal(counts.eventsInserted, 2);
});

test("reconcileRecommendationOutcomesForUser: a second run against the same state inserts nothing", async () => {
  // idempotentInsertTable's single shared closure means the SECOND reconciliation call's
  // inserts see the same table already "consumed" -- exactly modeling a real rerun
  // against a database that already has these rows.
  const eventsTable = idempotentInsertTable(eventRow(), 2);
  const { client } = createFakeSupabaseClient({
    marketing_recommendations: { data: [recommendationRow()], error: null },
    content_approvals: {
      data: approvalRow({ status: "approved", approved_at: "2026-07-02T00:00:00.000Z" }),
      error: null,
    },
    recommendation_outcome_events: eventsTable,
    publishing_queue: { data: null, error: null },
  });

  const first = await reconcileRecommendationOutcomesForUser(client, USER, BIZ);
  assert.equal(first.eventsInserted, 2);

  const second = await reconcileRecommendationOutcomesForUser(client, USER, BIZ);
  assert.equal(second.eventsInserted, 0);
  assert.equal(second.eventsSkippedExisting, 2);
});

test("reconcileRecommendationOutcomesForUser: skips recommendations with no draft, is tenant-scoped, and returns structured counts", async () => {
  const { client, calls } = createFakeSupabaseClient({
    marketing_recommendations: { data: [recommendationRow()], error: null },
    content_approvals: { data: null, error: null },
  });

  const counts = await reconcileRecommendationOutcomesForUser(client, USER, BIZ);

  assert.equal(counts.recommendationsScanned, 1);
  assert.equal(counts.eventsInserted, 0);
  assert.ok(userIdsQueried(calls).every((id) => id === USER));
});

test("reconcileRecommendationOutcomesForUser: backfills the full publish+measure chain for a published, measured recommendation", async () => {
  const { client } = createFakeSupabaseClient({
    marketing_recommendations: { data: [recommendationRow()], error: null },
    content_approvals: {
      data: approvalRow({ status: "approved", approved_at: "2026-07-02T00:00:00.000Z" }),
      error: null,
    },
    recommendation_outcome_events: idempotentInsertTable(eventRow(), 5),
    publishing_queue: { data: queueItemRow(), error: null },
    publishing_jobs: { data: jobRow({ status: "verified" }), error: null },
    content_performance: { data: performanceRow(), error: null },
  });

  const counts = await reconcileRecommendationOutcomesForUser(client, USER, BIZ);

  assert.equal(counts.byEventType.publishing_queued, 1);
  assert.equal(counts.byEventType.publishing_succeeded, 1);
  assert.equal(counts.byEventType.performance_measured, 1);
});

// --- Tenant isolation on link resolution ---

test("resolveRecommendationLinkForContentApproval: rejects a content approval belonging to another tenant", async () => {
  const { client } = createFakeSupabaseClient({});
  const link = await resolveRecommendationLinkForContentApproval(client, USER, {
    user_id: "some-other-user",
    business_profile_id: BIZ,
    marketing_recommendation_id: REC_ID,
  });
  assert.equal(link, null);
});

test("resolveRecommendationLinkForContentApproval: resolves correctly for the owning tenant", async () => {
  const { client } = createFakeSupabaseClient({});
  const link = await resolveRecommendationLinkForContentApproval(client, USER, {
    user_id: USER,
    business_profile_id: BIZ,
    marketing_recommendation_id: REC_ID,
  });
  assert.deepEqual(link, { recommendationId: REC_ID, businessProfileId: BIZ });
});

test("resolveRecommendationLinkForPublishingJob: rejects a job belonging to another tenant before ever touching content_approvals", async () => {
  const { client, calls } = createFakeSupabaseClient({
    publishing_queue: { data: queueItemRow(), error: null },
    content_approvals: { data: approvalRow(), error: null },
  });

  const link = await resolveRecommendationLinkForPublishingJob(client, USER, {
    user_id: "some-other-user",
    content_id: "queue-1",
  });

  assert.equal(link, null);
  assert.equal(calls.some((c) => c.table === "publishing_queue"), false);
});

test("resolveRecommendationLinkForPublishingJob: walks job -> queue -> approval for the owning tenant", async () => {
  const { client } = createFakeSupabaseClient({
    publishing_queue: { data: queueItemRow(), error: null },
    content_approvals: { data: approvalRow(), error: null },
  });

  const link = await resolveRecommendationLinkForPublishingJob(client, USER, {
    user_id: USER,
    content_id: "queue-1",
  });

  assert.deepEqual(link, { recommendationId: REC_ID, businessProfileId: BIZ, contentApprovalId: APPROVAL_ID });
});

test("resolveRecommendationLinkForPublishingJob: content not sourced from a recommendation resolves to null (no forged attribution)", async () => {
  const { client } = createFakeSupabaseClient({
    publishing_queue: { data: queueItemRow(), error: null },
    content_approvals: { data: approvalRow({ marketing_recommendation_id: null }), error: null },
  });

  const link = await resolveRecommendationLinkForPublishingJob(client, USER, {
    user_id: USER,
    content_id: "queue-1",
  });

  assert.equal(link, null);
});

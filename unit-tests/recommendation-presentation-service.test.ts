import test from "node:test";
import assert from "node:assert/strict";
import {
  getRecommendationDecisionPackageForCurrentUser,
  getRecommendationDecisionPackageForUser,
  getRecommendationDecisionPackagesForApprovals,
} from "../lib/recommendation-presentation/service.ts";
import { createFakeSupabaseClient, userIdsQueried } from "./support/fake-supabase-client.ts";

const USER = "user-1";
const BIZ = "biz-1";
const REC_ID = "rec-1";
const APPROVAL_ID = "approval-1";

function recommendationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: REC_ID,
    user_id: USER,
    business_profile_id: BIZ,
    recommended_action_type: "create_timely_content",
    priority_score: 61.5,
    urgency: "medium",
    business_impact: "medium",
    estimated_effort: "medium",
    confidence: 70,
    reasoning: "A local holiday is coming up.",
    related_opportunity_ids: ["opp-1"],
    status: "in_progress",
    created_at: "2026-01-15T10:00:00.000Z",
    updated_at: "2026-01-15T10:00:00.000Z",
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
    title: "Independence Day weekend",
    description: "Local holiday demand spike.",
    evidence: {},
    recommended_action: "Create timely content",
    expires_at: null,
    status: "open",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function approvalRow(overrides: Record<string, unknown> = {}) {
  return {
    id: APPROVAL_ID,
    user_id: USER,
    business_profile_id: BIZ,
    content_type: "Google Business Profile Post",
    title: "Holiday Weekend Ready",
    content: "Book your holiday service visit today.",
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
    created_at: "2026-01-15T10:30:00.000Z",
    updated_at: "2026-01-15T10:30:00.000Z",
    ...overrides,
  };
}

function buildPackageClient(opts?: {
  recommendation?: Record<string, unknown> | null;
  opportunity?: Record<string, unknown>;
  approval?: Record<string, unknown> | null;
  events?: Record<string, unknown>[];
  job?: Record<string, unknown> | null;
}) {
  const recommendation = opts?.recommendation === undefined ? recommendationRow() : opts.recommendation;

  return createFakeSupabaseClient({
    marketing_recommendations: (op) =>
      op === "then" ? { data: recommendation ? [recommendation] : [], error: null } : { data: recommendation, error: null },
    marketing_opportunities: { data: [opts?.opportunity ?? opportunityRow()], error: null },
    content_approvals: (op) => {
      if (op === "maybeSingle") return { data: opts?.approval === undefined ? approvalRow() : opts.approval, error: null };
      return { data: null, error: null };
    },
    recommendation_outcome_events: { data: opts?.events ?? [], error: null },
    publishing_queue: {
      data: opts?.job === undefined ? null : { id: "queue-1", user_id: USER, business_profile_id: BIZ, content_approval_id: APPROVAL_ID },
      error: null,
    },
    publishing_jobs: { data: opts?.job === undefined ? null : opts.job, error: null },
    content_performance: { data: null, error: null },
  });
}

test("getRecommendationDecisionPackageForUser: returns null for a nonexistent/cross-tenant recommendation", async () => {
  const { client } = buildPackageClient({ recommendation: null });
  const result = await getRecommendationDecisionPackageForUser(USER, REC_ID, client);
  assert.equal(result, null);
});

test("getRecommendationDecisionPackageForUser: returns a fully-populated, client-safe package", async () => {
  const { client } = buildPackageClient();
  const pkg = await getRecommendationDecisionPackageForUser(USER, REC_ID, client);

  assert.ok(pkg);
  assert.equal(pkg!.recommendationId, REC_ID);
  assert.equal(pkg!.contentApprovalId, APPROVAL_ID);
  assert.equal(pkg!.title, "Holiday Weekend Ready");
  assert.equal(pkg!.recommendedAction, "Create timely content");
  assert.equal(pkg!.whyNow, "A local holiday is coming up.");
  assert.ok(pkg!.supportingReasons.length > 0);
  assert.ok(pkg!.expectedBenefit.length > 0);
  assert.ok(["strong_recommendation", "good_opportunity", "worth_considering", "still_learning"].includes(pkg!.confidenceLabel));
  assert.equal(pkg!.generatedDraft?.contentApprovalId, APPROVAL_ID);
  assert.equal(pkg!.platform, "google_business_profile");
  assert.equal(pkg!.contentType, "Google Business Profile Post");
  assert.equal(pkg!.approvalStatus, "pending");
  assert.deepEqual(pkg!.clientActions.sort(), ["approve", "edit", "more_like_this", "reject"].sort());
  assert.equal(pkg!.sourceContext.categories.includes("holiday"), true);
});

test("getRecommendationDecisionPackageForUser: never includes internal score arithmetic or raw scoring fields", async () => {
  const { client } = buildPackageClient();
  const pkg = await getRecommendationDecisionPackageForUser(USER, REC_ID, client);
  const serialized = JSON.stringify(pkg);

  for (const forbiddenKey of ["baseScore", "historicalAdjustment", "finalScore", "reasonWeight", "historicalConfidence", "confidenceInHistory"]) {
    assert.equal(serialized.includes(forbiddenKey), false, `package must never include "${forbiddenKey}"`);
  }
});

test("getRecommendationDecisionPackageForUser: cold start (zero history) resolves to the 'still learning' confidence label", async () => {
  const { client } = buildPackageClient();
  const pkg = await getRecommendationDecisionPackageForUser(USER, REC_ID, client);
  assert.equal(pkg!.confidenceLabel, "still_learning");
});

test("getRecommendationDecisionPackageForUser: a provider publishing failure presents as an operational issue, not a recommendation-quality failure", async () => {
  const { client } = buildPackageClient({
    approval: approvalRow({ status: "approved", approved_at: "2026-01-16T00:00:00.000Z" }),
    job: { id: "job-1", user_id: USER, status: "failed", published_at: null, last_error: "Please reconnect your OAuth connection" },
  });

  const pkg = await getRecommendationDecisionPackageForUser(USER, REC_ID, client);

  assert.equal(pkg!.outcomeStatus.label, "Publishing needs attention");
  assert.equal(pkg!.outcomeStatus.isOperationalIssue, true);
  assert.match(pkg!.outcomeStatus.detail ?? "", /does not affect the quality/i);
  assert.equal(JSON.stringify(pkg).includes("OAuth"), false);
});

test("getRecommendationDecisionPackageForUser: no linked draft yet -> generatedDraft is null, no approve/reject/edit actions", async () => {
  const { client } = buildPackageClient({ approval: null });
  const pkg = await getRecommendationDecisionPackageForUser(USER, REC_ID, client);

  assert.equal(pkg!.generatedDraft, null);
  assert.deepEqual(pkg!.clientActions, []);
});

test("getRecommendationDecisionPackageForUser: only queries this tenant's data (query-contract proof)", async () => {
  const { client, calls } = buildPackageClient();
  await getRecommendationDecisionPackageForUser(USER, REC_ID, client);

  const queriedUserIds = userIdsQueried(calls);
  assert.ok(queriedUserIds.length > 0);
  assert.ok(queriedUserIds.every((id) => id === USER));
});

test("getRecommendationDecisionPackageForCurrentUser requires cookies exactly like every other *ForCurrentUser wrapper", async () => {
  await assert.rejects(
    () => getRecommendationDecisionPackageForCurrentUser(REC_ID),
    /next\/headers\.cookies\(\) called outside a Next\.js request context/
  );
});

// --- Batch variant for the Approval Center ---

test("getRecommendationDecisionPackagesForApprovals: builds a package keyed by content_approval_id for recommendation-linked approvals only", async () => {
  const manualApproval = approvalRow({ id: "approval-manual", marketing_recommendation_id: null });
  const { client } = createFakeSupabaseClient({
    marketing_recommendations: (op) =>
      op === "then" ? { data: [recommendationRow()], error: null } : { data: recommendationRow(), error: null },
    marketing_opportunities: { data: [opportunityRow()], error: null },
    content_approvals: (op) => (op === "maybeSingle" ? { data: null, error: null } : { data: null, error: null }),
    recommendation_outcome_events: { data: [], error: null },
    publishing_queue: { data: null, error: null },
    publishing_jobs: { data: null, error: null },
    content_performance: { data: null, error: null },
  });

  const packages = await getRecommendationDecisionPackagesForApprovals(
    USER,
    BIZ,
    [approvalRow(), manualApproval],
    client
  );

  assert.equal(packages.size, 1);
  assert.ok(packages.has(APPROVAL_ID));
  assert.equal(packages.has("approval-manual"), false);
});

test("getRecommendationDecisionPackagesForApprovals: no recommendation-linked approvals at all -> empty map, no queries attempted", async () => {
  const { client, calls } = createFakeSupabaseClient({});
  const manualApproval = approvalRow({ id: "approval-manual", marketing_recommendation_id: null });

  const packages = await getRecommendationDecisionPackagesForApprovals(USER, BIZ, [manualApproval], client);

  assert.equal(packages.size, 0);
  assert.equal(calls.length, 0);
});

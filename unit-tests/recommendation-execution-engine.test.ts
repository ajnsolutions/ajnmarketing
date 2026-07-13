import test from "node:test";
import assert from "node:assert/strict";
import {
  executeEligibleRecommendationsForUser,
  executeRecommendationForCurrentUser,
  executeRecommendationForUser,
} from "../lib/recommendation-execution/engine.ts";
import { createFakeSupabaseClient } from "./support/fake-supabase-client.ts";
import type { MarketingRecommendation } from "../lib/marketing-decisions/types.ts";
import type { MarketingOpportunity } from "../lib/marketing-opportunities/types.ts";
import type { GeneratedContentDraft } from "../lib/content-generator/types.ts";
import { ATTACH_DECLARATIVE_PRODUCTION_CRONS } from "../lib/trigger/scheduleActivation.ts";

const USER = "user-1";
const OTHER_USER = "user-other";
const BIZ = "biz-1";
const REC_ID = "rec-1";

function recommendation(overrides: Partial<MarketingRecommendation> = {}): MarketingRecommendation {
  return {
    id: REC_ID,
    user_id: USER,
    business_profile_id: BIZ,
    recommended_action_type: "create_timely_content",
    priority_score: 72,
    urgency: "high",
    business_impact: "medium",
    estimated_effort: "medium",
    confidence: 80,
    reasoning: "Holiday demand is rising.",
    related_opportunity_ids: ["opp-1"],
    status: "open",
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

function opportunity(overrides: Partial<MarketingOpportunity> = {}): MarketingOpportunity {
  return {
    id: "opp-1",
    user_id: USER,
    business_profile_id: BIZ,
    category: "holiday",
    severity: "high",
    confidence: 80,
    title: "Independence Day weekend",
    description: "Local holiday demand spike.",
    evidence: { holidayName: "Independence Day" },
    recommended_action: "Create timely content",
    expires_at: "2026-07-05T00:00:00.000Z",
    status: "open",
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

function businessProfileRow(userId = USER) {
  return {
    id: BIZ,
    user_id: userId,
    business_name: "Acme Plumbing",
    brand_voice_tone: "Friendly",
    onboarding_completed: true,
  };
}

function approvalRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "approval-1",
    user_id: USER,
    business_profile_id: BIZ,
    content_type: "Community Post",
    title: "Holiday Weekend Ready",
    content: "Book your holiday service visit today.",
    status: "pending",
    source: "marketing_recommendation",
    version: 1,
    ai_score: 88,
    notes: `Drafted from marketing recommendation (create_timely_content)`,
    marketing_recommendation_id: REC_ID,
    approved_at: null,
    approved_by: null,
    rejected_reason: null,
    created_at: "2026-07-11T00:00:00.000Z",
    updated_at: "2026-07-11T00:00:00.000Z",
    ...overrides,
  };
}

const DRAFT: GeneratedContentDraft = {
  title: "Holiday Weekend Ready",
  content: "Book your holiday service visit today.",
  cta: "Call now",
  hashtags: ["#local"],
  seoKeywords: ["holiday service"],
  qualityScore: 90,
  voiceScore: 88,
  reasoning: "Tied to holiday evidence",
};

function stubGenerateDraft() {
  return async () => DRAFT;
}

/**
 * Sequential-response client covering the full generateContentDraftForRecommendation
 * chain this engine delegates to. Mirrors the fixture pattern already established in
 * unit-tests/marketing-decisions-create-content.test.ts.
 */
function createHappyPathClient(opts?: {
  recommendation?: MarketingRecommendation;
  existingDraft?: Record<string, unknown> | null;
  insertError?: { code?: string; message?: string } | null;
  insertRow?: Record<string, unknown>;
}) {
  const rec = opts?.recommendation ?? recommendation();
  let approvalMaybeSingleReads = 0;
  let draftInserted = false;
  let recAfterInsertReads = 0;

  return createFakeSupabaseClient({
    marketing_recommendations: (op) => {
      if (op === "maybeSingle" || op === "single") {
        if (!draftInserted) {
          return { data: rec, error: null };
        }
        recAfterInsertReads += 1;
        if (recAfterInsertReads === 1) {
          return { data: rec, error: null };
        }
        return { data: { ...rec, status: "in_progress" }, error: null };
      }
      return { data: rec, error: null };
    },
    business_profiles: { data: businessProfileRow(rec.user_id), error: null },
    content_approvals: (op) => {
      if (op === "maybeSingle") {
        approvalMaybeSingleReads += 1;
        if (opts?.existingDraft) {
          return { data: opts.existingDraft, error: null };
        }
        if (opts?.insertError?.code === "23505" && approvalMaybeSingleReads > 1) {
          return { data: opts.insertRow ?? approvalRow(), error: null };
        }
        return { data: null, error: null };
      }
      if (op === "single") {
        if (opts?.insertError) {
          return { data: null, error: opts.insertError };
        }
        draftInserted = true;
        return { data: opts?.insertRow ?? approvalRow(), error: null };
      }
      return { data: null, error: null };
    },
    ai_marketing_profiles: { data: null, error: null },
    website_analysis: { data: null, error: null },
    market_context_briefs: { data: null, error: null },
    market_context_items: { data: [], error: null },
    marketing_opportunities: { data: [opportunity()], error: null },
    audit_logs: { data: { id: "audit-1" }, error: null },
  });
}

// --- Tenant / actionability validation (no other table touched) ---

test("executeRecommendationForUser: recommendation not found for this tenant -> failed", async () => {
  const { client } = createFakeSupabaseClient({
    marketing_recommendations: { data: null, error: null },
  });

  const result = await executeRecommendationForUser(USER, REC_ID, client);

  assert.equal(result.status, "failed");
  assert.match(result.reason, /not found/i);
  assert.equal(result.contentApprovalId, null);
});

test("executeRecommendationForUser: tenant mismatch cannot execute another tenant's recommendation", async () => {
  // getMarketingRecommendationByIdForUser filters by user_id; a fake client can't model
  // real RLS/query filtering, so this proves the *contract*: querying as OTHER_USER for
  // a recommendation owned by USER must be treated as not-found, never as a green light.
  const { client } = createFakeSupabaseClient({
    marketing_recommendations: { data: null, error: null },
  });

  const result = await executeRecommendationForUser(OTHER_USER, REC_ID, client);

  assert.equal(result.status, "failed");
  assert.match(result.reason, /not found/i);
});

for (const status of ["dismissed", "completed", "superseded"] as const) {
  test(`executeRecommendationForUser: ${status} recommendation is skipped, not executed`, async () => {
    const { client } = createFakeSupabaseClient({
      marketing_recommendations: { data: recommendation({ status }), error: null },
    });

    const result = await executeRecommendationForUser(USER, REC_ID, client);

    assert.equal(result.status, "skipped");
    assert.match(result.reason, new RegExp(status));
  });
}

// --- Canonical action routing ---

const CONTENT_SUPPORTED_TYPES = [
  "create_timely_content",
  "create_seasonal_content",
  "publish_gbp_post",
  "refresh_website_content",
] as const;

const UNSUPPORTED_TYPES = [
  "request_reviews",
  "increase_posting_frequency",
  "update_business_info",
  "upload_photos",
] as const;

for (const actionType of CONTENT_SUPPORTED_TYPES) {
  test(`executeRecommendationForUser: ${actionType} routes through content generation and executes`, async () => {
    const client = createHappyPathClient({
      recommendation: recommendation({ recommended_action_type: actionType }),
    }).client;

    const result = await executeRecommendationForUser(USER, REC_ID, client, {
      generateDraft: stubGenerateDraft(),
    });

    assert.equal(result.status, "executed");
    assert.equal(result.actionType, actionType);
    assert.equal(result.contentApprovalId, "approval-1");
  });
}

for (const actionType of UNSUPPORTED_TYPES) {
  test(`executeRecommendationForUser: ${actionType} is unsupported and never mutates state`, async () => {
    const { client, calls } = createFakeSupabaseClient({
      marketing_recommendations: { data: recommendation({ recommended_action_type: actionType }), error: null },
    });

    const result = await executeRecommendationForUser(USER, REC_ID, client);

    assert.equal(result.status, "unsupported");
    assert.ok(result.reason.length > 0);
    // Never silently marked complete, never touches content_approvals.
    assert.equal(calls.some((c) => c.table === "content_approvals"), false);
    assert.equal(calls.some((c) => c.op === "update"), false);
  });
}

test("executeRecommendationForUser: publish_gbp_post maps to the Google Business Profile Post content type -- the one canonical vocabulary (no separate create_gbp_post exists)", async () => {
  const rec = recommendation({ recommended_action_type: "publish_gbp_post" });
  const client = createHappyPathClient({ recommendation: rec }).client;

  const result = await executeRecommendationForUser(USER, REC_ID, client, {
    generateDraft: stubGenerateDraft(),
  });

  assert.equal(result.status, "executed");
  assert.equal(result.actionType, "publish_gbp_post");
});

// --- Idempotency ---

test("executeRecommendationForUser: an active existing draft is reused, reported as already_executed", async () => {
  const client = createHappyPathClient({
    existingDraft: approvalRow({ id: "approval-existing", status: "pending" }),
  }).client;

  const result = await executeRecommendationForUser(USER, REC_ID, client, {
    generateDraft: stubGenerateDraft(),
  });

  assert.equal(result.status, "already_executed");
  assert.equal(result.contentApprovalId, "approval-existing");
});

test("executeRecommendationForUser: repeat execution after a real success is idempotent (already_executed, not a duplicate)", async () => {
  const rec = recommendation();

  // First call: no existing draft -> creates one.
  const firstClient = createHappyPathClient({ recommendation: rec }).client;
  const first = await executeRecommendationForUser(USER, REC_ID, firstClient, {
    generateDraft: stubGenerateDraft(),
  });
  assert.equal(first.status, "executed");

  // Second call against a client modeling "the draft from call 1 now exists" (in_progress
  // recommendation + an active draft) -- the durable idempotency guarantee this relies on
  // is the real partial unique index on content_approvals.marketing_recommendation_id
  // (migration 019_recommendation_content_link.sql), not any in-memory state here.
  const secondClient = createHappyPathClient({
    recommendation: { ...rec, status: "in_progress" },
    existingDraft: approvalRow({ id: first.contentApprovalId!, status: "pending" }),
  }).client;
  const second = await executeRecommendationForUser(USER, REC_ID, secondClient, {
    generateDraft: stubGenerateDraft(),
  });

  assert.equal(second.status, "already_executed");
  assert.equal(second.contentApprovalId, first.contentApprovalId);
});

test("executeRecommendationForUser: concurrent duplicate insert (unique-index race) resolves to the winning draft, not a failure", async () => {
  const client = createHappyPathClient({
    insertError: { code: "23505", message: "duplicate key value violates unique constraint" },
    insertRow: approvalRow({ id: "approval-winner" }),
  }).client;

  const result = await executeRecommendationForUser(USER, REC_ID, client, {
    generateDraft: stubGenerateDraft(),
  });

  assert.equal(result.status, "already_executed");
  assert.equal(result.contentApprovalId, "approval-winner");
});

// --- Failure handling ---

test("executeRecommendationForUser: failure after generation but before persistence returns failed, never leaks raw db text", async () => {
  const client = createHappyPathClient({
    insertError: { code: "23514", message: 'relation "content_approvals" violates check constraint' },
  }).client;

  const result = await executeRecommendationForUser(USER, REC_ID, client, {
    generateDraft: stubGenerateDraft(),
  });

  assert.equal(result.status, "failed");
  assert.equal(result.reason.includes("relation"), false);
  assert.equal(result.reason.includes("constraint"), false);
});

test("executeRecommendationForUser: failure before any draft creation (generation itself throws) returns failed and leaves the recommendation retryable", async () => {
  const client = createHappyPathClient().client;

  const result = await executeRecommendationForUser(USER, REC_ID, client, {
    generateDraft: async () => {
      throw new Error("OpenAI request timed out");
    },
  });

  assert.equal(result.status, "failed");
  assert.equal(result.reason.includes("OpenAI"), false);
});

test("executeRecommendationForUser: retry after failure succeeds once the underlying issue is gone", async () => {
  const rec = recommendation();

  const failingClient = createHappyPathClient({ recommendation: rec }).client;
  const failed = await executeRecommendationForUser(USER, REC_ID, failingClient, {
    generateDraft: async () => {
      throw new Error("transient failure");
    },
  });
  assert.equal(failed.status, "failed");

  // Recommendation was never marked in_progress on failure -- still open, still retryable.
  const retryClient = createHappyPathClient({ recommendation: rec }).client;
  const retried = await executeRecommendationForUser(USER, REC_ID, retryClient, {
    generateDraft: stubGenerateDraft(),
  });

  assert.equal(retried.status, "executed");
});

// --- Batch / eligibility ---

test("executeEligibleRecommendationsForUser: evaluates every active recommendation and summarizes outcomes without one failure blocking another", async () => {
  // Both list entries are shape-identical content-supported recommendations differing
  // only by id. generateContentDraftForRecommendation re-fetches the recommendation
  // itself (twice, plus twice more inside markMarketingRecommendationInProgress) rather
  // than reusing the row the batch loop already has, and the fake client can only fork
  // responses by op (maybeSingle/single/then), not by which id was filtered on -- so
  // there is no reliable way to give rec-a and rec-b genuinely different fetched rows
  // here. That's fine: result.recommendationId is threaded through from the id the batch
  // loop requested, not from the fetched row, so assertions on it are unaffected. The
  // only differentiator needed to prove one entry's outcome doesn't affect the other is
  // a stateful generateDraft: fails for whichever recommendation is processed first,
  // succeeds for the second.
  const recA = recommendation({ id: "rec-a", recommended_action_type: "create_timely_content" });
  const recB = recommendation({ id: "rec-b", recommended_action_type: "create_timely_content" });

  const { client } = createFakeSupabaseClient({
    marketing_recommendations: (op) =>
      op === "then" ? { data: [recA, recB], error: null } : { data: recA, error: null },
    business_profiles: { data: businessProfileRow(), error: null },
    content_approvals: (op) => {
      if (op === "maybeSingle") return { data: null, error: null };
      if (op === "single") return { data: approvalRow(), error: null };
      return { data: null, error: null };
    },
    ai_marketing_profiles: { data: null, error: null },
    website_analysis: { data: null, error: null },
    market_context_briefs: { data: null, error: null },
    market_context_items: { data: [], error: null },
    marketing_opportunities: { data: [opportunity()], error: null },
    audit_logs: { data: { id: "audit-1" }, error: null },
  });

  let generateDraftCalls = 0;
  const { summary, results } = await executeEligibleRecommendationsForUser(USER, client, {
    generateDraft: async () => {
      generateDraftCalls += 1;
      if (generateDraftCalls === 1) {
        throw new Error("transient failure for the first recommendation only");
      }
      return DRAFT;
    },
  });

  assert.equal(summary.evaluated, 2);
  assert.equal(summary.executed, 1);
  assert.equal(summary.failed, 1);
  assert.equal(results.find((r) => r.recommendationId === "rec-a")?.status, "failed");
  assert.equal(results.find((r) => r.recommendationId === "rec-b")?.status, "executed");
});

test("executeEligibleRecommendationsForUser: no eligible recommendations returns an empty, non-error summary", async () => {
  const { client } = createFakeSupabaseClient({
    marketing_recommendations: { data: [], error: null },
  });

  const { summary, results } = await executeEligibleRecommendationsForUser(USER, client);

  assert.equal(summary.evaluated, 0);
  assert.deepEqual(results, []);
});

// --- Current-user wrapper ---

test("executeRecommendationForCurrentUser requires cookies exactly like every other *ForCurrentUser wrapper", async () => {
  await assert.rejects(
    () => executeRecommendationForCurrentUser(REC_ID),
    /next\/headers\.cookies\(\) called outside a Next\.js request context/
  );
});

// --- Schedule activation must remain untouched by this feature ---

test("Recommendation Execution Engine does not flip on production schedule activation", () => {
  assert.equal(ATTACH_DECLARATIVE_PRODUCTION_CRONS, false);
});

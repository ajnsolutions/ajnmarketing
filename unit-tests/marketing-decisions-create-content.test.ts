import test from "node:test";
import assert from "node:assert/strict";
import {
  generateContentDraftForRecommendation,
  generateContentDraftForRecommendationForCurrentUser,
} from "../lib/marketing-decisions/create-content.ts";
import { buildRecommendationContentPrompt } from "../lib/marketing-decisions/content-prompt.ts";
import {
  isContentSupportedActionType,
  mapActionTypeToContentTarget,
} from "../lib/marketing-decisions/actionTypeContentMapping.ts";
import { createFakeSupabaseClient, userIdsQueried } from "./support/fake-supabase-client.ts";
import type { MarketingRecommendation } from "../lib/marketing-decisions/types.ts";
import type { MarketingOpportunity } from "../lib/marketing-opportunities/types.ts";
import type { ContentGenerationContext } from "../lib/content-generator/types.ts";
import type { GeneratedContentDraft } from "../lib/content-generator/types.ts";

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
    reasoning: "Holiday and local event both point to timely content now.",
    related_opportunity_ids: ["opp-1", "opp-2"],
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
    confidence: 85,
    title: "Independence Day weekend",
    description: "Local holiday demand spike expected.",
    evidence: { holidayName: "Independence Day", signal: "calendar" },
    recommended_action: "Create timely promotional content",
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
    voice_notes: "Warm and helpful",
    preferred_words: "reliable, local",
    avoid_words: "cheap",
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
    notes: `Created from marketing recommendation ${REC_ID}`,
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
  content: "Book your holiday service visit today with Acme Plumbing.",
  cta: "Call now",
  hashtags: ["#local"],
  seoKeywords: ["holiday plumbing"],
  qualityScore: 90,
  voiceScore: 88,
  reasoning: "Tied to holiday evidence",
};

function stubGenerateDraft() {
  return async () => DRAFT;
}

/**
 * Sequential fixtures for the happy-path create flow:
 * 1) recommendation maybeSingle
 * 2) business_profiles maybeSingle
 * 3) content_approvals active-draft maybeSingle (none)
 * 4) ai/website/market context loads (various)
 * 5) opportunities by ids
 * 6) content_approvals insert single
 * 7) recommendation status update maybeSingle
 * 8) audit inserts
 */
function createHappyPathClient(opts?: {
  recommendation?: MarketingRecommendation;
  existingDraft?: Record<string, unknown> | null;
  insertError?: { code?: string; message?: string } | null;
  insertRow?: Record<string, unknown>;
  opportunities?: MarketingOpportunity[];
}) {
  const rec = opts?.recommendation ?? recommendation();
  let approvalMaybeSingleReads = 0;
  let draftInserted = false;
  let recommendationMaybeAfterInsert = 0;

  return createFakeSupabaseClient({
    marketing_recommendations: (op) => {
      if (op === "maybeSingle" || op === "single") {
        if (!draftInserted) {
          return { data: rec, error: null };
        }
        recommendationMaybeAfterInsert += 1;
        // markInProgress: first read must still see open so the update runs;
        // the post-update terminal returns in_progress.
        if (recommendationMaybeAfterInsert === 1) {
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
        // First: no active draft. After unique violation: return winning draft.
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
    marketing_opportunities: {
      data: opts?.opportunities ?? [
        opportunity({ id: "opp-1" }),
        opportunity({
          id: "opp-2",
          category: "local_event",
          title: "Downtown festival",
          evidence: { eventName: "Downtown festival" },
        }),
      ],
      error: null,
    },
    audit_logs: { data: { id: "audit-1" }, error: null },
  });
}

test("isContentSupportedActionType: supports only the approved content action types", () => {
  assert.equal(isContentSupportedActionType("create_timely_content"), true);
  assert.equal(isContentSupportedActionType("create_seasonal_content"), true);
  assert.equal(isContentSupportedActionType("publish_gbp_post"), true);
  assert.equal(isContentSupportedActionType("refresh_website_content"), true);
  assert.equal(isContentSupportedActionType("request_reviews"), false);
  assert.equal(isContentSupportedActionType("upload_photos"), false);
  assert.equal(isContentSupportedActionType("update_business_info"), false);
  assert.equal(isContentSupportedActionType("increase_posting_frequency"), false);
});

test("mapActionTypeToContentTarget: publish_gbp_post maps to GBP post", () => {
  const target = mapActionTypeToContentTarget("publish_gbp_post");
  assert.equal(target.contentType, "Google Business Profile Post");
  assert.equal(target.targetPlatform, "Google Business Profile");
});

test("buildRecommendationContentPrompt: includes reasoning, evidence, brand voice, market context, urgency, expiration, platform", () => {
  const context: ContentGenerationContext = {
    businessProfile: businessProfileRow() as ContentGenerationContext["businessProfile"],
    aiMarketingProfile: {
      brand_voice: "Warm neighborly voice",
      tone: "Friendly",
    } as ContentGenerationContext["aiMarketingProfile"],
    websiteAnalysis: null,
    marketContextSummary: {
      weekLabel: "Jul 7–13",
      overallSummary: "Strong local demand signals",
      recommendedTopics: ["holiday prep"],
      highOpportunityKeywords: ["holiday service"],
      contentAngles: ["timely offers"],
      topSignals: [],
      localEventSignals: [],
      competitorSignals: [],
    },
    analyticsFeedback: null,
  };

  const { user } = buildRecommendationContentPrompt(context, {
    recommendation: recommendation(),
    opportunities: [
      opportunity(),
      opportunity({
        id: "opp-2",
        category: "local_event",
        evidence: { eventName: "Downtown festival" },
      }),
    ],
    target: mapActionTypeToContentTarget("create_timely_content"),
  });

  assert.match(user, /MARKETING RECOMMENDATION/);
  assert.match(user, /Holiday and local event/);
  assert.match(user, /Independence Day/);
  assert.match(user, /Downtown festival/);
  assert.match(user, /Warm neighborly voice/);
  assert.match(user, /Strong local demand signals/);
  assert.match(user, /"urgency": "high"/);
  assert.match(user, /2026-07-05/);
  assert.match(user, /Google Business Profile \/ Social/);
  assert.match(user, /BUSINESS INTELLIGENCE/);
});

test("ownership: recommendation belonging to another user is not found", async () => {
  const { client, calls } = createFakeSupabaseClient({
    marketing_recommendations: { data: null, error: null },
  });

  const { result, error } = await generateContentDraftForRecommendation(
    USER,
    REC_ID,
    client,
    { generateDraft: stubGenerateDraft() }
  );

  assert.equal(result, null);
  assert.match(error ?? "", /not found/i);
  assert.deepEqual(userIdsQueried(calls), [USER]);
  assert.equal(calls.some((c) => c.op === "update"), false);
});

test("unsupported action type fails clearly and does not change recommendation state", async () => {
  const rec = recommendation({ recommended_action_type: "request_reviews" });
  const { client, calls } = createFakeSupabaseClient({
    marketing_recommendations: { data: rec, error: null },
    business_profiles: { data: businessProfileRow(), error: null },
  });

  const { result, error } = await generateContentDraftForRecommendation(
    USER,
    REC_ID,
    client,
    { generateDraft: stubGenerateDraft() }
  );

  assert.equal(result, null);
  assert.match(error ?? "", /does not support content drafting/);
  assert.equal(calls.some((c) => c.table === "marketing_recommendations" && c.op === "update"), false);
  assert.equal(calls.some((c) => c.table === "content_approvals" && c.op === "insert"), false);
});

test("dismissed recommendation cannot be drafted and state is preserved", async () => {
  const { client, calls } = createFakeSupabaseClient({
    marketing_recommendations: {
      data: recommendation({ status: "dismissed" }),
      error: null,
    },
  });

  const { result, error } = await generateContentDraftForRecommendation(
    USER,
    REC_ID,
    client,
    { generateDraft: stubGenerateDraft() }
  );

  assert.equal(result, null);
  assert.match(error ?? "", /dismissed/);
  assert.equal(calls.some((c) => c.op === "update"), false);
});

test("duplicate generation returns existing pending draft without regenerating", async () => {
  let generateCalls = 0;
  const existing = approvalRow({ status: "pending" });
  const { client } = createHappyPathClient({ existingDraft: existing });

  const { result, error } = await generateContentDraftForRecommendation(
    USER,
    REC_ID,
    client,
    {
      generateDraft: async () => {
        generateCalls += 1;
        return DRAFT;
      },
    }
  );

  assert.equal(error, undefined);
  assert.equal(result?.reused, true);
  assert.equal(result?.contentApproval.id, "approval-1");
  assert.equal(generateCalls, 0);
});

test("rejected draft allows regeneration", async () => {
  // Active draft lookup returns null (rejected drafts excluded by query).
  const { client, calls } = createHappyPathClient({ existingDraft: null });

  const { result, error } = await generateContentDraftForRecommendation(
    USER,
    REC_ID,
    client,
    { generateDraft: stubGenerateDraft() }
  );

  assert.equal(error, undefined);
  assert.equal(result?.reused, false);
  assert.equal(result?.contentApproval.status, "pending");
  assert.equal(result?.recommendation.status, "in_progress");
  assert.equal(calls.some((c) => c.table === "content_approvals" && c.op === "insert"), true);
});

test("recommendation moves to in_progress only after successful draft insert", async () => {
  const { client, calls } = createHappyPathClient();

  const { result } = await generateContentDraftForRecommendation(USER, REC_ID, client, {
    generateDraft: stubGenerateDraft(),
  });

  assert.equal(result?.recommendation.status, "in_progress");

  const insertIndex = calls.findIndex((c) => c.table === "content_approvals" && c.op === "insert");
  const updateIndex = calls.findIndex((c) => c.table === "marketing_recommendations" && c.op === "update");
  assert.ok(insertIndex >= 0);
  assert.ok(updateIndex > insertIndex);

  const updatePayload = calls[updateIndex]!.args[0] as Record<string, unknown>;
  assert.equal(updatePayload.status, "in_progress");
});

test("generation failure leaves open recommendation open", async () => {
  const { client, calls } = createHappyPathClient();

  const { result, error } = await generateContentDraftForRecommendation(USER, REC_ID, client, {
    generateDraft: async () => {
      throw new Error("OpenAI exploded");
    },
  });

  assert.equal(result, null);
  // The raw thrown message ("OpenAI exploded") must never reach the caller -- only
  // the fixed, generic fallback. See the error-sanitization test block below for
  // dedicated coverage of this guarantee.
  assert.doesNotMatch(error ?? "", /OpenAI exploded/);
  assert.match(error ?? "", /Unable to generate content for this recommendation/);
  assert.equal(calls.some((c) => c.table === "marketing_recommendations" && c.op === "update"), false);
  assert.equal(
    calls.some(
      (c) =>
        c.table === "audit_logs" &&
        c.op === "insert" &&
        JSON.stringify(c.args).includes("content_draft.failed")
    ),
    true
  );
});

test("unique-constraint race re-queries and returns the winning active draft", async () => {
  const winning = approvalRow({ id: "approval-winner", title: "Winning draft" });
  const { client } = createHappyPathClient({
    insertError: { code: "23505", message: "duplicate key value" },
    insertRow: winning,
  });

  let generateCalls = 0;
  const { result, error } = await generateContentDraftForRecommendation(USER, REC_ID, client, {
    generateDraft: async () => {
      generateCalls += 1;
      return DRAFT;
    },
  });

  assert.equal(error, undefined);
  assert.equal(result?.reused, true);
  assert.equal(result?.contentApproval.id, "approval-winner");
  assert.equal(generateCalls, 1);
});

test("tenant isolation: all reads/writes are scoped to the supplied userId", async () => {
  const { client, calls } = createHappyPathClient();

  await generateContentDraftForRecommendation(USER, REC_ID, client, {
    generateDraft: stubGenerateDraft(),
  });

  const ids = userIdsQueried(calls);
  assert.ok(ids.length > 0);
  assert.ok(ids.every((id) => id === USER));
  assert.equal(ids.includes(OTHER_USER), false);
});

test("tenant isolation: business profile for another user blocks drafting", async () => {
  const rec = recommendation();
  const { client, calls } = createFakeSupabaseClient({
    marketing_recommendations: { data: rec, error: null },
    // Profile exists but for a different user / different id mismatch path:
    business_profiles: { data: { ...businessProfileRow(OTHER_USER), id: "biz-other" }, error: null },
  });

  const { result, error } = await generateContentDraftForRecommendation(USER, REC_ID, client, {
    generateDraft: stubGenerateDraft(),
  });

  assert.equal(result, null);
  assert.match(error ?? "", /Business profile not found/);
  assert.equal(calls.some((c) => c.table === "content_approvals" && c.op === "insert"), false);
});

test("draft is pending and never auto-published", async () => {
  const { client, calls } = createHappyPathClient();

  const { result } = await generateContentDraftForRecommendation(USER, REC_ID, client, {
    generateDraft: stubGenerateDraft(),
  });

  assert.equal(result?.contentApproval.status, "pending");
  assert.equal(result?.contentApproval.source, "marketing_recommendation");
  assert.equal(calls.some((c) => c.table === "publishing_queue"), false);
  assert.equal(calls.some((c) => c.table === "publishing_jobs"), false);
});

test("injected execution: works with an injected Supabase client (no cookies)", async () => {
  const { client } = createHappyPathClient({
    recommendation: recommendation({ recommended_action_type: "publish_gbp_post" }),
  });

  const { result, error } = await generateContentDraftForRecommendation(USER, REC_ID, client, {
    generateDraft: stubGenerateDraft(),
  });

  assert.equal(error, undefined);
  assert.ok(result);
  assert.equal(result.reused, false);
});

test("in_progress recommendation can still reuse an existing draft", async () => {
  const { client } = createHappyPathClient({
    recommendation: recommendation({ status: "in_progress" }),
    existingDraft: approvalRow({ status: "approved" }),
  });

  const { result, error } = await generateContentDraftForRecommendation(USER, REC_ID, client, {
    generateDraft: async () => {
      throw new Error("should not generate");
    },
  });

  assert.equal(error, undefined);
  assert.equal(result?.reused, true);
  assert.equal(result?.contentApproval.status, "approved");
});

// --- error sanitization ---

test("error sanitization: a non-23505 insert failure never returns the raw Postgres/Supabase message", async () => {
  const rawMessage =
    'permission denied for table content_approvals, column business_profile_id violates row-level security policy';
  const { client } = createHappyPathClient({
    insertError: { code: "42501", message: rawMessage },
  });

  const { result, error } = await generateContentDraftForRecommendation(USER, REC_ID, client, {
    generateDraft: stubGenerateDraft(),
  });

  assert.equal(result, null);
  assert.ok(error);
  assert.doesNotMatch(error!, /permission denied/);
  assert.doesNotMatch(error!, /row-level security/);
  assert.doesNotMatch(error!, /content_approvals/);
  assert.match(error!, /Unable to save content to Approval Center/);
});

test("error sanitization: a raw persistence-layer error from a lower-level call is replaced with the generic fallback, not echoed", async () => {
  const rawMessage = 'relation "public.marketing_opportunities" does not exist';
  const { client } = createFakeSupabaseClient({
    marketing_recommendations: { data: recommendation(), error: null },
    business_profiles: { data: businessProfileRow(), error: null },
    content_approvals: { data: null, error: null },
    ai_marketing_profiles: { data: null, error: null },
    website_analysis: { data: null, error: null },
    market_context_briefs: { data: null, error: null },
    market_context_items: { data: [], error: null },
    marketing_opportunities: { data: null, error: { message: rawMessage } },
    audit_logs: { data: { id: "audit-1" }, error: null },
  });

  const { result, error } = await generateContentDraftForRecommendation(USER, REC_ID, client, {
    generateDraft: stubGenerateDraft(),
  });

  assert.equal(result, null);
  assert.ok(error);
  assert.doesNotMatch(error!, /relation/);
  assert.doesNotMatch(error!, /public\.marketing_opportunities/);
  assert.match(error!, /Unable to generate content for this recommendation/);
});

test("error sanitization: a secret-shaped error message from draft generation is still caught by the existing sanitizer", async () => {
  const { client } = createHappyPathClient();

  const { result, error } = await generateContentDraftForRecommendation(USER, REC_ID, client, {
    generateDraft: async () => {
      throw new Error("Failed to connect: SUPABASE_SERVICE_ROLE_KEY is invalid");
    },
  });

  assert.equal(result, null);
  assert.ok(error);
  assert.doesNotMatch(error!, /SUPABASE_SERVICE/);
  assert.match(error!, /Unable to generate content for this recommendation/);
});

test("error sanitization: hand-authored safe messages still pass through unchanged", async () => {
  const rec = recommendation({ status: "dismissed" });
  const { client } = createFakeSupabaseClient({
    marketing_recommendations: { data: rec, error: null },
  });

  const { error } = await generateContentDraftForRecommendation(USER, REC_ID, client, {
    generateDraft: stubGenerateDraft(),
  });

  // This specific, hand-authored message should still reach the caller verbatim --
  // sanitization must not make every error generic, only ones that could leak
  // internal detail.
  assert.match(error ?? "", /Recommendation is dismissed and cannot be drafted/);
});

// --- TOCTOU: status re-check immediately before insert ---

test("TOCTOU: recommendation dismissed between initial load and draft insert aborts cleanly with no insert", async () => {
  let recommendationReads = 0;
  const { client, calls } = createFakeSupabaseClient({
    marketing_recommendations: (op) => {
      if (op === "maybeSingle" || op === "single") {
        recommendationReads += 1;
        if (recommendationReads === 1) {
          return { data: recommendation({ status: "open" }), error: null };
        }
        // Simulates a concurrent dismiss happening during (slow) draft generation.
        return { data: recommendation({ status: "dismissed" }), error: null };
      }
      return { data: null, error: null };
    },
    business_profiles: { data: businessProfileRow(), error: null },
    content_approvals: { data: null, error: null },
    ai_marketing_profiles: { data: null, error: null },
    website_analysis: { data: null, error: null },
    market_context_briefs: { data: null, error: null },
    market_context_items: { data: [], error: null },
    marketing_opportunities: { data: [], error: null },
    audit_logs: { data: { id: "audit-1" }, error: null },
  });

  const { result, error } = await generateContentDraftForRecommendation(USER, REC_ID, client, {
    generateDraft: stubGenerateDraft(),
  });

  assert.equal(result, null);
  assert.match(error ?? "", /dismissed/);
  assert.equal(calls.some((c) => c.table === "content_approvals" && c.op === "insert"), false);
  assert.equal(recommendationReads, 2, "expected exactly the initial load plus one re-check, no more");
});

test("TOCTOU: recommendation still open at re-check proceeds normally (no false-positive abort)", async () => {
  const { client, calls } = createHappyPathClient();

  const { result, error } = await generateContentDraftForRecommendation(USER, REC_ID, client, {
    generateDraft: stubGenerateDraft(),
  });

  assert.equal(error, undefined);
  assert.equal(result?.reused, false);
  assert.equal(calls.some((c) => c.table === "content_approvals" && c.op === "insert"), true);
});

test("TOCTOU: recommendation still in_progress at re-check proceeds normally", async () => {
  const { client } = createHappyPathClient({
    recommendation: recommendation({ status: "in_progress" }),
  });

  const { result, error } = await generateContentDraftForRecommendation(USER, REC_ID, client, {
    generateDraft: stubGenerateDraft(),
  });

  assert.equal(error, undefined);
  assert.equal(result?.reused, false);
});

// --- current-user wrapper ---

test("generateContentDraftForRecommendationForCurrentUser: still requires cookies exactly as before (no injected client)", async () => {
  await assert.rejects(
    () => generateContentDraftForRecommendationForCurrentUser(REC_ID),
    /next\/headers\.cookies\(\) called outside a Next\.js request context/
  );
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  WeeklyPackageLinkError,
  createWeeklyPackageSignedToken,
  resolveApprovalCenterRedirect,
  verifyWeeklyPackageSignedToken,
} from "../lib/weekly-approval-package/signedLinks.ts";
import { generateWeeklyApprovalPackageForUser } from "../lib/weekly-approval-package/service.ts";
import { createFakeSupabaseClient, userIdsQueried } from "./support/fake-supabase-client.ts";

function withEnv(vars: Record<string, string | undefined>, fn: () => void | Promise<void>) {
  const originals: Record<string, string | undefined> = {};
  for (const key of Object.keys(vars)) {
    originals[key] = process.env[key];
    if (vars[key] === undefined) delete process.env[key];
    else process.env[key] = vars[key];
  }
  return Promise.resolve(fn()).finally(() => {
    for (const key of Object.keys(originals)) {
      if (originals[key] === undefined) delete process.env[key];
      else process.env[key] = originals[key];
    }
  });
}

const SIGNING_ENV = { TOKEN_ENCRYPTION_KEY: "0".repeat(64) };

test("signed links: round-trip, expiry, forgery, and tenant redirect mapping", async () => {
  await withEnv(SIGNING_ENV, () => {
    const now = new Date("2026-07-14T12:00:00.000Z");
    const token = createWeeklyPackageSignedToken({
      purpose: "review_item",
      userId: "user-1",
      businessProfileId: "biz-1",
      itemId: "approval:ca-1",
      ttlSeconds: 3600,
      now,
    });

    const payload = verifyWeeklyPackageSignedToken(token, now);
    assert.equal(payload.userId, "user-1");
    assert.equal(payload.businessProfileId, "biz-1");
    assert.equal(payload.purpose, "review_item");
    assert.equal(payload.itemId, "approval:ca-1");
    assert.equal(
      resolveApprovalCenterRedirect(payload),
      "/dashboard/approvals?focus=ca-1&view=pending"
    );

    assert.equal(
      resolveApprovalCenterRedirect({
        v: 1,
        purpose: "review_item",
        userId: "user-1",
        businessProfileId: "biz-1",
        itemId: "review:rev-9",
        exp: payload.exp,
      }),
      "/dashboard/reviews?focus=rev-9"
    );

    assert.equal(
      resolveApprovalCenterRedirect({
        v: 1,
        purpose: "approve_all",
        userId: "user-1",
        businessProfileId: "biz-1",
        exp: payload.exp,
      }),
      "/dashboard/approvals?view=pending"
    );

    assert.equal(
      resolveApprovalCenterRedirect({
        v: 1,
        purpose: "approval_center",
        userId: "user-1",
        businessProfileId: "biz-1",
        exp: payload.exp,
      }),
      "/dashboard/approvals"
    );

    assert.throws(
      () => verifyWeeklyPackageSignedToken(token.slice(0, -2) + "ab", now),
      WeeklyPackageLinkError
    );

    const expired = createWeeklyPackageSignedToken({
      purpose: "approve_all",
      userId: "user-1",
      businessProfileId: "biz-1",
      ttlSeconds: 1,
      now: new Date("2026-07-01T00:00:00.000Z"),
    });
    assert.throws(
      () => verifyWeeklyPackageSignedToken(expired, new Date("2026-07-14T00:00:00.000Z")),
      /expired/i
    );
  });
});

test("generateWeeklyApprovalPackageForUser: tenant isolation + empty package + HTML/text", async () => {
  await withEnv(SIGNING_ENV, async () => {
    const profile = {
      id: "biz-1",
      user_id: "user-1",
      business_name: "AJN solutions",
      onboarding_completed: true,
    };

    const { client, calls } = createFakeSupabaseClient({
      business_profiles: { data: profile, error: null },
      content_approvals: { data: [], error: null },
      google_business_reviews: { data: [], error: null },
    });

    const pkg = await generateWeeklyApprovalPackageForUser(
      {
        userId: "user-1",
        businessProfileId: "biz-1",
        businessName: "AJN solutions",
        recipientName: "Sean",
        recipientEmail: "sean@example.com",
        baseUrl: "https://app.example.com",
        now: new Date("2026-07-14T12:00:00.000Z"),
      },
      client
    );

    assert.equal(pkg.isEmpty, true);
    assert.match(pkg.executiveSummary.headline, /Nothing is waiting/i);
    assert.match(pkg.html, /all caught up/i);
    assert.match(pkg.text, /no pending items/i);
    assert.match(pkg.approveAllUrl, /weekly-approval-package\/open\?token=/);
    assert.ok(userIdsQueried(calls).every((id) => id === "user-1"));

    // Cross-tenant profile mismatch fails closed.
    const { client: other } = createFakeSupabaseClient({
      business_profiles: { data: { ...profile, id: "biz-OTHER" }, error: null },
    });
    await assert.rejects(
      () =>
        generateWeeklyApprovalPackageForUser(
          {
            userId: "user-1",
            businessProfileId: "biz-1",
            businessName: "AJN solutions",
            baseUrl: "https://app.example.com",
          },
          other
        ),
      /Business profile not found/
    );
  });
});

test("generateWeeklyApprovalPackageForUser: multiple recommendation types + explanations", async () => {
  await withEnv(SIGNING_ENV, async () => {
    const nowIso = "2026-07-14T12:00:00.000Z";
    const approvals = [
      {
        id: "ca-gbp",
        user_id: "user-1",
        business_profile_id: "biz-1",
        content_type: "Google Business Profile Post",
        title: "Holiday hours",
        content: "We are open this weekend for walk-ins.",
        status: "pending",
        source: "marketing_recommendation",
        version: 1,
        ai_score: 80,
        notes: null,
        marketing_recommendation_id: "rec-seasonal",
        approved_at: null,
        approved_by: null,
        rejected_reason: null,
        rejection_reason_code: null,
        created_at: "2026-07-13T10:00:00.000Z",
        updated_at: "2026-07-13T10:00:00.000Z",
      },
      {
        id: "ca-web",
        user_id: "user-1",
        business_profile_id: "biz-1",
        content_type: "Website Content",
        title: "Refresh homepage CTA",
        content: "Book a consult this week.",
        status: "pending",
        source: "marketing_recommendation",
        version: 1,
        ai_score: 70,
        notes: null,
        marketing_recommendation_id: "rec-web",
        approved_at: null,
        approved_by: null,
        rejected_reason: null,
        rejection_reason_code: null,
        created_at: "2026-07-12T10:00:00.000Z",
        updated_at: "2026-07-12T10:00:00.000Z",
      },
    ];

    const recommendations = [
      {
        id: "rec-seasonal",
        user_id: "user-1",
        business_profile_id: "biz-1",
        recommended_action_type: "create_seasonal_content",
        priority_score: 90,
        urgency: "this_week",
        business_impact: "high",
        estimated_effort: "low",
        confidence: 0.8,
        reasoning: "Independence Day weekend",
        related_opportunity_ids: ["opp-1"],
        status: "in_progress",
        created_at: nowIso,
        updated_at: nowIso,
      },
      {
        id: "rec-web",
        user_id: "user-1",
        business_profile_id: "biz-1",
        recommended_action_type: "refresh_website_content",
        priority_score: 70,
        urgency: "this_month",
        business_impact: "medium",
        estimated_effort: "medium",
        confidence: 0.6,
        reasoning: "Homepage CTA is outdated",
        related_opportunity_ids: [],
        status: "in_progress",
        created_at: nowIso,
        updated_at: nowIso,
      },
    ];

    const reviews = [
      {
        id: "rev-1",
        user_id: "user-1",
        business_profile_id: "biz-1",
        location_id: null,
        google_review_id: "g-1",
        reviewer_name: "Alex",
        reviewer_photo_url: null,
        rating: 5,
        comment: "Great",
        review_reply: null,
        reply_status: "draft",
        ai_draft_reply: "Thanks so much, Alex!",
        google_review_url: null,
        review_created_at: "2026-07-11T00:00:00.000Z",
        reply_updated_at: null,
        raw_json: {},
        created_at: "2026-07-11T00:00:00.000Z",
        updated_at: "2026-07-11T00:00:00.000Z",
      },
    ];

    // Presentation service also queries opportunities, outcome events, signals, etc.
    const { client, calls } = createFakeSupabaseClient({
      business_profiles: {
        data: { id: "biz-1", user_id: "user-1", business_name: "AJN solutions", onboarding_completed: true },
        error: null,
      },
      content_approvals: { data: approvals, error: null },
      google_business_reviews: { data: reviews, error: null },
      marketing_recommendations: { data: recommendations, error: null },
      marketing_opportunities: {
        data: [
          {
            id: "opp-1",
            user_id: "user-1",
            business_profile_id: "biz-1",
            category: "seasonal",
            title: "Holiday demand",
            description: "Local searches rising",
            status: "open",
            priority_score: 80,
            confidence: 0.7,
            evidence_json: {},
            related_recommendation_ids: [],
            created_at: nowIso,
            updated_at: nowIso,
          },
        ],
        error: null,
      },
      recommendation_outcome_events: { data: [], error: null },
      recommendation_learning_signals: { data: null, error: null },
    });

    const pkg = await generateWeeklyApprovalPackageForUser(
      {
        userId: "user-1",
        businessProfileId: "biz-1",
        businessName: "AJN solutions",
        recipientName: "Sean",
        baseUrl: "https://app.example.com",
        now: new Date(nowIso),
      },
      client
    );

    assert.equal(pkg.executiveSummary.totalItems, 3);
    assert.match(pkg.executiveSummary.headline, /We prepared 3 items/);
    assert.ok(pkg.groups.some((g) => g.platform === "google_business_profile"));
    assert.ok(pkg.groups.some((g) => g.platform === "review_reply"));
    assert.match(pkg.html, /Independence Day weekend|Homepage CTA is outdated|Thanks so much, Alex!/);
    assert.match(pkg.html, /Expected benefit:/);
    assert.match(pkg.text, /Review replies|Google Business Profile/);
    assert.ok(userIdsQueried(calls).every((id) => id === "user-1" || id === undefined));
    // Soft check: at least one user_id filter used the correct tenant.
    assert.ok(userIdsQueried(calls).includes("user-1"));
  });
});

test("generateWeeklyApprovalPackageForUser: mints one-click email action links scoped to exactly the eligible items, excluding review replies", async () => {
  await withEnv(SIGNING_ENV, async () => {
    const nowIso = "2026-07-14T12:00:00.000Z";
    const approvals = [
      {
        id: "ca-gbp",
        user_id: "user-1",
        business_profile_id: "biz-1",
        content_type: "Google Business Profile Post",
        title: "Holiday hours",
        content: "We are open this weekend for walk-ins.",
        status: "pending",
        source: "marketing_recommendation",
        version: 1,
        ai_score: 80,
        notes: null,
        marketing_recommendation_id: "rec-seasonal",
        approved_at: null,
        approved_by: null,
        rejected_reason: null,
        rejection_reason_code: null,
        created_at: "2026-07-13T10:00:00.000Z",
        updated_at: "2026-07-13T10:00:00.000Z",
      },
    ];

    const reviews = [
      {
        id: "rev-1",
        user_id: "user-1",
        business_profile_id: "biz-1",
        location_id: null,
        google_review_id: "g-1",
        reviewer_name: "Alex",
        reviewer_photo_url: null,
        rating: 5,
        comment: "Great",
        review_reply: null,
        reply_status: "draft",
        ai_draft_reply: "Thanks so much, Alex!",
        google_review_url: null,
        review_created_at: "2026-07-11T00:00:00.000Z",
        reply_updated_at: null,
        raw_json: {},
        created_at: "2026-07-11T00:00:00.000Z",
        updated_at: "2026-07-11T00:00:00.000Z",
      },
    ];

    const { client } = createFakeSupabaseClient({
      business_profiles: {
        data: { id: "biz-1", user_id: "user-1", business_name: "AJN solutions", onboarding_completed: true },
        error: null,
      },
      content_approvals: { data: approvals, error: null },
      google_business_reviews: { data: reviews, error: null },
      marketing_recommendations: { data: [], error: null },
      marketing_opportunities: { data: [], error: null },
      recommendation_outcome_events: { data: [], error: null },
      recommendation_learning_signals: { data: null, error: null },
    });

    const pkg = await generateWeeklyApprovalPackageForUser(
      {
        userId: "user-1",
        businessProfileId: "biz-1",
        businessName: "AJN solutions",
        recipientName: "Sean",
        recipientEmail: "sean@example.com",
        baseUrl: "https://app.example.com",
        now: new Date(nowIso),
      },
      client
    );

    // The content draft gets real one-click action links...
    const draftItem = pkg.items.find((i) => i.contentApprovalId === "ca-gbp")!;
    assert.match(draftItem.approveActionUrl ?? "", /\/api\/email-actions\/open\?token=/);
    assert.match(draftItem.rejectActionUrl ?? "", /\/api\/email-actions\/open\?token=/);

    // ...but the review-reply item (no contentApprovalId, different mutation path) does
    // not -- explicit scope boundary for one-click email approve/reject.
    const reviewItem = pkg.items.find((i) => i.reviewId === "rev-1")!;
    assert.equal(reviewItem.approveActionUrl, null);
    assert.equal(reviewItem.rejectActionUrl, null);

    // Approve All's token snapshot contains exactly the eligible content-draft id, never
    // the review-reply item.
    assert.ok(pkg.approveAllActionUrl);
    const approveAllToken = new URL(pkg.approveAllActionUrl!).searchParams.get("token")!;
    const { verifyEmailActionToken } = await import("../lib/email-actions/tokens.ts");
    const payload = verifyEmailActionToken(approveAllToken, new Date(nowIso));
    assert.deepEqual(payload.contentApprovalIds, ["ca-gbp"]);
    assert.equal(payload.emailRecipient, "sean@example.com");
  });
});

test("generateWeeklyApprovalPackageForUser: with no recipient email, one-click action links are omitted (Edit/Approval Center only)", async () => {
  await withEnv(SIGNING_ENV, async () => {
    const approvals = [
      {
        id: "ca-gbp",
        user_id: "user-1",
        business_profile_id: "biz-1",
        content_type: "Google Business Profile Post",
        title: "Holiday hours",
        content: "We are open this weekend for walk-ins.",
        status: "pending",
        source: "marketing_recommendation",
        version: 1,
        ai_score: 80,
        notes: null,
        marketing_recommendation_id: null,
        approved_at: null,
        approved_by: null,
        rejected_reason: null,
        rejection_reason_code: null,
        created_at: "2026-07-13T10:00:00.000Z",
        updated_at: "2026-07-13T10:00:00.000Z",
      },
    ];

    const { client } = createFakeSupabaseClient({
      business_profiles: {
        data: { id: "biz-1", user_id: "user-1", business_name: "AJN solutions", onboarding_completed: true },
        error: null,
      },
      content_approvals: { data: approvals, error: null },
      google_business_reviews: { data: [], error: null },
    });

    const pkg = await generateWeeklyApprovalPackageForUser(
      {
        userId: "user-1",
        businessProfileId: "biz-1",
        businessName: "AJN solutions",
        recipientName: "Sean",
        baseUrl: "https://app.example.com",
        now: new Date("2026-07-14T12:00:00.000Z"),
      },
      client
    );

    assert.equal(pkg.approveAllActionUrl, null);
    assert.ok(pkg.items.every((i) => i.approveActionUrl === null && i.rejectActionUrl === null));
    assert.match(pkg.html, />\s*Edit\s*</);
  });
});

test("ATTACH_DECLARATIVE_PRODUCTION_CRONS remains false (no schedule activation via this feature)", async () => {
  const { ATTACH_DECLARATIVE_PRODUCTION_CRONS } = await import(
    "../lib/trigger/scheduleActivation.ts"
  );
  assert.equal(ATTACH_DECLARATIVE_PRODUCTION_CRONS, false);
});

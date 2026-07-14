import test from "node:test";
import assert from "node:assert/strict";
import {
  buildExecutiveSummary,
  classifyContentDraftKind,
  formatWeekLabel,
  groupWeeklyPackageItems,
  mapContentTypeToPlatform,
  sortWeeklyPackageItems,
  truncateSummary,
} from "../lib/weekly-approval-package/group.ts";
import {
  selectPendingApprovalsForWeeklyPackage,
  selectPendingReviewRepliesForWeeklyPackage,
} from "../lib/weekly-approval-package/collect.ts";
import { renderWeeklyApprovalPackageHtml } from "../lib/weekly-approval-package/renderHtml.ts";
import { renderWeeklyApprovalPackageText } from "../lib/weekly-approval-package/renderText.ts";
import { toWeeklyApprovalPackagePreview } from "../lib/weekly-approval-package/preview.ts";
import {
  WeeklyPackageItemKinds,
  WeeklyPackagePlatforms,
  type WeeklyApprovalPackage,
  type WeeklyPackageItem,
} from "../lib/weekly-approval-package/types.ts";
import type { ContentApproval } from "../lib/content-approval/types.ts";
import type { GoogleBusinessReview } from "../lib/google-business/types.ts";
import type { ClientRecommendationDecisionPackage } from "../lib/recommendation-presentation/types.ts";

function item(overrides: Partial<WeeklyPackageItem> = {}): WeeklyPackageItem {
  return {
    id: "approval:1",
    kind: WeeklyPackageItemKinds.CONTENT_DRAFT,
    platform: WeeklyPackagePlatforms.GOOGLE_BUSINESS_PROFILE,
    platformLabel: "Google Business Profile",
    title: "Seasonal update",
    summary: "Come visit us this weekend.",
    recommendationId: "rec-1",
    contentApprovalId: "ca-1",
    reviewId: null,
    recommendationPackage: null,
    whyNow: "Independence Day weekend",
    expectedBenefit: "Attract nearby customers searching for local services.",
    createdAt: "2026-07-10T12:00:00.000Z",
    reviewUrl: "https://example.com/open?token=a",
    approveActionUrl: null,
    rejectActionUrl: null,
    ...overrides,
  };
}

function approval(overrides: Partial<ContentApproval> = {}): ContentApproval {
  return {
    id: "ca-1",
    user_id: "user-1",
    business_profile_id: "biz-1",
    content_type: "Google Business Profile Post",
    title: "Post",
    content: "Body",
    status: "pending",
    source: "marketing_recommendation",
    version: 1,
    ai_score: null,
    notes: null,
    marketing_recommendation_id: "rec-1",
    approved_at: null,
    approved_by: null,
    rejected_reason: null,
    rejection_reason_code: null,
    created_at: "2026-07-10T12:00:00.000Z",
    updated_at: "2026-07-10T12:00:00.000Z",
    ...overrides,
  };
}

test("mapContentTypeToPlatform covers GBP, social, email, reviews", () => {
  assert.equal(mapContentTypeToPlatform("Google Business Profile Post"), "google_business_profile");
  assert.equal(mapContentTypeToPlatform("Facebook Post"), "facebook");
  assert.equal(mapContentTypeToPlatform("Instagram Caption"), "instagram");
  assert.equal(mapContentTypeToPlatform("LinkedIn Update"), "linkedin");
  assert.equal(mapContentTypeToPlatform("Email Newsletter"), "email");
  assert.equal(mapContentTypeToPlatform("Review Reply Draft"), "review_reply");
  assert.equal(classifyContentDraftKind("Google Business Profile Post"), "gbp_update");
  assert.equal(classifyContentDraftKind("Blog Draft"), "content_draft");
});

test("selectPendingApprovalsForWeeklyPackage keeps recommendation + GBP pending only", () => {
  const rows = [
    approval({ id: "1", marketing_recommendation_id: "rec-1" }),
    approval({
      id: "2",
      marketing_recommendation_id: null,
      source: "content_generator",
      content_type: "Google Business Profile Post",
    }),
    approval({
      id: "3",
      marketing_recommendation_id: null,
      source: "content_generator",
      content_type: "Blog Draft",
    }),
    approval({ id: "4", status: "approved", marketing_recommendation_id: "rec-2" }),
  ];
  const selected = selectPendingApprovalsForWeeklyPackage(rows);
  assert.deepEqual(
    selected.map((r) => r.id).sort(),
    ["1", "2"]
  );
});

test("selectPendingReviewRepliesForWeeklyPackage requires draft + AI text", () => {
  const base: GoogleBusinessReview = {
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
    ai_draft_reply: "Thanks Alex!",
    google_review_url: null,
    review_created_at: "2026-07-09T00:00:00.000Z",
    reply_updated_at: null,
    raw_json: {},
    created_at: "2026-07-09T00:00:00.000Z",
    updated_at: "2026-07-09T00:00:00.000Z",
  };
  assert.equal(selectPendingReviewRepliesForWeeklyPackage([base]).length, 1);
  assert.equal(
    selectPendingReviewRepliesForWeeklyPackage([{ ...base, reply_status: "unanswered" }]).length,
    0
  );
  assert.equal(
    selectPendingReviewRepliesForWeeklyPackage([{ ...base, ai_draft_reply: "  " }]).length,
    0
  );
});

test("grouping and ordering: platform order, recommendation adjacency, newest first", () => {
  const items = [
    item({
      id: "a",
      platform: "facebook",
      platformLabel: "Facebook",
      recommendationId: "rec-b",
      createdAt: "2026-07-01T00:00:00.000Z",
    }),
    item({
      id: "b",
      platform: "google_business_profile",
      recommendationId: "rec-z",
      createdAt: "2026-07-02T00:00:00.000Z",
    }),
    item({
      id: "c",
      platform: "google_business_profile",
      recommendationId: "rec-a",
      createdAt: "2026-07-03T00:00:00.000Z",
    }),
    item({
      id: "d",
      platform: "review_reply",
      platformLabel: "Review replies",
      kind: "review_reply",
      recommendationId: null,
      createdAt: "2026-07-04T00:00:00.000Z",
    }),
  ];
  const sorted = sortWeeklyPackageItems(items);
  assert.deepEqual(
    sorted.map((i) => i.id),
    ["c", "b", "d", "a"]
  );
  const groups = groupWeeklyPackageItems(items);
  assert.deepEqual(
    groups.map((g) => g.platform),
    ["google_business_profile", "review_reply", "facebook"]
  );
});

test("executive summary and empty headline", () => {
  const empty = buildExecutiveSummary([]);
  assert.equal(empty.totalItems, 0);
  assert.match(empty.headline, /Nothing is waiting/i);

  const one = buildExecutiveSummary([item()]);
  assert.equal(one.totalItems, 1);
  assert.equal(one.headline, "We prepared 1 item for you this week.");

  const many = buildExecutiveSummary([
    item({ id: "1" }),
    item({ id: "2", platform: "review_reply", platformLabel: "Review replies" }),
  ]);
  assert.equal(many.headline, "We prepared 2 items for you this week.");
  assert.equal(many.byPlatform.length, 2);
});

test("truncateSummary and week label", () => {
  assert.equal(truncateSummary("short"), "short");
  assert.ok(truncateSummary("x".repeat(200)).endsWith("…"));
  assert.match(formatWeekLabel(new Date("2026-07-14T12:00:00.000Z")), /2026/);
});

function samplePackage(overrides: Partial<WeeklyApprovalPackage> = {}): WeeklyApprovalPackage {
  const items = [
    item({
      recommendationPackage: {
        recommendationId: "rec-1",
        contentApprovalId: "ca-1",
        title: "Seasonal update",
        recommendedAction: "Create seasonal content",
        whyNow: "Independence Day weekend",
        supportingReasons: [{ text: "Local demand is rising" }],
        expectedBenefit: "Attract nearby customers searching for local services.",
        confidenceLabel: "good_opportunity",
        confidenceLabelText: "Good opportunity",
        confidenceExplanation: "Based on recent patterns.",
        generatedDraft: {
          contentApprovalId: "ca-1",
          title: "Seasonal update",
          content: "Come visit us this weekend.",
          contentType: "Google Business Profile Post",
          version: 1,
        },
        platform: "google_business_profile",
        contentType: "Google Business Profile Post",
        approvalStatus: "pending",
        outcomeStatus: { label: "Awaiting approval", isOperationalIssue: false, detail: null },
        clientActions: ["approve", "reject", "edit", "more_like_this"],
        sourceContext: { urgency: "this_week", categories: ["seasonal"] },
        createdAt: "2026-07-10T12:00:00.000Z",
      } satisfies ClientRecommendationDecisionPackage,
    }),
    item({
      id: "review:1",
      kind: "review_reply",
      platform: "review_reply",
      platformLabel: "Review replies",
      title: "Reply to 5-star review from Alex",
      summary: "Thanks Alex!",
      recommendationId: null,
      contentApprovalId: null,
      reviewId: "rev-1",
      whyNow: "A customer left feedback that deserves a timely, professional reply.",
      expectedBenefit: "Strengthen local reputation and show customers you are listening.",
    }),
  ];
  const groups = groupWeeklyPackageItems(items);
  const executiveSummary = buildExecutiveSummary(items);
  const base: WeeklyApprovalPackage = {
    userId: "user-1",
    businessProfileId: "biz-1",
    businessName: "AJN solutions",
    recipientEmail: "owner@example.com",
    recipientName: "Sean",
    generatedAt: "2026-07-14T12:00:00.000Z",
    weekLabel: "Jul 14, 2026",
    subject: "Your Weekly AJN Marketing Content is Ready (2 items)",
    executiveSummary,
    groups,
    items: groups.flatMap((g) => g.items),
    approveAllUrl: "https://example.com/api/weekly-approval-package/open?token=approve",
    approvalCenterUrl: "https://example.com/api/weekly-approval-package/open?token=center",
    approveAllActionUrl: null,
    html: "",
    text: "",
    isEmpty: false,
  };
  return { ...base, ...overrides };
}

test("HTML rendering includes executive summary, explanations, Approve All, mobile viewport", () => {
  const pkg = samplePackage();
  const html = renderWeeklyApprovalPackageHtml(pkg);
  assert.match(html, /viewport/);
  assert.match(html, /We prepared 2 items for you this week/);
  assert.match(html, /Why now:/);
  assert.match(html, /Expected benefit:/);
  assert.match(html, /Independence Day weekend/);
  assert.match(html, />\s*Approve All\s*</);
  assert.match(html, /max-width:600px/);
  assert.match(html, />Edit</);
  assert.equal(html.includes("<script"), false);
});

test("HTML empty state is calm and has no Approve All CTA", () => {
  const pkg = samplePackage({
    isEmpty: true,
    items: [],
    groups: [],
    executiveSummary: buildExecutiveSummary([]),
    subject: "nothing pending",
  });
  const html = renderWeeklyApprovalPackageHtml(pkg);
  assert.match(html, /all caught up/i);
  assert.equal(html.includes(">Approve All<"), false);
});

test("plain-text rendering includes links and explanations", () => {
  const text = renderWeeklyApprovalPackageText(samplePackage());
  assert.match(text, /We prepared 2 items/);
  assert.match(text, /Why now: Independence Day weekend/);
  assert.match(text, /Approve All/);
  assert.match(text, /https:\/\/example.com\/api\/weekly-approval-package\/open/);
});

test("preview envelope never implies send", () => {
  const pkg = samplePackage();
  pkg.html = renderWeeklyApprovalPackageHtml(pkg);
  pkg.text = renderWeeklyApprovalPackageText(pkg);
  const preview = toWeeklyApprovalPackagePreview(pkg);
  assert.equal(preview.mode, "preview");
  assert.equal(preview.itemCount, 2);
  assert.equal(preview.from.includes("AJN Marketing"), true);
  assert.ok(preview.html.length > 100);
  assert.ok(preview.text.length > 40);
});

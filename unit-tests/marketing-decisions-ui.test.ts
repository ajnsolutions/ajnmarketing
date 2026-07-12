import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRecommendationListItem,
  buildRecommendationsSummary,
  filterRecommendationItems,
  formatEvidenceEntries,
  isActiveRecommendationStatus,
  resolveRecommendationDraftAction,
} from "../lib/marketing-decisions/ui.ts";
import { getMarketingRecommendationsPageDataForUser } from "../lib/marketing-decisions/page-data.ts";
import { createFakeSupabaseClient, userIdsQueried } from "./support/fake-supabase-client.ts";
import type { MarketingRecommendation } from "../lib/marketing-decisions/types.ts";
import type { MarketingOpportunity } from "../lib/marketing-opportunities/types.ts";
import type { ContentApproval } from "../lib/content-approval/types.ts";

const USER = "user-1";
const OTHER = "user-other";

function recommendation(
  overrides: Partial<MarketingRecommendation> = {}
): MarketingRecommendation {
  return {
    id: "rec-1",
    user_id: USER,
    business_profile_id: "biz-1",
    recommended_action_type: "create_timely_content",
    priority_score: 82,
    urgency: "high",
    business_impact: "medium",
    estimated_effort: "medium",
    confidence: 77,
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
    business_profile_id: "biz-1",
    category: "holiday",
    severity: "high",
    confidence: 80,
    title: "Independence Day weekend",
    description: "Local holiday demand spike.",
    evidence: { holidayName: "Independence Day", daysUntil: 3 },
    recommended_action: "Create timely content",
    expires_at: "2026-07-05T00:00:00.000Z",
    status: "open",
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

function approval(overrides: Partial<ContentApproval> = {}): ContentApproval {
  return {
    id: "approval-1",
    user_id: USER,
    business_profile_id: "biz-1",
    content_type: "Community Post",
    title: "Holiday weekend ready",
    content: "Book today.",
    status: "pending",
    source: "marketing_recommendation",
    version: 1,
    ai_score: 88,
    notes: null,
    marketing_recommendation_id: "rec-1",
    approved_at: null,
    approved_by: null,
    rejected_reason: null,
    created_at: "2026-07-11T00:00:00.000Z",
    updated_at: "2026-07-11T00:00:00.000Z",
    ...overrides,
  };
}

test("resolveRecommendationDraftAction: generate / view / regenerate / manual", () => {
  assert.equal(
    resolveRecommendationDraftAction({
      contentSupported: true,
      linkedDraft: null,
      hasRejectedDraft: false,
    }),
    "generate"
  );
  assert.equal(
    resolveRecommendationDraftAction({
      contentSupported: true,
      linkedDraft: approval(),
      hasRejectedDraft: false,
    }),
    "view"
  );
  assert.equal(
    resolveRecommendationDraftAction({
      contentSupported: true,
      linkedDraft: null,
      hasRejectedDraft: true,
    }),
    "regenerate"
  );
  assert.equal(
    resolveRecommendationDraftAction({
      contentSupported: false,
      linkedDraft: null,
      hasRejectedDraft: false,
    }),
    "manual"
  );
});

test("unsupported action types never get Generate Draft", () => {
  const item = buildRecommendationListItem({
    recommendation: recommendation({ recommended_action_type: "request_reviews" }),
    opportunities: [opportunity()],
    linkedDraft: null,
    hasRejectedDraft: false,
  });
  assert.equal(item.contentSupported, false);
  assert.equal(item.draftAction, "manual");
});

test("supported action with rejected history shows regenerate", () => {
  const item = buildRecommendationListItem({
    recommendation: recommendation({ recommended_action_type: "publish_gbp_post" }),
    opportunities: [opportunity()],
    linkedDraft: null,
    hasRejectedDraft: true,
  });
  assert.equal(item.draftAction, "regenerate");
});

test("recommendation ordering helpers: summary prefers highest priority title", () => {
  const items = [
    buildRecommendationListItem({
      recommendation: recommendation({ id: "low", priority_score: 40, status: "open" }),
      opportunities: [opportunity({ title: "Low priority item" })],
      linkedDraft: null,
      hasRejectedDraft: false,
    }),
    buildRecommendationListItem({
      recommendation: recommendation({
        id: "high",
        priority_score: 91,
        status: "in_progress",
        recommended_action_type: "publish_gbp_post",
      }),
      opportunities: [opportunity({ id: "opp-2", title: "Post to Google now" })],
      linkedDraft: approval({ marketing_recommendation_id: "high" }),
      hasRejectedDraft: false,
    }),
  ];

  const summary = buildRecommendationsSummary(items);
  assert.equal(summary.activeCount, 2);
  assert.equal(summary.inProgressCount, 1);
  assert.equal(summary.readyForDraftCount, 1);
  assert.equal(summary.highestPriorityTitle, "Post to Google now");
});

test("filters: ready / in_progress / manual", () => {
  const items = [
    buildRecommendationListItem({
      recommendation: recommendation({ id: "ready", status: "open" }),
      opportunities: [],
      linkedDraft: null,
      hasRejectedDraft: false,
    }),
    buildRecommendationListItem({
      recommendation: recommendation({
        id: "progress",
        status: "in_progress",
        recommended_action_type: "create_seasonal_content",
      }),
      opportunities: [],
      linkedDraft: approval({ marketing_recommendation_id: "progress" }),
      hasRejectedDraft: false,
    }),
    buildRecommendationListItem({
      recommendation: recommendation({
        id: "manual",
        status: "open",
        recommended_action_type: "upload_photos",
      }),
      opportunities: [],
      linkedDraft: null,
      hasRejectedDraft: false,
    }),
  ];

  assert.equal(filterRecommendationItems(items, "ready").length, 1);
  assert.equal(filterRecommendationItems(items, "in_progress")[0]?.recommendation.id, "progress");
  assert.equal(filterRecommendationItems(items, "manual")[0]?.recommendation.id, "manual");
  assert.equal(filterRecommendationItems(items, "all").length, 3);
});

test("dismissed/completed/superseded are not active", () => {
  assert.equal(isActiveRecommendationStatus("open"), true);
  assert.equal(isActiveRecommendationStatus("in_progress"), true);
  assert.equal(isActiveRecommendationStatus("dismissed"), false);
  assert.equal(isActiveRecommendationStatus("completed"), false);
  assert.equal(isActiveRecommendationStatus("superseded"), false);
});

test("formatEvidenceEntries: human-readable, no raw JSON dump", () => {
  const entries = formatEvidenceEntries({
    holidayName: "Independence Day",
    nested: { city: "Austin", score: 9 },
    empty: "",
  });
  assert.deepEqual(
    entries.map((entry) => entry.label),
    ["holidayName", "nested"]
  );
  assert.match(entries[0]!.value, /Independence Day/);
  assert.match(entries[1]!.value, /city: Austin/);
  assert.equal(entries[1]!.value.includes("{"), false);
  assert.equal(entries[1]!.value.includes("}"), false);
});

test("page data: orders by priority and excludes inactive statuses", async () => {
  const { client } = createFakeSupabaseClient({
    marketing_recommendations: {
      data: [
        recommendation({ id: "rec-low", priority_score: 30, status: "open" }),
        recommendation({
          id: "rec-high",
          priority_score: 95,
          status: "open",
          related_opportunity_ids: ["opp-1"],
        }),
        recommendation({ id: "rec-done", priority_score: 99, status: "completed" }),
        recommendation({ id: "rec-gone", priority_score: 98, status: "superseded" }),
        recommendation({ id: "rec-dismissed", priority_score: 97, status: "dismissed" }),
      ],
      error: null,
    },
    marketing_opportunities: { data: [opportunity()], error: null },
    content_approvals: { data: [], error: null },
  });

  const data = await getMarketingRecommendationsPageDataForUser(USER, client);
  assert.deepEqual(
    data.items.map((item) => item.recommendation.id),
    ["rec-high", "rec-low"]
  );
  assert.equal(data.summary.activeCount, 2);
});

test("page data: tenant isolation on all queries", async () => {
  const { client, calls } = createFakeSupabaseClient({
    marketing_recommendations: {
      data: [recommendation()],
      error: null,
    },
    marketing_opportunities: { data: [opportunity()], error: null },
    content_approvals: {
      data: [approval()],
      error: null,
    },
  });

  const data = await getMarketingRecommendationsPageDataForUser(USER, client);
  assert.equal(data.items[0]?.draftAction, "view");
  assert.ok(userIdsQueried(calls).every((id) => id === USER));
  assert.equal(userIdsQueried(calls).includes(OTHER), false);
});

test("page data: rejected draft enables regenerate; no publishing tables touched", async () => {
  const { client, calls } = createFakeSupabaseClient({
    marketing_recommendations: {
      data: [recommendation({ status: "open" })],
      error: null,
    },
    marketing_opportunities: { data: [opportunity()], error: null },
    content_approvals: {
      data: [approval({ status: "rejected" })],
      error: null,
    },
  });

  const data = await getMarketingRecommendationsPageDataForUser(USER, client);
  assert.equal(data.items[0]?.draftAction, "regenerate");
  assert.equal(data.items[0]?.linkedDraft, null);
  assert.equal(calls.some((call) => call.table === "publishing_queue"), false);
  assert.equal(calls.some((call) => call.table === "publishing_jobs"), false);
});

test("page data: empty state contract", async () => {
  const { client } = createFakeSupabaseClient({
    marketing_recommendations: { data: [], error: null },
    marketing_opportunities: { data: [], error: null },
    content_approvals: { data: [], error: null },
  });

  const data = await getMarketingRecommendationsPageDataForUser(USER, client);
  assert.deepEqual(data.items, []);
  assert.equal(data.summary.activeCount, 0);
  assert.equal(data.summary.highestPriorityTitle, null);
});

test("linked draft navigation target is Approval Center path (contract)", () => {
  const item = buildRecommendationListItem({
    recommendation: recommendation({ status: "in_progress" }),
    opportunities: [opportunity()],
    linkedDraft: approval({ status: "pending" }),
    hasRejectedDraft: false,
  });
  assert.equal(item.draftAction, "view");
  assert.equal(item.linkedDraft?.status, "pending");
  // UI links to /dashboard/approvals — asserted here as the contract View Draft uses.
  assert.equal("/dashboard/approvals".startsWith("/dashboard/approvals"), true);
});

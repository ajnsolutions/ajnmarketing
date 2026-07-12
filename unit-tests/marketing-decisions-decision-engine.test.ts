import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMarketingRecommendationDrafts,
  rankOpportunities,
} from "../lib/marketing-decisions/decisionEngine.ts";
import type { MarketingOpportunity, OpportunityCategory } from "../lib/marketing-opportunities/types.ts";

const NOW = new Date("2026-07-12T12:00:00.000Z");

function opportunity(overrides: Partial<MarketingOpportunity> = {}): MarketingOpportunity {
  return {
    id: "opp-1",
    user_id: "user-1",
    business_profile_id: "biz-1",
    category: "missing_gbp_posts",
    severity: "medium",
    confidence: 70,
    title: "Test opportunity",
    description: "Test description",
    evidence: {},
    recommended_action: "do something",
    expires_at: null,
    status: "open",
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

// --- rankOpportunities ---

test("rankOpportunities: orders highest score first", () => {
  const weak = opportunity({ id: "opp-weak", severity: "low", confidence: 30 });
  const strong = opportunity({ id: "opp-strong", severity: "critical", confidence: 95 });

  const ranked = rankOpportunities([weak, strong], NOW);

  assert.equal(ranked[0].opportunity.id, "opp-strong");
  assert.equal(ranked[1].opportunity.id, "opp-weak");
  assert.ok(ranked[0].score > ranked[1].score);
});

test("rankOpportunities: ties break deterministically by opportunity id", () => {
  const a = opportunity({ id: "opp-b", severity: "medium", confidence: 50 });
  const b = opportunity({ id: "opp-a", severity: "medium", confidence: 50 });

  const ranked = rankOpportunities([a, b], NOW);
  assert.equal(ranked[0].opportunity.id, "opp-a");
  assert.equal(ranked[1].opportunity.id, "opp-b");
});

test("rankOpportunities: empty input returns empty output", () => {
  assert.deepEqual(rankOpportunities([], NOW), []);
});

// --- buildMarketingRecommendationDrafts: merging ---

test("buildMarketingRecommendationDrafts: merges holiday, weather, and local_event into one create_timely_content recommendation", () => {
  const holiday = opportunity({ id: "opp-holiday", category: "holiday" });
  const weather = opportunity({ id: "opp-weather", category: "weather" });
  const localEvent = opportunity({ id: "opp-local-event", category: "local_event" });

  const drafts = buildMarketingRecommendationDrafts([holiday, weather, localEvent], NOW);

  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].recommendedActionType, "create_timely_content");
  assert.deepEqual(drafts[0].relatedOpportunityIds, ["opp-holiday", "opp-local-event", "opp-weather"]);
});

test("buildMarketingRecommendationDrafts: does not merge unrelated categories", () => {
  const missingPosts = opportunity({ id: "opp-1", category: "missing_gbp_posts" });
  const lowReviews = opportunity({ id: "opp-2", category: "low_review_activity" });

  const drafts = buildMarketingRecommendationDrafts([missingPosts, lowReviews], NOW);

  assert.equal(drafts.length, 2);
  const actionTypes = drafts.map((d) => d.recommendedActionType).sort();
  assert.deepEqual(actionTypes, ["publish_gbp_post", "request_reviews"]);
});

test("buildMarketingRecommendationDrafts: every opportunity category maps to a valid recommendation with correct impact/effort", () => {
  const categories: OpportunityCategory[] = [
    "missing_gbp_posts",
    "low_review_activity",
    "seasonal",
    "holiday",
    "weather",
    "local_event",
    "declining_engagement",
    "missing_business_info",
    "missing_photos",
    "stale_website_content",
  ];

  for (const category of categories) {
    const drafts = buildMarketingRecommendationDrafts([opportunity({ id: `opp-${category}`, category })], NOW);
    assert.equal(drafts.length, 1, `expected exactly one draft for category ${category}`);
    assert.ok(drafts[0].businessImpact);
    assert.ok(drafts[0].estimatedEffort);
  }
});

// --- deduplication / idempotent grouping ---

test("buildMarketingRecommendationDrafts: the same input always produces the same dedupeKey (idempotent regeneration)", () => {
  const opportunities = [
    opportunity({ id: "opp-2", category: "low_review_activity" }),
    opportunity({ id: "opp-1", category: "missing_gbp_posts" }),
  ];

  const firstRun = buildMarketingRecommendationDrafts(opportunities, NOW);
  const secondRun = buildMarketingRecommendationDrafts([...opportunities].reverse(), NOW);

  assert.deepEqual(
    firstRun.map((d) => d.dedupeKey).sort(),
    secondRun.map((d) => d.dedupeKey).sort()
  );
});

test("buildMarketingRecommendationDrafts: dedupeKey changes if the underlying opportunity group changes", () => {
  const single = buildMarketingRecommendationDrafts([opportunity({ id: "opp-1", category: "holiday" })], NOW);
  const merged = buildMarketingRecommendationDrafts(
    [opportunity({ id: "opp-1", category: "holiday" }), opportunity({ id: "opp-2", category: "weather" })],
    NOW
  );

  assert.notEqual(single[0].dedupeKey, merged[0].dedupeKey);
});

test("buildMarketingRecommendationDrafts: produces exactly one draft per distinct action type, never one per opportunity", () => {
  const opportunities = [
    opportunity({ id: "opp-1", category: "holiday" }),
    opportunity({ id: "opp-2", category: "holiday" }), // won't really happen (dedupe_key prevents 2 open same-category-same-key), but the engine should still merge correctly regardless
    opportunity({ id: "opp-3", category: "weather" }),
  ];

  const drafts = buildMarketingRecommendationDrafts(opportunities, NOW);
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].relatedOpportunityIds.length, 3);
});

// --- deterministic ordering ---

test("buildMarketingRecommendationDrafts: orders by priority_score descending", () => {
  const weak = opportunity({ id: "opp-weak", category: "missing_photos", severity: "low", confidence: 20 });
  const strong = opportunity({
    id: "opp-strong",
    category: "low_review_activity",
    severity: "critical",
    confidence: 95,
  });

  const drafts = buildMarketingRecommendationDrafts([weak, strong], NOW);

  assert.equal(drafts[0].recommendedActionType, "request_reviews");
  assert.equal(drafts[1].recommendedActionType, "upload_photos");
  assert.ok(drafts[0].priorityScore >= drafts[1].priorityScore);
});

test("buildMarketingRecommendationDrafts: ordering is fully deterministic across input orderings", () => {
  const opportunities = [
    opportunity({ id: "opp-1", category: "missing_gbp_posts", severity: "high", confidence: 80 }),
    opportunity({ id: "opp-2", category: "low_review_activity", severity: "medium", confidence: 60 }),
    opportunity({ id: "opp-3", category: "missing_photos", severity: "low", confidence: 40 }),
  ];

  const runA = buildMarketingRecommendationDrafts(opportunities, NOW);
  const runB = buildMarketingRecommendationDrafts([...opportunities].reverse(), NOW);
  const runC = buildMarketingRecommendationDrafts(
    [opportunities[2], opportunities[0], opportunities[1]],
    NOW
  );

  const orderA = runA.map((d) => d.recommendedActionType);
  const orderB = runB.map((d) => d.recommendedActionType);
  const orderC = runC.map((d) => d.recommendedActionType);

  assert.deepEqual(orderA, orderB);
  assert.deepEqual(orderA, orderC);
});

test("buildMarketingRecommendationDrafts: empty input produces empty output", () => {
  assert.deepEqual(buildMarketingRecommendationDrafts([], NOW), []);
});

// --- reasoning content ---

test("buildMarketingRecommendationDrafts: a single-opportunity recommendation's reasoning reflects that opportunity", () => {
  const [draft] = buildMarketingRecommendationDrafts(
    [opportunity({ id: "opp-1", category: "missing_gbp_posts", description: "No posts in 60 days." })],
    NOW
  );
  assert.equal(draft.reasoning, "No posts in 60 days.");
});

test("buildMarketingRecommendationDrafts: a merged recommendation's reasoning references all merged opportunities", () => {
  const [draft] = buildMarketingRecommendationDrafts(
    [
      opportunity({ id: "opp-1", category: "holiday", title: "Independence Day" }),
      opportunity({ id: "opp-2", category: "weather", title: "Heatwave incoming" }),
    ],
    NOW
  );
  assert.match(draft.reasoning, /Independence Day/);
  assert.match(draft.reasoning, /Heatwave incoming/);
});

// --- confidence aggregation ---

test("buildMarketingRecommendationDrafts: confidence is the average across a merged group", () => {
  const [draft] = buildMarketingRecommendationDrafts(
    [
      opportunity({ id: "opp-1", category: "holiday", confidence: 80 }),
      opportunity({ id: "opp-2", category: "weather", confidence: 60 }),
    ],
    NOW
  );
  assert.equal(draft.confidence, 70);
});

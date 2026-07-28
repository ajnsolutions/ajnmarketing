import test from "node:test";
import assert from "node:assert/strict";
import { buildReviewableInsights, guidedReviewItems, remainingItems, topDiscoveries } from "../lib/snapshot-ui/insightCatalog.ts";
import { InsightKeys } from "../lib/business-discovery/continuation/types.ts";
import type { PublicBusinessDiscoveryResultV1 } from "../lib/business-discovery/public/types.ts";

function insight(value: unknown, tier: "known" | "assumed" | "missing", sources: string[] = ["ai_website_analysis"]) {
  return { value, confidenceTier: tier, confidenceScore: tier === "known" ? 90 : tier === "assumed" ? 55 : 0, sources, reason: "because of real evidence", evidenceRefs: [] };
}

function fixtureSnapshot(overrides: Partial<PublicBusinessDiscoveryResultV1> = {}): PublicBusinessDiscoveryResultV1 {
  return {
    contractVersion: "v1",
    generatedAt: "2026-01-01T00:00:00.000Z",
    snapshotReference: "ref",
    websiteUrl: "https://acmehvac.example/",
    businessName: "Acme HVAC",
    city: null,
    stateOrRegion: null,
    businessSummary: insight("Acme HVAC serves Springfield.", "known", ["business_profile"]),
    primaryServices: insight(["AC repair", "Furnace installation"], "assumed"),
    likelyTargetCustomers: insight("Homeowners", "assumed"),
    brandPersonality: insight(["Friendly"], "missing", []),
    visibleStrengths: insight(["Fast response"], "assumed"),
    onlinePresence: {
      website: insight({ connected: true, analyzed: true }, "known", ["business_profile"]),
      googleBusinessProfile: insight({ connected: false }, "missing", []),
      socialPresence: insight(null, "missing", []),
    },
    possibleGrowthOpportunities: insight(["Spring tune-up promo"], "assumed"),
    missingOrUnclearInformation: [],
    overallConfidence: { tier: "assumed", label: "Building a picture", explanation: "x" },
    ...overrides,
  } as unknown as PublicBusinessDiscoveryResultV1;
}

test("buildReviewableInsights maps all 8 confirmable keys with plain-language labels", () => {
  const insights = buildReviewableInsights(fixtureSnapshot());
  assert.equal(insights.length, 8);
  const keys = insights.map((i) => i.key);
  assert.ok(keys.includes(InsightKeys.BUSINESS_SUMMARY));
  assert.ok(keys.includes(InsightKeys.POSSIBLE_GROWTH_OPPORTUNITIES));

  // No raw camelCase internal field names leak into the label.
  for (const item of insights) {
    assert.doesNotMatch(item.label, /[a-z][A-Z]/); // no camelCase
  }
});

test("buildReviewableInsights formats list values as a joined display string, never a raw array", () => {
  const insights = buildReviewableInsights(fixtureSnapshot());
  const services = insights.find((i) => i.key === InsightKeys.PRIMARY_SERVICES);
  assert.equal(services?.displayValue, "AC repair, Furnace installation");
});

test("buildReviewableInsights renders online presence booleans as plain language, not raw JSON", () => {
  const insights = buildReviewableInsights(fixtureSnapshot());
  const website = insights.find((i) => i.key === InsightKeys.ONLINE_PRESENCE_WEBSITE);
  assert.equal(website?.displayValue, "Connected and reviewed");
});

test("a Missing insight has a null displayValue rather than a fabricated placeholder value", () => {
  const insights = buildReviewableInsights(fixtureSnapshot());
  const gbp = insights.find((i) => i.key === InsightKeys.ONLINE_PRESENCE_GOOGLE_BUSINESS_PROFILE);
  assert.equal(gbp?.displayValue, null);
});

test("topDiscoveries returns exactly the 3 foundational insights, in a stable order", () => {
  const insights = buildReviewableInsights(fixtureSnapshot());
  const top = topDiscoveries(insights);
  assert.deepEqual(
    top.map((i) => i.key),
    [InsightKeys.BUSINESS_SUMMARY, InsightKeys.PRIMARY_SERVICES, InsightKeys.LIKELY_TARGET_CUSTOMERS]
  );
});

test("guidedReviewItems surfaces Missing insights and high-priority Assumed insights", () => {
  const insights = buildReviewableInsights(fixtureSnapshot());
  const guided = guidedReviewItems(insights);
  const guidedKeys = guided.map((i) => i.key);

  assert.ok(guidedKeys.includes(InsightKeys.ONLINE_PRESENCE_GOOGLE_BUSINESS_PROFILE)); // Missing
  assert.ok(guidedKeys.includes(InsightKeys.PRIMARY_SERVICES)); // Assumed + high priority
  assert.ok(guidedKeys.includes(InsightKeys.LIKELY_TARGET_CUSTOMERS)); // Assumed + high priority
});

test("guidedReviewItems excludes Known insights and low-priority Assumed insights", () => {
  const insights = buildReviewableInsights(fixtureSnapshot());
  const guided = guidedReviewItems(insights);
  const guidedKeys = guided.map((i) => i.key);

  assert.equal(guidedKeys.includes(InsightKeys.BUSINESS_SUMMARY), false); // Known
  assert.equal(guidedKeys.includes(InsightKeys.VISIBLE_STRENGTHS), false); // Assumed but not high priority
});

test("guidedReviewItems and remainingItems are perfectly complementary, no overlap and no omission", () => {
  const insights = buildReviewableInsights(fixtureSnapshot());
  const guided = new Set(guidedReviewItems(insights).map((i) => i.key));
  const remaining = new Set(remainingItems(insights).map((i) => i.key));

  for (const key of guided) assert.equal(remaining.has(key), false);
  assert.equal(guided.size + remaining.size, insights.length);
});

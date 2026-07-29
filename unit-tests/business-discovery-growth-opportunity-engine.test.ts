import test from "node:test";
import assert from "node:assert/strict";
import { buildGrowthOpportunities, type GrowthOpportunityContext } from "../lib/business-discovery/growthOpportunityEngine.ts";

function baseContext(overrides: Partial<GrowthOpportunityContext> = {}): GrowthOpportunityContext {
  return {
    industry: null,
    services: [],
    citiesMentioned: [],
    seoIssues: [],
    hasGoogleBusinessProfile: true,
    hasReviews: true,
    ...overrides,
  };
}

test("never embeds a bracket-style priority tag in the string — priority is order, not text (would leak into other consumers like the dashboard)", () => {
  const results = buildGrowthOpportunities(baseContext({ hasGoogleBusinessProfile: false }));
  for (const opportunity of results) {
    assert.ok(!/^\[/.test(opportunity), `opportunity string starts with a bracket tag: "${opportunity}"`);
  }
});

test("returns at most 3 opportunities, with the highest-priority one always first", () => {
  const results = buildGrowthOpportunities(
    baseContext({ hasGoogleBusinessProfile: false, hasReviews: false, citiesMentioned: [] })
  );
  assert.ok(results.length <= 3);
  assert.match(results[0], /Google Business Profile/i);
});

test("an HVAC business without a maintenance-plan service gets that specific suggestion", () => {
  const results = buildGrowthOpportunities(
    baseContext({ industry: "hvac", services: ["AC repair", "Furnace installation"] })
  );
  assert.ok(results.some((item) => /maintenance-plan/i.test(item)));
});

test("an HVAC business that already has a maintenance plan does not get told to add one", () => {
  const results = buildGrowthOpportunities(
    baseContext({ industry: "hvac", services: ["AC repair", "Seasonal maintenance plan"] })
  );
  assert.ok(!results.some((item) => /Add a maintenance-plan page/i.test(item)));
});

test("a restaurant gets restaurant-specific advice, not generic marketing tips", () => {
  const results = buildGrowthOpportunities(baseContext({ industry: "restaurant" }));
  assert.ok(results.some((item) => /menu/i.test(item)));
});

test("a business with no GBP connection is always told to connect it, regardless of industry", () => {
  const results = buildGrowthOpportunities(baseContext({ industry: "dental", hasGoogleBusinessProfile: false }));
  assert.ok(results.some((item) => /Google Business Profile/i.test(item)));
});

test("never repeats the exact same opportunity string twice", () => {
  const results = buildGrowthOpportunities(baseContext({ industry: "hvac", hasGoogleBusinessProfile: false, hasReviews: false }));
  assert.equal(new Set(results).size, results.length);
});

test("an unclassified (null industry) business still gets generic, evidence-gated opportunities", () => {
  const results = buildGrowthOpportunities(baseContext({ industry: null, hasGoogleBusinessProfile: false }));
  assert.ok(results.length > 0);
  assert.ok(results.some((item) => /Google Business Profile/i.test(item)));
});

test("a fully-covered business (GBP connected, reviews present, multi-city) gets fewer or no urgent opportunities", () => {
  const results = buildGrowthOpportunities(
    baseContext({ industry: null, hasGoogleBusinessProfile: true, hasReviews: true, citiesMentioned: ["Springfield", "Shelbyville"] })
  );
  assert.ok(!results.some((item) => /Google Business Profile/i.test(item)));
  assert.ok(!results.some((item) => /don't have any public reviews/i.test(item)));
});

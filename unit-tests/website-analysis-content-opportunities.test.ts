import test from "node:test";
import assert from "node:assert/strict";
import { inferContentOpportunitiesFromSummary } from "../lib/website-analysis/content-opportunities.ts";

function extraction(overrides: Partial<{
  businessName: string;
  industry: string;
  primaryServices: string[];
  secondaryServices: string[];
  keywords: string[];
  customerPersona: string;
}> = {}) {
  return {
    businessName: "Acme HVAC",
    industry: "HVAC",
    primaryServices: [],
    secondaryServices: [],
    keywords: [],
    customerPersona: "Homeowners",
    ...overrides,
  };
}

test("does not repeat the exact same title pattern twice across generated opportunities", () => {
  const result = inferContentOpportunitiesFromSummary(
    extraction({ primaryServices: ["AC Repair", "Furnace Installation", "Duct Cleaning", "Thermostat Install"] })
  );
  const titles = result.map((item) => item.title);
  assert.equal(new Set(titles).size, titles.length);
});

test("scores a primary-service topic higher than a keyword-derived topic, grounding relevance in centrality rather than raw position", () => {
  const result = inferContentOpportunitiesFromSummary(
    extraction({ primaryServices: ["Furnace Repair"], keywords: ["local", "trusted", "affordable"] })
  );
  const primaryScore = result.find((item) => item.title.includes("Furnace Repair"))?.seoScore ?? 0;
  const keywordScore = result.find((item) => item.title.includes("local"))?.seoScore ?? 0;
  assert.ok(primaryScore > keywordScore);
});

test("every generated seoScore stays within the documented 50-98 bound", () => {
  const result = inferContentOpportunitiesFromSummary(
    extraction({ primaryServices: ["A", "B", "C", "D"], secondaryServices: ["E", "F"], keywords: ["g", "h"] })
  );
  for (const item of result) {
    assert.ok(item.seoScore >= 50 && item.seoScore <= 98);
  }
});

test("falls back to two neutral opportunities when there are no topics at all", () => {
  const result = inferContentOpportunitiesFromSummary(extraction({ primaryServices: [], secondaryServices: [], keywords: [] }));
  assert.equal(result.length, 2);
});

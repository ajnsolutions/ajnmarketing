import test from "node:test";
import assert from "node:assert/strict";
import { classifyIndustryFromText, GENERIC_INDUSTRY_FALLBACK, industryCategoryById } from "../lib/business-discovery/industryTaxonomy.ts";

test("classifies a clear HVAC website as hvac with high confidence", () => {
  const text = "We repair furnaces, install heat pumps, and service HVAC and air conditioning systems across the metro area.";
  const result = classifyIndustryFromText(text);
  assert.equal(result.category?.id, "hvac");
  assert.equal(result.confidence, "high");
});

test("classifies a clear dental practice as dental", () => {
  const text = "Our dentists provide teeth cleaning, root canal treatment, and general dentistry for the whole family.";
  const result = classifyIndustryFromText(text);
  assert.equal(result.category?.id, "dental");
});

test("classifies a restaurant website as restaurant", () => {
  const text = "View our menu, make a reservation, or order takeout. Our chef features seasonal cuisine and a weekly happy hour.";
  const result = classifyIndustryFromText(text);
  assert.equal(result.category?.id, "restaurant");
});

test("classifies a SaaS product page as saas", () => {
  const text = "Start your free trial today. Our SaaS platform integrates via API and offers a per seat subscription plan with a live dashboard.";
  const result = classifyIndustryFromText(text);
  assert.equal(result.category?.id, "saas");
});

test("returns no category (honest 'don't know') for text with no industry signal at all", () => {
  const result = classifyIndustryFromText("Welcome to our website. We are here to help you.");
  assert.equal(result.category, null);
  assert.equal(result.confidence, "none");
  assert.equal(result.label, GENERIC_INDUSTRY_FALLBACK);
});

test("scores by weighted frequency, not first-pattern-match — a single incidental mention loses to a dominant theme", () => {
  // Mentions "dental" once in passing, but is overwhelmingly about roofing.
  const text =
    "Our roofing company handles roof repair, roof replacement, shingle installation, and gutter work. We once fixed a dentist's office roof.";
  const result = classifyIndustryFromText(text);
  assert.equal(result.category?.id, "roofing");
});

test("industryCategoryById resolves a known id and returns undefined for an unknown one", () => {
  assert.equal(industryCategoryById("hvac")?.label, "HVAC / Heating & Cooling");
  assert.equal(industryCategoryById("not_a_real_id" as never), undefined);
});

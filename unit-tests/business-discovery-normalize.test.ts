import test from "node:test";
import assert from "node:assert/strict";
import { normalizeBusinessDiscoveryObservations } from "../lib/business-discovery/normalize.ts";
import { DiscoverySourceTypes, type BusinessDiscoveryObservation } from "../lib/business-discovery/types.ts";

function observation(overrides: Partial<BusinessDiscoveryObservation>): BusinessDiscoveryObservation {
  return {
    source: DiscoverySourceTypes.BUSINESS_PROFILE,
    field: "businessName",
    value: "Acme HVAC",
    isVerifiedFact: true,
    evidenceDetail: "entered on your business profile",
    collectedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test("a field with zero observations stays genuinely empty", () => {
  const unified = normalizeBusinessDiscoveryObservations("profile-1", []);
  assert.equal(unified.businessName.value, null);
  assert.equal(unified.businessName.hasVerifiedFactSource, false);
  assert.deepEqual(unified.businessName.contributingSources, []);
  assert.deepEqual(unified.businessName.evidenceRefs, []);
});

test("a verified-fact observation wins over an AI-inferred one for scalar fields", () => {
  const observations = [
    observation({
      field: "businessName",
      value: "Website-Guessed Name",
      isVerifiedFact: false,
      source: DiscoverySourceTypes.AI_WEBSITE_ANALYSIS,
    }),
    observation({ field: "businessName", value: "Acme HVAC", isVerifiedFact: true }),
  ];

  const unified = normalizeBusinessDiscoveryObservations("profile-1", observations);
  assert.equal(unified.businessName.value, "Acme HVAC");
  assert.equal(unified.businessName.hasVerifiedFactSource, true);
  assert.equal(unified.businessName.contributingSources.length, 2);
});

test("array fields union and case-insensitively dedupe across sources, keeping first-seen casing", () => {
  const observations = [
    observation({
      field: "primaryServices",
      value: ["AC Repair", "Furnace Installation"],
      source: DiscoverySourceTypes.BUSINESS_PROFILE,
    }),
    observation({
      field: "primaryServices",
      value: ["ac repair", "Duct Cleaning"],
      source: DiscoverySourceTypes.AI_WEBSITE_ANALYSIS,
      isVerifiedFact: false,
    }),
  ];

  const unified = normalizeBusinessDiscoveryObservations("profile-1", observations);
  assert.deepEqual(unified.primaryServices.value, ["AC Repair", "Furnace Installation", "Duct Cleaning"]);
  assert.equal(unified.primaryServices.hasVerifiedFactSource, true);
  assert.equal(unified.primaryServices.contributingSources.length, 2);
});

test("an AI-only field (no verified-fact source) is preserved but flagged as not verified", () => {
  const observations = [
    observation({
      field: "targetAudience",
      value: "Homeowners",
      isVerifiedFact: false,
      source: DiscoverySourceTypes.AI_WEBSITE_ANALYSIS,
    }),
  ];

  const unified = normalizeBusinessDiscoveryObservations("profile-1", observations);
  assert.equal(unified.targetAudience.value, "Homeowners");
  assert.equal(unified.targetAudience.hasVerifiedFactSource, false);
});

test("evidenceRefs preserve one entry per contributing observation", () => {
  const observations = [
    observation({ field: "competitors", value: ["Bob's HVAC"], evidenceDetail: "competitors you listed" }),
    observation({
      field: "competitors",
      value: ["Springfield Cooling"],
      source: DiscoverySourceTypes.MARKET_CONTEXT,
      isVerifiedFact: false,
      evidenceDetail: "1 competitor signal tracked in Market Context",
    }),
  ];

  const unified = normalizeBusinessDiscoveryObservations("profile-1", observations);
  assert.equal(unified.competitors.evidenceRefs.length, 2);
  assert.deepEqual(
    unified.competitors.evidenceRefs.map((ref) => ref.detail),
    ["competitors you listed", "1 competitor signal tracked in Market Context"]
  );
});

test("businessProfileId passes through unchanged", () => {
  const unified = normalizeBusinessDiscoveryObservations("profile-42", []);
  assert.equal(unified.businessProfileId, "profile-42");
});

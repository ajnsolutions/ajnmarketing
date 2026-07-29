import test from "node:test";
import assert from "node:assert/strict";
import { mapToPublicBusinessDiscoveryResult } from "../lib/business-discovery/public/mapPublicResult.ts";
import { DiscoveryConfidenceTiers, DiscoverySourceTypes, type BusinessDiscoveryResult, type DiscoveryInsight } from "../lib/business-discovery/types.ts";

function knownInsight<T>(value: T): DiscoveryInsight<T> {
  return { value, confidenceTier: DiscoveryConfidenceTiers.KNOWN, confidenceScore: 90, sources: [DiscoverySourceTypes.BUSINESS_PROFILE], reason: "known", evidenceRefs: [] };
}

function missingInsight<T>(): DiscoveryInsight<T> {
  return { value: null, confidenceTier: DiscoveryConfidenceTiers.MISSING, confidenceScore: 0, sources: [], reason: "missing", evidenceRefs: [] };
}

function buildInternalResult(overrides: Partial<BusinessDiscoveryResult> = {}): BusinessDiscoveryResult {
  return {
    businessProfileId: "ephemeral-1",
    generatedAt: "2026-01-01T00:00:00.000Z",
    businessSummary: knownInsight("Acme HVAC serves Springfield."),
    primaryServices: knownInsight(["AC repair"]),
    targetCustomers: knownInsight("Homeowners"),
    brandPersonality: missingInsight(),
    uniqueStrengths: missingInsight(),
    customerPerception: missingInsight(),
    competitivePosition: missingInsight(),
    onlinePresence: {
      website: knownInsight({ connected: true, analyzed: true }),
      googleBusinessProfile: missingInsight(),
      socialPresence: missingInsight(),
    },
    growthOpportunities: missingInsight(),
    missingInformation: [
      { field: "brandPersonality", reason: "missing", suggestedNextAction: "set brand voice" },
      { field: "uniqueStrengths", reason: "missing", suggestedNextAction: "run analysis" },
      { field: "customerPerception", reason: "missing", suggestedNextAction: "connect GBP" },
      { field: "competitivePosition", reason: "missing", suggestedNextAction: "add competitors" },
      { field: "onlinePresence.googleBusinessProfile", reason: "missing", suggestedNextAction: "connect GBP" },
      { field: "growthOpportunities", reason: "missing", suggestedNextAction: "run analysis" },
    ],
    businessConfidence: { score: 40, label: "building_a_picture", explanation: "internal only", knownFieldCount: 4, assumedFieldCount: 0, missingFieldCount: 6 },
    ...overrides,
  };
}

test("drops customerPerception and competitivePosition from the public contract entirely", () => {
  const publicResult = mapToPublicBusinessDiscoveryResult(buildInternalResult(), "ref-123", { websiteUrl: "https://example.com/", businessName: null, city: null, stateOrRegion: null });
  assert.equal("customerPerception" in publicResult, false);
  assert.equal("competitivePosition" in publicResult, false);
});

test("renames fields to the public contract's vocabulary", () => {
  const internal = buildInternalResult();
  const publicResult = mapToPublicBusinessDiscoveryResult(internal, "ref-123", { websiteUrl: "https://example.com/", businessName: null, city: null, stateOrRegion: null });
  assert.equal(publicResult.likelyTargetCustomers.value, "Homeowners");
  assert.equal(publicResult.visibleStrengths.confidenceTier, DiscoveryConfidenceTiers.MISSING);
  assert.equal(publicResult.possibleGrowthOpportunities.confidenceTier, DiscoveryConfidenceTiers.MISSING);
});

test("missingOrUnclearInformation excludes the two dropped fields and renames the rest", () => {
  const publicResult = mapToPublicBusinessDiscoveryResult(buildInternalResult(), "ref-123", { websiteUrl: "https://example.com/", businessName: null, city: null, stateOrRegion: null });
  const fields = publicResult.missingOrUnclearInformation.map((item) => item.field);
  assert.equal(fields.includes("customerPerception"), false);
  assert.equal(fields.includes("competitivePosition"), false);
  assert.ok(fields.includes("visibleStrengths"));
  assert.ok(fields.includes("possibleGrowthOpportunities"));
  assert.ok(fields.includes("onlinePresence.googleBusinessProfile"));
});

test("embeds the given snapshotReference and contract version", () => {
  const publicResult = mapToPublicBusinessDiscoveryResult(buildInternalResult(), "opaque-ref-abc", { websiteUrl: "https://example.com/", businessName: null, city: null, stateOrRegion: null });
  assert.equal(publicResult.snapshotReference, "opaque-ref-abc");
  assert.equal(publicResult.contractVersion, "v1");
});

test("never exposes a raw confidence score at the top level — only a label and explanation", () => {
  const publicResult = mapToPublicBusinessDiscoveryResult(buildInternalResult(), "ref-123", { websiteUrl: "https://example.com/", businessName: null, city: null, stateOrRegion: null });
  assert.equal("score" in publicResult.overallConfidence, false);
  assert.ok(publicResult.overallConfidence.label.length > 0);
  assert.ok(publicResult.overallConfidence.explanation.length > 0);
});

test("overall confidence tier is Known only when every public-relevant field is Known", () => {
  const allKnown = buildInternalResult({
    brandPersonality: knownInsight(["Friendly"]),
    uniqueStrengths: knownInsight(["Fast response"]),
    growthOpportunities: knownInsight(["Spring promo"]),
    onlinePresence: {
      website: knownInsight({ connected: true, analyzed: true }),
      googleBusinessProfile: knownInsight({ connected: true }),
      socialPresence: missingInsight(),
    },
  });
  const publicResult = mapToPublicBusinessDiscoveryResult(allKnown, "ref-123", { websiteUrl: "https://example.com/", businessName: null, city: null, stateOrRegion: null });
  assert.equal(publicResult.overallConfidence.tier, DiscoveryConfidenceTiers.KNOWN);
});

test("overall confidence tier is Missing only when every public-relevant field is Missing", () => {
  const allMissing = buildInternalResult({
    businessSummary: missingInsight(),
    primaryServices: missingInsight(),
    targetCustomers: missingInsight(),
    onlinePresence: {
      website: missingInsight(),
      googleBusinessProfile: missingInsight(),
      socialPresence: missingInsight(),
    },
  });
  const publicResult = mapToPublicBusinessDiscoveryResult(allMissing, "ref-123", { websiteUrl: "https://example.com/", businessName: null, city: null, stateOrRegion: null });
  assert.equal(publicResult.overallConfidence.tier, DiscoveryConfidenceTiers.MISSING);
});

test("a real mix of Known and Missing fields never gets stuck permanently low due to the two dropped fields", () => {
  // customerPerception and competitivePosition are ALWAYS Missing pre-auth (no reviews/market context).
  // The public confidence recompute must not let those two permanently-Missing fields drag every
  // public snapshot down — it only ever considers the 8 fields the public contract actually reports.
  const strongPublicSignal = buildInternalResult({
    brandPersonality: knownInsight(["Friendly", "Direct"]),
    uniqueStrengths: knownInsight(["Fast response time"]),
    growthOpportunities: knownInsight(["Spring tune-up promo"]),
    onlinePresence: {
      website: knownInsight({ connected: true, analyzed: true }),
      googleBusinessProfile: missingInsight(),
      socialPresence: missingInsight(),
    },
  });
  const publicResult = mapToPublicBusinessDiscoveryResult(strongPublicSignal, "ref-123", { websiteUrl: "https://example.com/", businessName: null, city: null, stateOrRegion: null });
  assert.notEqual(publicResult.overallConfidence.tier, DiscoveryConfidenceTiers.MISSING);
});

test("defaults to degraded: false when the caller doesn't specify it", () => {
  const publicResult = mapToPublicBusinessDiscoveryResult(buildInternalResult(), "ref-123", {
    websiteUrl: "https://example.com/",
    businessName: null,
    city: null,
    stateOrRegion: null,
  });
  assert.equal(publicResult.degraded, false);
});

test("honestly threads through a true degraded flag — never silently hidden from the client", () => {
  const publicResult = mapToPublicBusinessDiscoveryResult(
    buildInternalResult(),
    "ref-123",
    { websiteUrl: "https://example.com/", businessName: null, city: null, stateOrRegion: null },
    true
  );
  assert.equal(publicResult.degraded, true);
});

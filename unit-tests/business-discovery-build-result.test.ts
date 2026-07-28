import test from "node:test";
import assert from "node:assert/strict";
import { buildBusinessDiscoveryResult } from "../lib/business-discovery/buildResult.ts";
import { LOW_CONFIDENCE_CUSTOMER_PERSONA } from "../lib/website-analysis/customer-persona.ts";
import {
  DiscoveryConfidenceTiers,
  DiscoverySourceTypes,
  type MergedField,
  type UnifiedBusinessProfile,
} from "../lib/business-discovery/types.ts";

function emptyField<T>(): MergedField<T> {
  return { value: null, contributingSources: [], hasVerifiedFactSource: false, evidenceRefs: [] };
}

function emptyUnifiedProfile(): UnifiedBusinessProfile {
  return {
    businessProfileId: "profile-1",
    businessName: emptyField(),
    businessSummary: emptyField(),
    industry: emptyField(),
    website: emptyField(),
    primaryServices: emptyField(),
    serviceAreas: emptyField(),
    tone: emptyField(),
    brandPersonality: emptyField(),
    targetAudience: emptyField(),
    competitors: emptyField(),
    strengths: emptyField(),
    growthOpportunities: emptyField(),
    reviewSummary: emptyField(),
    googleBusinessProfileConnected: emptyField(),
    websiteAnalyzed: emptyField(),
  };
}

test("a fully empty UnifiedBusinessProfile produces an all-Missing result with an honest confidence score", () => {
  const result = buildBusinessDiscoveryResult(emptyUnifiedProfile());

  assert.equal(result.businessSummary.confidenceTier, DiscoveryConfidenceTiers.MISSING);
  assert.equal(result.primaryServices.confidenceTier, DiscoveryConfidenceTiers.MISSING);
  assert.equal(result.targetCustomers.confidenceTier, DiscoveryConfidenceTiers.MISSING);
  assert.equal(result.onlinePresence.socialPresence.confidenceTier, DiscoveryConfidenceTiers.MISSING);
  assert.equal(result.businessConfidence.score, 0);
  assert.equal(result.businessConfidence.missingFieldCount, 10);
  assert.equal(result.missingInformation.length, 10);
});

test("every insight includes a non-empty, plain-language reason even when missing", () => {
  const result = buildBusinessDiscoveryResult(emptyUnifiedProfile());
  assert.ok(result.businessSummary.reason.length > 0);
  assert.ok(result.primaryServices.reason.length > 0);
  assert.ok(result.customerPerception.reason.length > 0);
  assert.ok(result.onlinePresence.googleBusinessProfile.reason.length > 0);
});

test("a verified-fact field resolves to Known with a high confidence score", () => {
  const unified = emptyUnifiedProfile();
  unified.primaryServices = {
    value: ["AC repair", "Furnace installation"],
    contributingSources: [DiscoverySourceTypes.BUSINESS_PROFILE],
    hasVerifiedFactSource: true,
    evidenceRefs: [{ source: DiscoverySourceTypes.BUSINESS_PROFILE, detail: "services you listed on your business profile" }],
  };

  const result = buildBusinessDiscoveryResult(unified);
  assert.equal(result.primaryServices.confidenceTier, DiscoveryConfidenceTiers.KNOWN);
  assert.match(result.primaryServices.reason, /You told us/);
  assert.ok(result.primaryServices.confidenceScore > 80);
});

test("an AI-only field resolves to Assumed, never Known, and names the evidence in the reason", () => {
  const unified = emptyUnifiedProfile();
  unified.targetAudience = {
    value: "Homeowners needing residential HVAC installation",
    contributingSources: [DiscoverySourceTypes.AI_WEBSITE_ANALYSIS],
    hasVerifiedFactSource: false,
    evidenceRefs: [{ source: DiscoverySourceTypes.AI_WEBSITE_ANALYSIS, detail: "who your website's language is written for" }],
  };

  const result = buildBusinessDiscoveryResult(unified);
  assert.equal(result.targetCustomers.confidenceTier, DiscoveryConfidenceTiers.ASSUMED);
  assert.match(result.targetCustomers.reason, /We believe/);
  assert.match(result.targetCustomers.reason, /who your website's language is written for/);
});

test("customerPerception summarizes review count and average rating honestly", () => {
  const unified = emptyUnifiedProfile();
  unified.reviewSummary = {
    value: { reviewCount: 12, averageRating: 4.6 },
    contributingSources: [DiscoverySourceTypes.PUBLIC_REVIEWS],
    hasVerifiedFactSource: true,
    evidenceRefs: [{ source: DiscoverySourceTypes.PUBLIC_REVIEWS, detail: "12 public reviews averaging 4.6 stars" }],
  };

  const result = buildBusinessDiscoveryResult(unified);
  assert.equal(result.customerPerception.confidenceTier, DiscoveryConfidenceTiers.KNOWN);
  assert.match(result.customerPerception.value ?? "", /12 public reviews/);
  assert.match(result.customerPerception.value ?? "", /4\.6 stars/);
});

test("onlinePresence.socialPresence is always Missing — no collector exists yet", () => {
  const unified = emptyUnifiedProfile();
  unified.website = {
    value: "https://acmehvac.example",
    contributingSources: [DiscoverySourceTypes.BUSINESS_PROFILE],
    hasVerifiedFactSource: true,
    evidenceRefs: [],
  };
  unified.googleBusinessProfileConnected = {
    value: true,
    contributingSources: [DiscoverySourceTypes.GOOGLE_BUSINESS_PROFILE],
    hasVerifiedFactSource: true,
    evidenceRefs: [],
  };

  const result = buildBusinessDiscoveryResult(unified);
  assert.equal(result.onlinePresence.website.confidenceTier, DiscoveryConfidenceTiers.KNOWN);
  assert.equal(result.onlinePresence.googleBusinessProfile.value?.connected, true);
  assert.equal(result.onlinePresence.socialPresence.confidenceTier, DiscoveryConfidenceTiers.MISSING);
  assert.equal(result.onlinePresence.socialPresence.value, null);
});

test("website presence distinguishes 'on file' from 'analyzed'", () => {
  const unified = emptyUnifiedProfile();
  unified.website = {
    value: "https://acmehvac.example",
    contributingSources: [DiscoverySourceTypes.BUSINESS_PROFILE],
    hasVerifiedFactSource: true,
    evidenceRefs: [],
  };
  unified.websiteAnalyzed = emptyField(); // not analyzed yet

  const result = buildBusinessDiscoveryResult(unified);
  assert.equal(result.onlinePresence.website.value?.connected, true);
  assert.equal(result.onlinePresence.website.value?.analyzed, false);
  assert.match(result.onlinePresence.website.reason, /hasn't been analyzed yet/);
});

test("a mix of Known/Assumed/Missing fields produces a mid-range confidence score and label", () => {
  const unified = emptyUnifiedProfile();
  unified.primaryServices = {
    value: ["AC repair"],
    contributingSources: [DiscoverySourceTypes.BUSINESS_PROFILE],
    hasVerifiedFactSource: true,
    evidenceRefs: [],
  };
  unified.targetAudience = {
    value: "Homeowners",
    contributingSources: [DiscoverySourceTypes.AI_WEBSITE_ANALYSIS],
    hasVerifiedFactSource: false,
    evidenceRefs: [],
  };

  const result = buildBusinessDiscoveryResult(unified);
  assert.equal(result.businessConfidence.knownFieldCount, 1);
  assert.equal(result.businessConfidence.assumedFieldCount, 1);
  assert.equal(result.businessConfidence.missingFieldCount, 8);
  assert.ok(result.businessConfidence.score > 0 && result.businessConfidence.score < 30);
});

test("missingInformation always includes an actionable suggestedNextAction", () => {
  const result = buildBusinessDiscoveryResult(emptyUnifiedProfile());
  for (const item of result.missingInformation) {
    assert.ok(item.reason.length > 0);
    assert.ok(item.suggestedNextAction.length > 0);
  }
});

test("generatedAt is a valid ISO timestamp and businessProfileId passes through", () => {
  const result = buildBusinessDiscoveryResult(emptyUnifiedProfile());
  assert.equal(result.businessProfileId, "profile-1");
  assert.ok(!Number.isNaN(new Date(result.generatedAt).getTime()));
});

test("a target-audience value that is only the low-confidence placeholder persona reads as Missing, not Assumed", () => {
  const unified = emptyUnifiedProfile();
  unified.targetAudience = {
    value: LOW_CONFIDENCE_CUSTOMER_PERSONA,
    contributingSources: [DiscoverySourceTypes.AI_WEBSITE_ANALYSIS],
    hasVerifiedFactSource: false,
    evidenceRefs: [{ source: DiscoverySourceTypes.AI_WEBSITE_ANALYSIS, detail: "who your website's language is written for" }],
  };

  const result = buildBusinessDiscoveryResult(unified);
  assert.equal(result.targetCustomers.confidenceTier, DiscoveryConfidenceTiers.MISSING);
  assert.equal(result.targetCustomers.value, null);
  assert.match(result.targetCustomers.reason, /don't yet know/);
});

test("a real (non-placeholder) AI-inferred persona still resolves to Assumed as before", () => {
  const unified = emptyUnifiedProfile();
  unified.targetAudience = {
    value: "Patients looking for routine dental care nearby",
    contributingSources: [DiscoverySourceTypes.AI_WEBSITE_ANALYSIS],
    hasVerifiedFactSource: false,
    evidenceRefs: [{ source: DiscoverySourceTypes.AI_WEBSITE_ANALYSIS, detail: "who your website's language is written for" }],
  };

  const result = buildBusinessDiscoveryResult(unified);
  assert.equal(result.targetCustomers.confidenceTier, DiscoveryConfidenceTiers.ASSUMED);
  assert.equal(result.targetCustomers.value, "Patients looking for routine dental care nearby");
});

test("when 2+ distinct sources corroborate a field, the reason names the agreement instead of reading like one generic guess", () => {
  const unified = emptyUnifiedProfile();
  unified.primaryServices = {
    value: ["AC repair", "Furnace installation"],
    contributingSources: [DiscoverySourceTypes.AI_WEBSITE_ANALYSIS, DiscoverySourceTypes.AI_MARKETING_PROFILE],
    hasVerifiedFactSource: false,
    evidenceRefs: [
      { source: DiscoverySourceTypes.AI_WEBSITE_ANALYSIS, detail: "services mentioned on your website" },
      { source: DiscoverySourceTypes.AI_MARKETING_PROFILE, detail: "services in your AI Marketing Profile" },
    ],
  };

  const result = buildBusinessDiscoveryResult(unified);
  assert.match(result.primaryServices.reason, /2 signals agreeing/);
});

test("a single-source Assumed field still reads as a plain, specific reason with no false 'signals agreeing' claim", () => {
  const unified = emptyUnifiedProfile();
  unified.primaryServices = {
    value: ["AC repair"],
    contributingSources: [DiscoverySourceTypes.AI_WEBSITE_ANALYSIS],
    hasVerifiedFactSource: false,
    evidenceRefs: [{ source: DiscoverySourceTypes.AI_WEBSITE_ANALYSIS, detail: "services mentioned on your website" }],
  };

  const result = buildBusinessDiscoveryResult(unified);
  assert.ok(!/signals agreeing/.test(result.primaryServices.reason));
  assert.match(result.primaryServices.reason, /services mentioned on your website/);
});

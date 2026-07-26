import test from "node:test";
import assert from "node:assert/strict";
import {
  collectAiMarketingProfileObservations,
  collectBusinessDiscoveryObservations,
  collectBusinessProfileObservations,
  collectGoogleBusinessProfileObservations,
  collectMarketContextObservations,
  collectPublicReviewObservations,
  collectWebsiteAnalysisObservations,
} from "../lib/business-discovery/collectors.ts";
import { DiscoverySourceTypes } from "../lib/business-discovery/types.ts";
import type { BusinessProfile } from "../lib/business-profile.ts";
import type { WebsiteAnalysis } from "../lib/website-analysis/types.ts";
import type { AiMarketingProfile } from "../lib/ai-marketing-profile/types.ts";

const baseProfile: BusinessProfile = {
  id: "profile-1",
  user_id: "user-1",
  business_name: "Acme HVAC",
  industry: "HVAC",
  website: "https://acmehvac.example",
  phone: null,
  city: "Springfield",
  state: "IL",
  primary_service_area: "Springfield, IL",
  nearby_cities: "Chatham, Rochester",
  primary_services: "AC repair, Furnace installation",
  emergency_services: null,
  seasonal_services: null,
  specialty_services: null,
  competitors: "Bob's HVAC, Springfield Cooling",
  marketing_goals: null,
  brand_voice_tone: "Friendly and direct",
  preferred_words: null,
  avoid_words: null,
  voice_notes: null,
  onboarding_completed: true,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-02T00:00:00.000Z",
};

test("collectBusinessProfileObservations returns nothing for a null profile", () => {
  assert.deepEqual(collectBusinessProfileObservations(null), []);
});

test("collectBusinessProfileObservations marks every observation as a verified fact", () => {
  const observations = collectBusinessProfileObservations(baseProfile);
  assert.ok(observations.length > 0);
  for (const entry of observations) {
    assert.equal(entry.isVerifiedFact, true);
    assert.equal(entry.source, DiscoverySourceTypes.BUSINESS_PROFILE);
  }
});

test("collectBusinessProfileObservations parses delimited primary services and competitors", () => {
  const observations = collectBusinessProfileObservations(baseProfile);
  const services = observations.find((entry) => entry.field === "primaryServices");
  const competitors = observations.find((entry) => entry.field === "competitors");

  assert.deepEqual(services?.value, ["AC repair", "Furnace installation"]);
  assert.deepEqual(competitors?.value, ["Bob's HVAC", "Springfield Cooling"]);
});

test("collectBusinessProfileObservations omits empty fields rather than emitting a blank observation", () => {
  const observations = collectBusinessProfileObservations({ ...baseProfile, competitors: null, phone: null });
  assert.equal(observations.some((entry) => entry.field === "competitors"), false);
});

const baseWebsiteAnalysis: WebsiteAnalysis = {
  id: "analysis-1",
  user_id: "user-1",
  business_profile_id: "profile-1",
  website: "https://acmehvac.example",
  analysis_status: "completed",
  analysis_score: 82,
  brand_voice: "Warm and professional",
  tone: "Warm and professional",
  keywords: ["hvac", "repair"],
  services: [],
  cities: ["Springfield"],
  seo_score: 75,
  seo_findings: [],
  raw_summary: {
    businessName: "Acme HVAC",
    industry: "HVAC",
    primaryServices: ["AC repair"],
    secondaryServices: ["Duct cleaning"],
    serviceAreas: ["Springfield"],
    citiesMentioned: ["Springfield"],
    phoneNumbers: [],
    emailAddresses: [],
    businessHours: [],
    callsToAction: [],
    keywords: ["hvac"],
    brandVoice: "Warm and professional",
    readingLevel: "Easy",
    tone: "Warm and professional",
    customerPersona: "Homeowners needing residential HVAC installation",
    valueProposition: "Fast, honest service",
    metaTitle: "Acme HVAC",
    metaDescription: "HVAC services",
    h1Headings: ["Welcome"],
    seoIssues: [],
    internalLinks: 10,
    pageCountEstimate: 5,
    strengths: ["Fast response time", "Licensed technicians"],
    weaknesses: [],
    highestRoiImprovements: ["Add more service-area pages"],
    nextRecommendedActions: "",
    executiveSummary: "Acme HVAC is a residential HVAC company serving Springfield, IL.",
    contentOpportunities: [{ title: "Spring tune-up guide", seoScore: 80, competition: "Low" }],
  },
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-03T00:00:00.000Z",
};

test("collectWebsiteAnalysisObservations returns nothing when analysis is not completed", () => {
  for (const status of ["pending", "running", "failed"] as const) {
    const observations = collectWebsiteAnalysisObservations({ ...baseWebsiteAnalysis, analysis_status: status });
    assert.deepEqual(observations, []);
  }
});

test("collectWebsiteAnalysisObservations returns nothing for a null analysis", () => {
  assert.deepEqual(collectWebsiteAnalysisObservations(null), []);
});

test("collectWebsiteAnalysisObservations marks every observation as AI-inferred, not a verified fact", () => {
  const observations = collectWebsiteAnalysisObservations(baseWebsiteAnalysis);
  assert.ok(observations.length > 0);
  for (const entry of observations) {
    if (entry.field === "websiteAnalyzed") continue; // completion status itself is a verified system fact
    assert.equal(entry.isVerifiedFact, false, `${entry.field} should be AI-inferred`);
    assert.equal(entry.source, DiscoverySourceTypes.AI_WEBSITE_ANALYSIS);
  }
});

test("collectWebsiteAnalysisObservations surfaces target audience from the customer persona", () => {
  const observations = collectWebsiteAnalysisObservations(baseWebsiteAnalysis);
  const targetAudience = observations.find((entry) => entry.field === "targetAudience");
  assert.equal(targetAudience?.value, "Homeowners needing residential HVAC installation");
});

test("collectWebsiteAnalysisObservations merges highestRoiImprovements and contentOpportunities into growthOpportunities", () => {
  const observations = collectWebsiteAnalysisObservations(baseWebsiteAnalysis);
  const opportunities = observations.find((entry) => entry.field === "growthOpportunities");
  assert.deepEqual(opportunities?.value, ["Add more service-area pages", "Spring tune-up guide"]);
});

const baseAiProfile: AiMarketingProfile = {
  id: "ai-profile-1",
  user_id: "user-1",
  business_profile_id: "profile-1",
  website_analysis_id: "analysis-1",
  profile_status: "active",
  business_summary: "Acme HVAC keeps Springfield homes comfortable year-round.",
  target_audience: "Homeowners",
  ideal_customer: "Homeowners with older HVAC systems",
  services: ["AC repair", "Furnace installation"],
  service_areas: ["Springfield"],
  industry: "HVAC",
  brand_voice: "Warm",
  tone: "Warm and professional",
  value_proposition: "Fast, honest service",
  keywords: ["hvac"],
  competitors: ["Bob's HVAC"],
  faqs: [],
  seasonal_opportunities: ["Spring tune-up promotion"],
  recommended_ctas: [],
  common_objections: [],
  brand_personality: ["Friendly", "Reliable"],
  writing_examples: [],
  marketing_strategy: "",
  seo_strategy: "",
  content_strategy: "",
  review_strategy: "",
  google_business_strategy: "",
  monthly_themes: [],
  quarterly_campaigns: [],
  last_error: null,
  last_error_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-04T00:00:00.000Z",
};

test("collectAiMarketingProfileObservations returns nothing when profile is not active", () => {
  for (const status of ["pending", "generating", "failed"] as const) {
    const observations = collectAiMarketingProfileObservations({ ...baseAiProfile, profile_status: status });
    assert.deepEqual(observations, []);
  }
});

test("collectAiMarketingProfileObservations marks every observation as AI-derived", () => {
  const observations = collectAiMarketingProfileObservations(baseAiProfile);
  assert.ok(observations.length > 0);
  for (const entry of observations) {
    assert.equal(entry.isVerifiedFact, false);
    assert.equal(entry.source, DiscoverySourceTypes.AI_MARKETING_PROFILE);
  }
});

test("collectGoogleBusinessProfileObservations reports connection state as a verified fact either way", () => {
  const connectedObservations = collectGoogleBusinessProfileObservations({
    setupRequired: false,
    connected: true,
    connection: null,
    scopesValid: true,
    missingScopes: [],
  });
  assert.equal(connectedObservations[0]?.value, true);
  assert.equal(connectedObservations[0]?.isVerifiedFact, true);

  const disconnectedObservations = collectGoogleBusinessProfileObservations({
    setupRequired: false,
    connected: false,
    connection: null,
    scopesValid: true,
    missingScopes: [],
  });
  assert.equal(disconnectedObservations[0]?.value, false);
});

test("collectGoogleBusinessProfileObservations returns nothing for a null connection status", () => {
  assert.deepEqual(collectGoogleBusinessProfileObservations(null), []);
});

test("collectPublicReviewObservations computes an honest average rating and count", () => {
  const reviews = [
    { rating: 5, review_created_at: "2026-01-01T00:00:00.000Z" },
    { rating: 4, review_created_at: "2026-01-05T00:00:00.000Z" },
    { rating: 3, review_created_at: "2026-01-03T00:00:00.000Z" },
  ] as unknown as Parameters<typeof collectPublicReviewObservations>[0];

  const observations = collectPublicReviewObservations(reviews);
  assert.equal(observations.length, 1);
  const summary = observations[0].value as { reviewCount: number; averageRating: number };
  assert.equal(summary.reviewCount, 3);
  assert.equal(summary.averageRating, 4);
  assert.equal(observations[0].isVerifiedFact, true);
});

test("collectPublicReviewObservations returns nothing for an empty review list", () => {
  assert.deepEqual(collectPublicReviewObservations([]), []);
});

test("collectMarketContextObservations only surfaces competitor-category items", () => {
  const marketContext = {
    brief: { updated_at: "2026-01-06T00:00:00.000Z" },
    items: [
      { category: "competitor", title: "Bob's HVAC" },
      { category: "weather", title: "Cold snap expected" },
    ],
  } as unknown as Parameters<typeof collectMarketContextObservations>[0];

  const observations = collectMarketContextObservations(marketContext);
  assert.equal(observations.length, 1);
  assert.deepEqual(observations[0].value, ["Bob's HVAC"]);
  assert.equal(observations[0].isVerifiedFact, false);
});

test("collectBusinessDiscoveryObservations composes every source without throwing when everything is empty", () => {
  const observations = collectBusinessDiscoveryObservations({
    businessProfile: null,
    websiteAnalysis: null,
    aiMarketingProfile: null,
    googleBusinessConnection: null,
    publicReviews: [],
    marketContext: null,
  });
  assert.deepEqual(observations, []);
});

test("collectBusinessDiscoveryObservations composes every source together", () => {
  const observations = collectBusinessDiscoveryObservations({
    businessProfile: baseProfile,
    websiteAnalysis: baseWebsiteAnalysis,
    aiMarketingProfile: baseAiProfile,
    googleBusinessConnection: { setupRequired: false, connected: true, connection: null, scopesValid: true, missingScopes: [] },
    publicReviews: [{ rating: 5, review_created_at: "2026-01-01T00:00:00.000Z" }] as unknown as Parameters<
      typeof collectPublicReviewObservations
    >[0],
    marketContext: null,
  });

  const sourcesUsed = new Set(observations.map((entry) => entry.source));
  assert.ok(sourcesUsed.has(DiscoverySourceTypes.BUSINESS_PROFILE));
  assert.ok(sourcesUsed.has(DiscoverySourceTypes.AI_WEBSITE_ANALYSIS));
  assert.ok(sourcesUsed.has(DiscoverySourceTypes.AI_MARKETING_PROFILE));
  assert.ok(sourcesUsed.has(DiscoverySourceTypes.GOOGLE_BUSINESS_PROFILE));
  assert.ok(sourcesUsed.has(DiscoverySourceTypes.PUBLIC_REVIEWS));
});

import test from "node:test";
import assert from "node:assert/strict";

import {
  fromDiscoveryConfidenceTier,
  fromConfidenceLevel,
  overallConfidenceFrom,
} from "../lib/business-brain-inspector/confidence.ts";
import { businessDiscoveryKnowledgeCards } from "../lib/business-brain-inspector/adapters/businessDiscovery.ts";
import { customerVoiceKnowledgeCards } from "../lib/business-brain-inspector/adapters/customerVoice.ts";
import { externalIntelligenceKnowledgeCards } from "../lib/business-brain-inspector/adapters/externalIntelligence.ts";
import { opportunityEngineKnowledgeCards } from "../lib/business-brain-inspector/adapters/opportunityEngine.ts";
import { goalsKnowledgeCards } from "../lib/business-brain-inspector/adapters/goals.ts";
import { businessLearningEngineKnowledgeCards } from "../lib/business-brain-inspector/adapters/businessLearningEngine.ts";
import { buildMissingKnowledge } from "../lib/business-brain-inspector/missingKnowledge.ts";
import { buildBusinessBrainSnapshot } from "../lib/business-brain-inspector/build.ts";
import { BrainSections } from "../lib/business-brain-inspector/types.ts";
import { buildWhatINoticedObservations } from "../lib/growth-advisor/observations.ts";
import { buildBusinessTimeline } from "../lib/business-timeline/build.ts";
import { BusinessTimelineEntryTypes } from "../lib/business-timeline/types.ts";

import type { BusinessDiscoveryResult } from "../lib/business-discovery/types.ts";
import type { CustomerVoiceIntelligence, CustomerVoiceTheme } from "../lib/customer-voice/types.ts";
import type { ExternalIntelligence } from "../lib/external-intelligence/types.ts";
import type { DetectedOpportunity } from "../lib/opportunity-engine/types.ts";
import type { BusinessGoal } from "../lib/goals/types.ts";
import type { BusinessPattern } from "../lib/business-learning-engine/types.ts";
import type { BusinessKnowledgeHealth } from "../lib/business-knowledge-graph/knowledgeHealth.ts";
import type { HeadOfMarketingBriefing } from "../lib/head-of-marketing/types.ts";
import type { BusinessReasoningResult } from "../lib/business-knowledge-graph/reasoning.ts";
import type { LearningMaturity } from "../lib/business-learning-engine/learningMaturity.ts";
import type { WebsiteAnalysis } from "../lib/website-analysis/types.ts";

const NOW = new Date("2026-07-30T00:00:00.000Z");

// ---------------------------------------------------------------------------
// confidence.ts — the shared High/Medium/Low vocabulary (Part 2)
// ---------------------------------------------------------------------------

test("fromDiscoveryConfidenceTier maps known/assumed to high/medium and missing to null (never a card)", () => {
  assert.equal(fromDiscoveryConfidenceTier("known"), "high");
  assert.equal(fromDiscoveryConfidenceTier("assumed"), "medium");
  assert.equal(fromDiscoveryConfidenceTier("missing"), null);
});

test("fromConfidenceLevel passes the existing low/medium/high vocabulary through unchanged", () => {
  assert.equal(fromConfidenceLevel("low"), "low");
  assert.equal(fromConfidenceLevel("medium"), "medium");
  assert.equal(fromConfidenceLevel("high"), "high");
});

test("overallConfidenceFrom never fabricates a score — it floors the average tier", () => {
  assert.equal(overallConfidenceFrom([]), "low");
  assert.equal(overallConfidenceFrom(["high", "high"]), "high");
  assert.equal(overallConfidenceFrom(["high", "low"]), "medium");
  // Two highs and one low averages to (3+3+1)/3 = 2.33 -> floors to medium,
  // never masked up to high by the stronger cards.
  assert.equal(overallConfidenceFrom(["high", "high", "low"]), "medium");
});

// ---------------------------------------------------------------------------
// adapters/businessDiscovery.ts — Business Identity, Products & Services,
// Ideal Customers, Differentiators, Brand Voice, Geographic Service Area
// ---------------------------------------------------------------------------

function baseDiscovery(overrides: Partial<BusinessDiscoveryResult> = {}): BusinessDiscoveryResult {
  return {
    generatedAt: NOW.toISOString(),
    businessSummary: { value: null, confidenceTier: "missing", confidenceScore: 0, sources: [], reason: "", evidenceRefs: [] },
    primaryServices: { value: null, confidenceTier: "missing", confidenceScore: 0, sources: [], reason: "", evidenceRefs: [] },
    targetCustomers: { value: null, confidenceTier: "missing", confidenceScore: 0, sources: [], reason: "", evidenceRefs: [] },
    uniqueStrengths: { value: null, confidenceTier: "missing", confidenceScore: 0, sources: [], reason: "", evidenceRefs: [] },
    brandPersonality: { value: null, confidenceTier: "missing", confidenceScore: 0, sources: [], reason: "", evidenceRefs: [] },
    missingInformation: [],
    ...overrides,
  } as unknown as BusinessDiscoveryResult;
}

test("businessDiscoveryKnowledgeCards produces a card for a known insight, with evidence and a correction route", () => {
  const discovery = baseDiscovery({
    businessSummary: {
      value: "A commercial roofing company serving the metro area.",
      confidenceTier: "known",
      confidenceScore: 90,
      sources: ["business_profile"],
      reason: "You told us this directly in Business Setup.",
      evidenceRefs: [{ source: "business_profile", detail: "Business Setup summary field." }],
    },
  });

  const cards = businessDiscoveryKnowledgeCards({ businessDiscovery: discovery });
  const identity = cards.find((c) => c.id === "business_discovery_identity");

  assert.ok(identity);
  assert.equal(identity!.section, BrainSections.BUSINESS_IDENTITY);
  assert.equal(identity!.confidence, "high");
  assert.equal(identity!.evidenceCount, 1);
  assert.equal(identity!.evidence[0]!.sourceProviderId, "business_profile");
  assert.ok(identity!.correction);
  assert.equal(identity!.correction!.href, "/dashboard/setup/business");
});

test("businessDiscoveryKnowledgeCards omits a card entirely for a missing insight — never fabricates a placeholder", () => {
  const cards = businessDiscoveryKnowledgeCards({ businessDiscovery: baseDiscovery() });
  assert.equal(cards.find((c) => c.id === "business_discovery_identity"), undefined);
});

test("businessDiscoveryKnowledgeCards returns nothing when no discovery result exists", () => {
  assert.deepEqual(businessDiscoveryKnowledgeCards({ businessDiscovery: null }), []);
  assert.deepEqual(businessDiscoveryKnowledgeCards({}), []);
});

test("businessDiscoveryKnowledgeCards' geographic card prefers the owner-confirmed profile over website inference", () => {
  const withProfile = businessDiscoveryKnowledgeCards({
    businessDiscovery: baseDiscovery(),
    businessProfile: { city: "Austin", state: "TX" },
    websiteAnalysis: { cities: ["Round Rock"] } as unknown as WebsiteAnalysis,
  });
  const geo = withProfile.find((c) => c.id === "business_discovery_geographic_service_area");
  assert.ok(geo);
  assert.equal(geo!.confidence, "high");
  assert.match(geo!.statement, /Austin, TX/);

  const websiteOnly = businessDiscoveryKnowledgeCards({
    businessDiscovery: baseDiscovery(),
    businessProfile: { city: null, state: null },
    websiteAnalysis: { cities: ["Round Rock"] } as unknown as WebsiteAnalysis,
  });
  const geoInferred = websiteOnly.find((c) => c.id === "business_discovery_geographic_service_area");
  assert.ok(geoInferred);
  assert.equal(geoInferred!.confidence, "medium");
});

// ---------------------------------------------------------------------------
// adapters/customerVoice.ts — Customer Themes
// ---------------------------------------------------------------------------

function theme(overrides: Partial<CustomerVoiceTheme>): CustomerVoiceTheme {
  return {
    key: "commercial_roofing",
    label: "commercial roofing",
    kind: "strength",
    sentiment: "positive",
    confidence: "high",
    businessImpact: "medium",
    evidenceCount: 5,
    percentageOfReviews: 40,
    trendDirection: "improving",
    languageVariants: [],
    evidenceIds: [],
    lastUpdated: NOW.toISOString(),
    ...overrides,
  } as CustomerVoiceTheme;
}

test("customerVoiceKnowledgeCards requires at least 2 pieces of evidence before making a claim", () => {
  const intelligence: CustomerVoiceIntelligence = {
    emptyState: null,
    strengths: [theme({ evidenceCount: 1 })],
    frequentlyMentionedServices: [],
    concerns: [],
    contributingProviders: ["google_reviews"],
  } as unknown as CustomerVoiceIntelligence;

  assert.deepEqual(customerVoiceKnowledgeCards(intelligence), []);
});

test("customerVoiceKnowledgeCards attributes evidence to every contributing provider", () => {
  const intelligence: CustomerVoiceIntelligence = {
    emptyState: null,
    strengths: [theme({ evidenceCount: 6 })],
    frequentlyMentionedServices: [],
    concerns: [],
    contributingProviders: ["google_reviews", "website_testimonials"],
  } as unknown as CustomerVoiceIntelligence;

  const cards = customerVoiceKnowledgeCards(intelligence);
  assert.equal(cards.length, 1);
  assert.equal(cards[0]!.section, BrainSections.CUSTOMER_THEMES);
  assert.equal(cards[0]!.evidence.length, 2);
  assert.ok(cards[0]!.evidence.some((e) => e.sourceLabel === "Website Testimonials"));
  assert.ok(cards[0]!.evidence.some((e) => e.sourceLabel === "Google Reviews"));
});

test("customerVoiceKnowledgeCards returns nothing for an empty-evidence Customer Voice package", () => {
  const intelligence = { emptyState: "no_evidence" } as unknown as CustomerVoiceIntelligence;
  assert.deepEqual(customerVoiceKnowledgeCards(intelligence), []);
  assert.deepEqual(customerVoiceKnowledgeCards(null), []);
});

// ---------------------------------------------------------------------------
// adapters/externalIntelligence.ts — Search Trends, Seasonality
// ---------------------------------------------------------------------------

test("externalIntelligenceKnowledgeCards splits search trends and seasonality into their own sections", () => {
  const intelligence: ExternalIntelligence = {
    emptyState: null,
    searchDemandTrends: [
      {
        id: "x1",
        insight: "Organic clicks for commercial roofing grew.",
        confidence: "high",
        corroboratingProviderCount: 2,
        evidence: [{ sourceProviderId: "search_console", sourceLabel: "Search Console", summary: "x" }],
      },
    ],
    seasonalOpportunities: [
      {
        id: "s1",
        insight: "Roof inspections spike every autumn.",
        confidence: "medium",
        corroboratingProviderCount: 1,
        evidence: [{ sourceProviderId: "market_context", sourceLabel: "External Intelligence", summary: "y" }],
      },
    ],
    localEvents: [],
  } as unknown as ExternalIntelligence;

  const cards = externalIntelligenceKnowledgeCards(intelligence);
  assert.equal(cards.filter((c) => c.section === BrainSections.SEARCH_TRENDS).length, 1);
  assert.equal(cards.filter((c) => c.section === BrainSections.SEASONALITY).length, 1);
  const search = cards.find((c) => c.section === BrainSections.SEARCH_TRENDS)!;
  assert.match(search.confidenceReason, /Corroborated by 2/);
});

test("externalIntelligenceKnowledgeCards returns nothing for an empty-evidence package", () => {
  const intelligence = { emptyState: "no_evidence" } as unknown as ExternalIntelligence;
  assert.deepEqual(externalIntelligenceKnowledgeCards(intelligence), []);
});

// ---------------------------------------------------------------------------
// adapters/opportunityEngine.ts — Marketing Opportunities
// ---------------------------------------------------------------------------

function opportunity(overrides: Partial<DetectedOpportunity> = {}): DetectedOpportunity {
  return {
    id: "opp1",
    type: "seasonal",
    statement: "Fall roof inspections are trending up.",
    whyNow: "Search demand rose 3x this month.",
    evidence: [{ id: "e1", sourceProviderId: "search_console", sourceLabel: "Search Console", summary: "trend", occurredAt: NOW.toISOString() }],
    confidence: "high",
    status: "active",
    ...overrides,
  } as unknown as DetectedOpportunity;
}

test("opportunityEngineKnowledgeCards reuses the engine's own score/evidence without re-detecting anything", () => {
  const cards = opportunityEngineKnowledgeCards([opportunity()]);
  assert.equal(cards.length, 1);
  assert.equal(cards[0]!.section, BrainSections.MARKETING_OPPORTUNITIES);
  assert.equal(cards[0]!.confidence, "high");
  assert.equal(cards[0]!.confidenceReason, "Search demand rose 3x this month.");
  assert.equal(cards[0]!.evidence[0]!.sourceProviderId, "search_console");
});

test("opportunityEngineKnowledgeCards caps at 6 cards and handles an empty list", () => {
  const many = Array.from({ length: 10 }, (_, i) => opportunity({ id: `opp${i}` }));
  assert.equal(opportunityEngineKnowledgeCards(many).length, 6);
  assert.deepEqual(opportunityEngineKnowledgeCards([]), []);
  assert.deepEqual(opportunityEngineKnowledgeCards(null), []);
});

// ---------------------------------------------------------------------------
// adapters/goals.ts — Business Goals
// ---------------------------------------------------------------------------

test("goalsKnowledgeCards only includes active goals, sorted by priority, always high confidence", () => {
  const goals: BusinessGoal[] = [
    { key: "grow_memberships", label: "Grow memberships", priority: 2, status: "active", targetTimeframe: "6_months", createdAt: NOW.toISOString(), updatedAt: NOW.toISOString() } as BusinessGoal,
    { key: "expand_new_market", label: "Expand to a new market", priority: 1, status: "active", targetTimeframe: null, createdAt: NOW.toISOString(), updatedAt: NOW.toISOString() } as BusinessGoal,
    { key: "reduce_seasonality", label: "Reduce seasonality", priority: 1, status: "achieved", targetTimeframe: null, createdAt: NOW.toISOString(), updatedAt: NOW.toISOString() } as BusinessGoal,
  ];

  const cards = goalsKnowledgeCards(goals);
  assert.equal(cards.length, 2);
  assert.equal(cards[0]!.title, "Expand to a new market");
  assert.equal(cards.every((c) => c.confidence === "high"), true);
});

// ---------------------------------------------------------------------------
// adapters/businessLearningEngine.ts — Learning History
// ---------------------------------------------------------------------------

function pattern(overrides: Partial<BusinessPattern> = {}): BusinessPattern {
  return {
    id: "p1",
    statement: "Approving service-spotlight recommendations tends to perform well.",
    effectiveConfidence: "medium",
    reinforcementCount: 3,
    firstObserved: NOW.toISOString(),
    decayState: "fresh",
    evidence: [{ id: "e1", sourceProviderId: "recommendation_outcomes", sourceLabel: "Recommendation Outcomes", summary: "3 approvals", occurredAt: NOW.toISOString() }],
    ...overrides,
  } as unknown as BusinessPattern;
}

test("businessLearningEngineKnowledgeCards notes decay state in the confidence reason when not fresh", () => {
  const cards = businessLearningEngineKnowledgeCards([pattern({ decayState: "decaying" })]);
  assert.match(cards[0]!.confidenceReason, /confidence has decayed/);
});

test("businessLearningEngineKnowledgeCards caps at 6 and handles no patterns", () => {
  const many = Array.from({ length: 9 }, (_, i) => pattern({ id: `p${i}` }));
  assert.equal(businessLearningEngineKnowledgeCards(many).length, 6);
  assert.deepEqual(businessLearningEngineKnowledgeCards([]), []);
  assert.deepEqual(businessLearningEngineKnowledgeCards(null), []);
});

// ---------------------------------------------------------------------------
// missingKnowledge.ts — Part 4
// ---------------------------------------------------------------------------

test("buildMissingKnowledge merges Business Discovery gaps and Business Knowledge Health gaps, deduplicated by label", () => {
  const businessDiscovery = baseDiscovery({
    missingInformation: [
      { field: "primaryServices", reason: "We couldn't find your services.", suggestedNextAction: "Add them in Business Setup." },
    ],
  });
  const businessKnowledgeHealth = {
    missingKnowledge: [
      { label: "Customer sentiment", detail: "No reviews or testimonials connected yet." },
      { label: "primaryServices", detail: "duplicate label, different case" },
    ],
  } as unknown as BusinessKnowledgeHealth;

  const items = buildMissingKnowledge({ businessDiscovery, businessKnowledgeHealth });
  assert.equal(items.length, 2);
  assert.ok(items.every((item) => item.detail.length > 0));
  const sentiment = items.find((item) => item.label === "Customer sentiment");
  assert.ok(sentiment);
  assert.equal(sentiment!.correction!.href, "/dashboard/customer-voice");
});

test("buildMissingKnowledge returns an empty list when nothing is missing", () => {
  assert.deepEqual(buildMissingKnowledge({}), []);
});

// ---------------------------------------------------------------------------
// build.ts — buildBusinessBrainSnapshot end-to-end
// ---------------------------------------------------------------------------

test("buildBusinessBrainSnapshot groups cards by section in BRAIN_SECTION_ORDER and computes an honest overall confidence", () => {
  const discovery = baseDiscovery({
    businessSummary: {
      value: "A commercial roofing company.",
      confidenceTier: "known",
      confidenceScore: 90,
      sources: ["business_profile"],
      reason: "You told us this directly.",
      evidenceRefs: [{ source: "business_profile", detail: "Setup." }],
    },
  });

  const snapshot = buildBusinessBrainSnapshot({
    businessDiscovery: discovery,
    goals: [{ key: "grow_memberships", label: "Grow memberships", priority: 1, status: "active", targetTimeframe: null, createdAt: NOW.toISOString(), updatedAt: NOW.toISOString() } as BusinessGoal],
    now: NOW,
  });

  assert.ok(snapshot.sections[BrainSections.BUSINESS_IDENTITY]);
  assert.ok(snapshot.sections[BrainSections.BUSINESS_GOALS]);
  assert.equal(snapshot.sections[BrainSections.SEARCH_TRENDS], undefined);
  assert.equal(snapshot.overallConfidence, "high");
  assert.match(snapshot.overallConfidenceExplanation, /2 pieces of evidence-linked knowledge/);
  assert.equal(snapshot.generatedAt, NOW.toISOString());
});

test("buildBusinessBrainSnapshot is honest about having nothing yet", () => {
  const snapshot = buildBusinessBrainSnapshot({ now: NOW });
  assert.deepEqual(snapshot.sections, {});
  assert.deepEqual(snapshot.missingKnowledge, []);
  assert.match(snapshot.overallConfidenceExplanation, /don't have enough evidence yet/);
});

test("buildBusinessBrainSnapshot surfaces missing-knowledge gaps alongside whatever cards do exist", () => {
  const businessKnowledgeHealth = {
    missingKnowledge: [{ label: "Search & market performance", detail: "No Search Console connection yet." }],
  } as unknown as BusinessKnowledgeHealth;

  const snapshot = buildBusinessBrainSnapshot({ businessKnowledgeHealth, now: NOW });
  assert.equal(snapshot.missingKnowledge.length, 1);
  assert.equal(snapshot.missingKnowledge[0]!.section, BrainSections.SEARCH_TRENDS);
});

// ---------------------------------------------------------------------------
// Growth Advisor confidence-gap messaging (Part 6)
// ---------------------------------------------------------------------------

function emptyBriefing(): HeadOfMarketingBriefing {
  return {
    greeting: "Good morning",
    businessName: "Acme Roofing",
    thisWeek: [],
    relationshipMemory: null,
    noticed: [],
    health: { state: "healthy", label: "Healthy", message: "All good." },
    confidence: {
      gbpConnected: true,
      pendingApprovals: 0,
      publishFailures: 0,
      openRecommendations: 0,
      publishingReadyOrScheduled: 0,
      hasMarketingPlan: true,
      weeklyPublishedPosts: 1,
      profileCreatedAt: NOW.toISOString(),
    },
  } as unknown as HeadOfMarketingBriefing;
}

test("the confidence-gap observation names the single specific action Growth Advisor would trust more", () => {
  const businessKnowledgeHealth = {
    missingKnowledge: [{ label: "Search & market performance", detail: "No Search Console connection yet." }],
  } as unknown as BusinessKnowledgeHealth;

  const observations = buildWhatINoticedObservations({
    briefing: emptyBriefing(),
    businessKnowledgeHealth,
  });

  const gapObservation = observations.find((o) => o.evidenceSource === "business_knowledge_health:Search & market performance");
  assert.ok(gapObservation);
  assert.match(gapObservation!.headline, /connected Google Search Console/);
  assert.equal(gapObservation!.whyItMatters, "No Search Console connection yet.");
});

test("the confidence-gap observation is silent when there's no actionable gap (never fabricates one)", () => {
  const businessKnowledgeHealth = {
    missingKnowledge: [{ label: "Conflicting signals", detail: "Some sources disagree." }],
  } as unknown as BusinessKnowledgeHealth;

  const observations = buildWhatINoticedObservations({
    briefing: emptyBriefing(),
    businessKnowledgeHealth,
  });

  assert.equal(observations.some((o) => o.evidenceSource?.startsWith("business_knowledge_health:")), false);
});

// ---------------------------------------------------------------------------
// Business Timeline milestones (Part 8)
// ---------------------------------------------------------------------------

function emptyTimelineInput() {
  return {
    recommendationOutcomeEvents: [],
    campaigns: [],
    smartUploadDocuments: [],
    learningPatterns: [] as BusinessPattern[],
  };
}

test("buildBusinessTimeline adds a business-understanding-improved entry only for corroborated (2+ provider) conclusions", () => {
  const reasoning = {
    conclusions: [
      { id: "c1", statement: "Commercial roofing is a growth opportunity.", reasoning: "because X and Y agree.", contributingProviderCount: 2, lastUpdated: NOW.toISOString() },
      { id: "c2", statement: "Single-source conclusion.", reasoning: "because Z.", contributingProviderCount: 1, lastUpdated: NOW.toISOString() },
    ],
  } as unknown as BusinessReasoningResult;

  const entries = buildBusinessTimeline({ ...emptyTimelineInput(), businessReasoning: reasoning });
  const improved = entries.filter((e) => e.type === BusinessTimelineEntryTypes.BUSINESS_UNDERSTANDING_IMPROVED);
  assert.equal(improved.length, 1);
  assert.match(improved[0]!.whatChanged, /Commercial roofing is a growth opportunity/);
});

test("buildBusinessTimeline adds a customer-voice-strengthened entry only for themes with 3+ pieces of evidence, using frequentlyMentionedServices not strengths", () => {
  const customerVoice: CustomerVoiceIntelligence = {
    emptyState: null,
    frequentlyMentionedServices: [theme({ key: "roof_inspection", label: "roof inspection", evidenceCount: 3 })],
    strengths: [theme({ key: "should_not_appear", label: "should not appear", evidenceCount: 10 })],
  } as unknown as CustomerVoiceIntelligence;

  const entries = buildBusinessTimeline({ ...emptyTimelineInput(), customerVoice });
  const strengthened = entries.filter((e) => e.type === BusinessTimelineEntryTypes.CUSTOMER_VOICE_STRENGTHENED);
  assert.equal(strengthened.length, 1);
  assert.match(strengthened[0]!.whatChanged, /roof inspection/);
});

test("buildBusinessTimeline adds exactly one search-confidence-increased entry when overall confidence is high", () => {
  const highConfidence = {
    confidence: "high",
    lastUpdated: NOW.toISOString(),
    evidenceCount: 4,
    contributingProviders: ["search_console", "market_context"],
    searchDemandTrends: [],
    seasonalOpportunities: [],
    localEvents: [],
    emptyState: null,
  } as unknown as ExternalIntelligence;

  const entries = buildBusinessTimeline({ ...emptyTimelineInput(), externalIntelligence: highConfidence });
  const searchEntries = entries.filter((e) => e.type === BusinessTimelineEntryTypes.SEARCH_CONFIDENCE_INCREASED);
  assert.equal(searchEntries.length, 1);
  assert.equal(searchEntries[0]!.whatChanged, "Search confidence increased to High.");

  const mediumConfidence = { ...highConfidence, confidence: "medium" } as unknown as ExternalIntelligence;
  const noEntries = buildBusinessTimeline({ ...emptyTimelineInput(), externalIntelligence: mediumConfidence });
  assert.equal(noEntries.filter((e) => e.type === BusinessTimelineEntryTypes.SEARCH_CONFIDENCE_INCREASED).length, 0);
});

test("buildBusinessTimeline adds a learning-confidence-improved entry only once learning maturity crosses 70", () => {
  const maturity: LearningMaturity = { generatedAt: NOW.toISOString(), overallScore: 72, dimensions: {} } as unknown as LearningMaturity;
  const entries = buildBusinessTimeline({ ...emptyTimelineInput(), learningMaturity: maturity });
  assert.equal(entries.filter((e) => e.type === BusinessTimelineEntryTypes.LEARNING_CONFIDENCE_IMPROVED).length, 1);

  const belowBar: LearningMaturity = { generatedAt: NOW.toISOString(), overallScore: 69, dimensions: {} } as unknown as LearningMaturity;
  const noEntries = buildBusinessTimeline({ ...emptyTimelineInput(), learningMaturity: belowBar });
  assert.equal(noEntries.filter((e) => e.type === BusinessTimelineEntryTypes.LEARNING_CONFIDENCE_IMPROVED).length, 0);
});

test("buildBusinessTimeline never fabricates any Business Brain milestone when nothing was passed in", () => {
  const entries = buildBusinessTimeline(emptyTimelineInput());
  const brainMilestoneTypes: string[] = [
    BusinessTimelineEntryTypes.BUSINESS_UNDERSTANDING_IMPROVED,
    BusinessTimelineEntryTypes.CUSTOMER_VOICE_STRENGTHENED,
    BusinessTimelineEntryTypes.SEARCH_CONFIDENCE_INCREASED,
    BusinessTimelineEntryTypes.LEARNING_CONFIDENCE_IMPROVED,
  ];
  assert.equal(entries.filter((e) => brainMilestoneTypes.includes(e.type)).length, 0);
});

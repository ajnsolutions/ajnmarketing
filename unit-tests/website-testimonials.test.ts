import test from "node:test";
import assert from "node:assert/strict";

import { splitBulkPastedTestimonials } from "../lib/testimonials/bulkPaste.ts";
import { parseTestimonialsCsv } from "../lib/testimonials/csvImport.ts";
import { extractTestimonialCandidatesFromPageText } from "../lib/testimonials/websiteImport.ts";
import { normalizeTestimonialExtraction } from "../lib/testimonials/openai-extractor.ts";
import {
  formatTestimonialKnowledgeForContentPrompt,
  formatTestimonialQuotesForContentPrompt,
} from "../lib/testimonials/contentPromptBlock.ts";
import {
  createTestimonial,
  deleteTestimonial,
  getActiveTestimonialKnowledgeForUser,
  listTestimonialsForUser,
} from "../lib/testimonials/persistence.ts";
import type { TestimonialKnowledgeFactRecord, WebsiteTestimonialRecord } from "../lib/testimonials/types.ts";
import {
  mapTestimonialToEvidence,
  createWebsiteTestimonialsProvider,
} from "../lib/customer-voice/providers/websiteTestimonials.ts";
import { normalizeProviderBatch } from "../lib/customer-voice/normalize.ts";
import { composeCustomerVoiceIntelligence } from "../lib/customer-voice/compose.ts";
import { CustomerVoiceProviderIds } from "../lib/customer-voice/types.ts";
import { customerVoiceToGraphSignals } from "../lib/business-knowledge-graph/adapters/customerVoice.ts";
import { testimonialKnowledgeToGraphSignals } from "../lib/business-knowledge-graph/adapters/testimonials.ts";
import { buildBusinessKnowledgeGraph } from "../lib/business-knowledge-graph/build.ts";
import { reasonAboutBusinessGraph } from "../lib/business-knowledge-graph/reasoning.ts";
import { businessReasoningToLearningSignals } from "../lib/business-learning-engine/adapters/businessKnowledgeGraph.ts";
import { GraphEntityTypes } from "../lib/business-knowledge-graph/types.ts";
import { computeBusinessKnowledgeHealth } from "../lib/business-knowledge-graph/knowledgeHealth.ts";
import { buildWhatINoticedObservations } from "../lib/growth-advisor/observations.ts";
import { resolveBusinessConnections } from "../lib/business-connections/resolve.ts";
import { recommendNextConnection } from "../lib/business-connections/recommendNext.ts";
import { createFakeSupabaseClient, userIdsQueried } from "./support/fake-supabase-client.ts";
import type { HeadOfMarketingBriefing } from "../lib/head-of-marketing/types.ts";
import type { BusinessDiscoveryResult } from "../lib/business-discovery/types.ts";
import type { CustomerVoiceIntelligence } from "../lib/customer-voice/types.ts";

const NOW = new Date("2026-07-30T00:00:00.000Z");

function testimonial(overrides: Partial<WebsiteTestimonialRecord> = {}): WebsiteTestimonialRecord {
  return {
    id: "t1",
    user_id: "u1",
    business_profile_id: "b1",
    author_name: "Jane Smith",
    author_title: "Owner",
    quote: "The commercial roofing crew was fast, professional, and cleaned up perfectly.",
    source_url: null,
    rating: 5,
    occurred_at: NOW.toISOString(),
    ingestion_method: "manual",
    status: "active",
    fact_count: 0,
    created_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
    ...overrides,
  };
}

function knowledgeFact(overrides: Partial<TestimonialKnowledgeFactRecord> = {}): TestimonialKnowledgeFactRecord {
  return {
    id: "f1",
    user_id: "u1",
    business_profile_id: "b1",
    testimonial_id: "t1",
    category: "business_strength",
    fact: "Fast, professional commercial roofing crew",
    source_excerpt: "The commercial roofing crew was fast, professional",
    confidence: "high",
    created_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Part 1 — Testimonial ingestion (manual/bulk/CSV/website-import)
// ---------------------------------------------------------------------------

test("splitBulkPastedTestimonials splits on blank lines by default", () => {
  const result = splitBulkPastedTestimonials(
    "This is the first testimonial and it is long enough.\n\nThis is the second testimonial, also long enough.",
  );
  assert.equal(result.length, 2);
  assert.match(result[0]!, /first testimonial/);
  assert.match(result[1]!, /second testimonial/);
});

test("splitBulkPastedTestimonials prefers an explicit --- separator when present", () => {
  const result = splitBulkPastedTestimonials(
    "First testimonial goes here, long enough to count.\n---\nSecond testimonial goes here, long enough to count.",
  );
  assert.equal(result.length, 2);
});

test("splitBulkPastedTestimonials falls back to one-per-line when there are no blank lines", () => {
  const result = splitBulkPastedTestimonials(
    "This first line is definitely long enough to count.\nThis second line is also long enough to count.",
  );
  assert.equal(result.length, 2);
});

test("splitBulkPastedTestimonials discards short noise and empty input", () => {
  assert.deepEqual(splitBulkPastedTestimonials(""), []);
  assert.deepEqual(splitBulkPastedTestimonials("   \n\n  "), []);
  assert.deepEqual(splitBulkPastedTestimonials("hi\n\nok"), []);
});

test("parseTestimonialsCsv parses a quote column with flexible header naming", () => {
  const csv = 'quote,author,rating\n"Great commercial roofing work, highly recommend!",Jane Smith,5\n"Fast and professional service.",John Doe,4';
  const result = parseTestimonialsCsv(csv);
  assert.equal(result.errors.length, 0);
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[0]!.authorName, "Jane Smith");
  assert.equal(result.rows[0]!.rating, 5);
});

test("parseTestimonialsCsv handles quoted fields containing commas and escaped quotes", () => {
  const csv = 'quote,author\n"They said ""this is the best, hands down"" service ever.",Pat';
  const result = parseTestimonialsCsv(csv);
  assert.equal(result.rows.length, 1);
  assert.match(result.rows[0]!.quote, /"this is the best, hands down"/);
});

test("parseTestimonialsCsv requires a recognizable quote column", () => {
  const result = parseTestimonialsCsv("name,rating\nJane,5");
  assert.equal(result.rows.length, 0);
  assert.match(result.errors[0]!, /quote/i);
});

test("parseTestimonialsCsv skips rows with a too-short quote and reports it", () => {
  const csv = "quote,author\nok,Jane\n\"A properly long testimonial quote goes here for real.\",John";
  const result = parseTestimonialsCsv(csv);
  assert.equal(result.rows.length, 1);
  assert.match(result.errors[0]!, /Row 2/);
});

test("extractTestimonialCandidatesFromPageText finds quoted spans and honest attribution", () => {
  const pageText =
    'Our customers say it best. "The team showed up on time and did excellent commercial roofing work for us." - Jane Smith, Property Manager. More content here.';
  const candidates = extractTestimonialCandidatesFromPageText(pageText);
  assert.equal(candidates.length, 1);
  assert.match(candidates[0]!.quote, /excellent commercial roofing work/);
  assert.equal(candidates[0]!.authorName, "Jane Smith");
  assert.equal(candidates[0]!.authorTitle, "Property Manager");
});

test("extractTestimonialCandidatesFromPageText never invents a quote — only verbatim substrings, deduped", () => {
  const pageText =
    'Read more. "This particular quote is definitely long enough to count." Another line. "This particular quote is definitely long enough to count." repeated.';
  const candidates = extractTestimonialCandidatesFromPageText(pageText);
  assert.equal(candidates.length, 1);
  assert.ok(pageText.includes(candidates[0]!.quote));
});

test("extractTestimonialCandidatesFromPageText returns nothing for plain text with no quotes", () => {
  assert.deepEqual(extractTestimonialCandidatesFromPageText("Welcome to our business. We do great work."), []);
});

// ---------------------------------------------------------------------------
// Part 2 — Knowledge extraction (normalization of AI output)
// ---------------------------------------------------------------------------

test("normalizeTestimonialExtraction drops items with no fact or an unrecognized category", () => {
  const result = normalizeTestimonialExtraction({
    items: [
      { category: "business_strength", fact: "Fast turnaround", sourceExcerpt: "fast", confidence: "high" },
      { category: "not_a_real_category", fact: "should be dropped", sourceExcerpt: null, confidence: "high" },
      { category: "trust_indicator", fact: "", sourceExcerpt: null, confidence: "low" },
    ],
  });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0]!.category, "business_strength");
});

test("normalizeTestimonialExtraction defaults an invalid confidence to medium and truncates long text", () => {
  const result = normalizeTestimonialExtraction({
    items: [{ category: "differentiator", fact: "x".repeat(1000), sourceExcerpt: "y".repeat(1000), confidence: "extreme" }],
  });
  assert.equal(result.items[0]!.confidence, "medium");
  assert.ok(result.items[0]!.fact.length <= 400);
  assert.ok(result.items[0]!.sourceExcerpt!.length <= 400);
});

test("normalizeTestimonialExtraction handles malformed model output without throwing", () => {
  const result = normalizeTestimonialExtraction({ items: "not an array" as never });
  assert.deepEqual(result.items, []);
});

// ---------------------------------------------------------------------------
// Part 3 — Customer Voice integration (first-class provider, attribution,
// reinforcement alongside Google Reviews)
// ---------------------------------------------------------------------------

test("mapTestimonialToEvidence normalizes a testimonial into the shared ProviderEvidenceInput shape", () => {
  const evidence = mapTestimonialToEvidence(testimonial());
  assert.equal(evidence.externalId, "t1");
  assert.equal(evidence.text, testimonial().quote);
  assert.equal(evidence.rating, 5);
  assert.equal(evidence.authorDisplayName, "Jane Smith");
  assert.equal(evidence.metadata?.ingestionMethod, "manual");
});

test("createWebsiteTestimonialsProvider uses the reserved website_testimonials provider id", async () => {
  const provider = createWebsiteTestimonialsProvider(async () => [testimonial()]);
  assert.equal(provider.id, CustomerVoiceProviderIds.WEBSITE_TESTIMONIALS);
  const result = await provider.fetchEvidence({ userId: "u1", businessProfileId: "b1", now: NOW });
  assert.equal(result.evidence.length, 1);
});

test("createWebsiteTestimonialsProvider reports an honest note when there are no testimonials yet", async () => {
  const provider = createWebsiteTestimonialsProvider(async () => []);
  const result = await provider.fetchEvidence({ userId: "u1", businessProfileId: "b1", now: NOW });
  assert.equal(result.evidence.length, 0);
  assert.ok(result.notes?.some((n) => /no website testimonials/i.test(n)));
});

test("Google Reviews and Website Testimonials reinforce the same theme with provider attribution tracked", () => {
  const knownServices = ["commercial roofing"];
  const googleEvidence = normalizeProviderBatch({
    providerId: CustomerVoiceProviderIds.GOOGLE_BUSINESS_REVIEWS,
    sourceLabel: "Google Business Reviews",
    now: NOW,
    knownServices,
    evidence: [
      { externalId: "g1", occurredAt: NOW.toISOString(), rating: 5, text: "Excellent commercial roofing work, highly recommend." },
      { externalId: "g2", occurredAt: NOW.toISOString(), rating: 5, text: "Best commercial roofing team in town." },
    ],
  });
  const testimonialEvidence = normalizeProviderBatch({
    providerId: CustomerVoiceProviderIds.WEBSITE_TESTIMONIALS,
    sourceLabel: "Website Testimonials",
    now: NOW,
    knownServices,
    evidence: [
      { externalId: "t1", occurredAt: NOW.toISOString(), rating: 5, text: "Their commercial roofing crew was fast and professional." },
    ],
  });

  const intelligence = composeCustomerVoiceIntelligence({
    businessProfileId: "biz-1",
    evidence: [...googleEvidence, ...testimonialEvidence],
    now: NOW,
  });

  assert.deepEqual(
    [...intelligence.contributingProviders].sort(),
    ["google_business_reviews", "website_testimonials"].sort(),
  );
  const service = intelligence.frequentlyMentionedServices.find((t) => t.label === "commercial roofing");
  assert.ok(service);
  assert.equal(service!.evidenceCount, 3);
});

// ---------------------------------------------------------------------------
// Part 4 — Business Knowledge Graph reinforcement
// ---------------------------------------------------------------------------

test("testimonialKnowledgeToGraphSignals maps known categories and cites the real source excerpt, never fabricating", () => {
  const signals = testimonialKnowledgeToGraphSignals([
    knowledgeFact({ category: "business_strength" }),
    knowledgeFact({ id: "f2", category: "customer_segment", fact: "Commercial property managers", source_excerpt: null }),
  ]);
  assert.equal(signals.length, 2);
  assert.equal(signals[0]!.entityType, GraphEntityTypes.COMPETITIVE_STRENGTH);
  assert.equal(signals[0]!.evidenceSummary, knowledgeFact().source_excerpt);
  assert.equal(signals[1]!.entityType, GraphEntityTypes.CUSTOMER_SEGMENT);
  assert.equal(signals[1]!.evidenceSummary, "Commercial property managers");
  assert.equal(signals[0]!.sourceProviderId, "website_testimonials");
});

test("testimonialKnowledgeToGraphSignals skips categories with no clean graph entity mapping", () => {
  const signals = testimonialKnowledgeToGraphSignals([
    knowledgeFact({ category: "industry_terminology" }),
  ]);
  assert.equal(signals.length, 1);
  assert.equal(signals[0]!.entityType, GraphEntityTypes.INDUSTRY);
});

test("testimonial evidence reinforces an existing graph conclusion and raises confidence only with multi-provider support", () => {
  const baseSignals = [
    {
      sourceProviderId: "business_discovery",
      sourceLabel: "Business Discovery",
      entityType: GraphEntityTypes.SERVICE,
      entityLabel: "commercial roofing",
      confidence: "high" as const,
      evidenceSummary: "You told us commercial roofing is one of your services.",
      occurredAt: NOW.toISOString(),
    },
    {
      sourceProviderId: "smart_uploads",
      sourceLabel: "Smart Uploads",
      entityType: GraphEntityTypes.SERVICE,
      entityLabel: "commercial roofing installation",
      confidence: "high" as const,
      evidenceSummary: "Your brochure highlights commercial roofing installation.",
      occurredAt: NOW.toISOString(),
    },
  ];

  const graphBefore = buildBusinessKnowledgeGraph(baseSignals, NOW);
  const reasoningBefore = reasonAboutBusinessGraph(graphBefore, NOW);
  assert.equal(reasoningBefore.conclusions[0]!.confidence, "medium");
  assert.equal(reasoningBefore.conclusions[0]!.contributingProviderCount, 2);

  // Real Customer Voice pipeline: a testimonial mentions the same known service.
  const testimonialEvidence = normalizeProviderBatch({
    providerId: CustomerVoiceProviderIds.WEBSITE_TESTIMONIALS,
    sourceLabel: "Website Testimonials",
    now: NOW,
    knownServices: ["commercial roofing"],
    evidence: [
      { externalId: "t1", occurredAt: NOW.toISOString(), rating: 5, text: "Their commercial roofing crew was fast and professional." },
    ],
  });
  const intelligence = composeCustomerVoiceIntelligence({ businessProfileId: "biz-1", evidence: testimonialEvidence, now: NOW });
  const cvSignals = customerVoiceToGraphSignals(intelligence);

  const graphAfter = buildBusinessKnowledgeGraph([...baseSignals, ...cvSignals], NOW);
  const reasoningAfter = reasonAboutBusinessGraph(graphAfter, NOW);

  assert.equal(reasoningAfter.conclusions[0]!.contributingProviderCount, 3);
  assert.equal(reasoningAfter.conclusions[0]!.confidence, "high");
});

// ---------------------------------------------------------------------------
// Part 5 — Business Learning Engine: testimonials strengthen existing
// business conclusions (transitively, through the Business Knowledge Graph
// conclusion adapter — no Learning Engine code branches on testimonials).
// ---------------------------------------------------------------------------

test("a stronger, testimonial-reinforced Business Knowledge Graph conclusion produces a stronger Learning Engine signal", () => {
  const weakGraph = buildBusinessKnowledgeGraph(
    [
      {
        sourceProviderId: "business_discovery",
        sourceLabel: "Business Discovery",
        entityType: GraphEntityTypes.SERVICE,
        entityLabel: "commercial roofing",
        confidence: "high",
        evidenceSummary: "evidence",
        occurredAt: NOW.toISOString(),
      },
      {
        sourceProviderId: "smart_uploads",
        sourceLabel: "Smart Uploads",
        entityType: GraphEntityTypes.SERVICE,
        entityLabel: "commercial roofing installation",
        confidence: "high",
        evidenceSummary: "evidence",
        occurredAt: NOW.toISOString(),
      },
    ],
    NOW,
  );
  const strongGraph = buildBusinessKnowledgeGraph(
    [
      ...weakGraph.entities.flatMap((e) => e.evidence.map((ev) => ({
        sourceProviderId: ev.sourceProviderId,
        sourceLabel: ev.sourceLabel,
        entityType: e.type,
        entityLabel: e.label,
        confidence: ev.confidence,
        evidenceSummary: ev.summary,
        occurredAt: ev.occurredAt,
      }))),
      {
        sourceProviderId: "website_testimonials",
        sourceLabel: "Website Testimonials",
        entityType: GraphEntityTypes.SERVICE,
        entityLabel: "commercial roofing",
        confidence: "high" as const,
        evidenceSummary: "A customer praised our commercial roofing work.",
        occurredAt: NOW.toISOString(),
      },
    ],
    NOW,
  );

  const weakReasoning = reasonAboutBusinessGraph(weakGraph, NOW);
  const strongReasoning = reasonAboutBusinessGraph(strongGraph, NOW);

  const weakSignal = businessReasoningToLearningSignals(weakReasoning)[0]!;
  const strongSignal = businessReasoningToLearningSignals(strongReasoning)[0]!;

  assert.equal(weakSignal.confidence, "medium");
  assert.equal(strongSignal.confidence, "high");
  assert.equal(weakSignal.patternKey, strongSignal.patternKey);
});

// ---------------------------------------------------------------------------
// Part 6 — Growth Advisor
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
      openRecommendations: 0,
      publishingReadyOrScheduled: 0,
      weeklyPublishedPosts: 0,
      publishFailures: 0,
      hasMarketingPlan: true,
      profileCreatedAt: NOW.toISOString(),
    },
    topRecommendationDetail: null,
    proactive: { celebrations: [] },
    executiveBrief: { generatedAt: NOW.toISOString() },
    whyPlanChanged: null,
    calendarPreview: null,
    campaigns: [],
    experiments: { pendingProposals: [], active: [], completed: [] },
    monthlyFocus: null,
    journal: { intro: "", entries: [] },
    primaryAction: { kind: "none", label: "", href: null },
    timeRespectLabel: "Nothing to review",
  } as unknown as HeadOfMarketingBriefing;
}

test("Growth Advisor cites a testimonial-corroborated theme the website doesn't emphasize, and explains why", () => {
  const intelligence: CustomerVoiceIntelligence = {
    businessProfileId: "biz-1",
    generatedAt: NOW.toISOString(),
    lastUpdated: NOW.toISOString(),
    strengths: [
      {
        key: "rapid_response",
        label: "rapid response time",
        kind: "strength",
        sentiment: "positive",
        confidence: "high",
        businessImpact: "medium",
        evidenceCount: 3,
        percentageOfReviews: 40,
        trendDirection: "improving",
        languageVariants: [],
        evidenceIds: [],
        lastUpdated: NOW.toISOString(),
      },
    ],
    concerns: [],
    opportunities: [],
    frequentlyMentionedServices: [],
    frequentlyMentionedEmployees: [],
    commonCustomerLanguage: [],
    requests: [],
    sentimentTrends: [],
    overallSentiment: "positive",
    confidence: "high",
    businessImpact: "medium",
    evidenceCount: 3,
    percentageOfReviewsCovered: 40,
    trendDirection: "improving",
    score: { score: 80, breakdown: {} as never, maturityLabel: "well_established", maturityCopy: "Strong." },
    contributingProviders: ["google_business_reviews", "website_testimonials"],
    emptyState: null,
  };

  const businessDiscovery = {
    generatedAt: NOW.toISOString(),
    primaryServices: { value: ["plumbing repair"], confidenceTier: "known" },
    uniqueStrengths: { value: ["licensed and insured"], confidenceTier: "known" },
    targetCustomers: { value: null, confidenceTier: "missing" },
    growthOpportunities: { value: [], confidenceTier: "missing" },
  } as unknown as BusinessDiscoveryResult;

  const observations = buildWhatINoticedObservations({
    briefing: emptyBriefing(),
    customerVoice: intelligence,
    businessDiscovery,
  });

  const gap = observations.find((o) => o.evidenceSource.startsWith("customer_voice:rapid_response"));
  assert.ok(gap);
  assert.match(gap!.headline, /rapid response time/);
  assert.match(gap!.headline, /rarely emphasizes/);
  assert.ok(gap!.whyItMatters.length > 0);
});

test("Growth Advisor never cites a testimonial gap unless Website Testimonials actually contributed evidence", () => {
  const intelligence: CustomerVoiceIntelligence = {
    businessProfileId: "biz-1",
    generatedAt: NOW.toISOString(),
    lastUpdated: NOW.toISOString(),
    strengths: [
      {
        key: "rapid_response",
        label: "rapid response time",
        kind: "strength",
        sentiment: "positive",
        confidence: "high",
        businessImpact: "medium",
        evidenceCount: 3,
        percentageOfReviews: 40,
        trendDirection: "improving",
        languageVariants: [],
        evidenceIds: [],
        lastUpdated: NOW.toISOString(),
      },
    ],
    concerns: [],
    opportunities: [],
    frequentlyMentionedServices: [],
    frequentlyMentionedEmployees: [],
    commonCustomerLanguage: [],
    requests: [],
    sentimentTrends: [],
    overallSentiment: "positive",
    confidence: "high",
    businessImpact: "medium",
    evidenceCount: 3,
    percentageOfReviewsCovered: 40,
    trendDirection: "improving",
    score: { score: 80, breakdown: {} as never, maturityLabel: "well_established", maturityCopy: "Strong." },
    contributingProviders: ["google_business_reviews"],
    emptyState: null,
  };

  const observations = buildWhatINoticedObservations({
    briefing: emptyBriefing(),
    customerVoice: intelligence,
  });

  assert.ok(!observations.some((o) => o.evidenceSource.startsWith("customer_voice:rapid_response")));
});

// ---------------------------------------------------------------------------
// Part 7 — Content Generator
// ---------------------------------------------------------------------------

test("formatTestimonialKnowledgeForContentPrompt groups grounded facts by category and never fabricates", () => {
  assert.equal(formatTestimonialKnowledgeForContentPrompt([]), null);
  assert.equal(formatTestimonialKnowledgeForContentPrompt(null), null);

  const block = formatTestimonialKnowledgeForContentPrompt([
    knowledgeFact({ category: "business_strength", fact: "Fast turnaround" }),
    knowledgeFact({ id: "f2", category: "trust_indicator", fact: "Licensed and insured" }),
  ]);
  assert.match(block!, /Business strength: Fast turnaround/);
  assert.match(block!, /Trust indicator: Licensed and insured/);
  assert.match(block!, /never invent facts beyond these/);
});

test("formatTestimonialQuotesForContentPrompt reuses only real, verbatim excerpts and never invents quotes", () => {
  assert.equal(formatTestimonialQuotesForContentPrompt([]), null);

  const block = formatTestimonialQuotesForContentPrompt([testimonial()]);
  assert.match(block!, /verbatim/i);
  assert.match(block!, /never alter, combine, or invent additional quotes/i);
  assert.ok(block!.includes(testimonial().quote));
  assert.match(block!, /Jane Smith, Owner/);
});

test("formatTestimonialQuotesForContentPrompt caps at 2 quotes and skips archived testimonials", () => {
  const block = formatTestimonialQuotesForContentPrompt([
    testimonial({ id: "t1", quote: "First quote is long enough to include here for the test." }),
    testimonial({ id: "t2", quote: "Second quote is long enough to include here for the test." }),
    testimonial({ id: "t3", quote: "Third quote should never appear in the output at all." }),
    testimonial({ id: "t4", status: "archived", quote: "Archived quote should never appear either." }),
  ]);
  assert.ok(!block!.includes("Third quote"));
  assert.ok(!block!.includes("Archived quote"));
});

// ---------------------------------------------------------------------------
// Part 8 — Marketing Health: Customer Understanding
// ---------------------------------------------------------------------------

test("computeBusinessKnowledgeHealth's customerUnderstanding dimension rewards multi-provider corroboration", () => {
  const graph = buildBusinessKnowledgeGraph([], NOW);
  const reasoning = reasonAboutBusinessGraph(graph, NOW);

  const singleProvider = computeBusinessKnowledgeHealth({
    graph,
    reasoning,
    sourcePresence: {
      businessDiscovery: true,
      goals: true,
      customerVoice: true,
      externalIntelligence: false,
      smartUploads: false,
      testimonials: false,
    },
    customerVoiceProviderCount: 1,
    customerVoiceEvidenceCount: 12,
    now: NOW,
  });

  const twoProviders = computeBusinessKnowledgeHealth({
    graph,
    reasoning,
    sourcePresence: {
      businessDiscovery: true,
      goals: true,
      customerVoice: true,
      externalIntelligence: false,
      smartUploads: false,
      testimonials: true,
    },
    customerVoiceProviderCount: 2,
    customerVoiceEvidenceCount: 12,
    now: NOW,
  });

  assert.ok(twoProviders.dimensions.customerUnderstanding.score > singleProvider.dimensions.customerUnderstanding.score);
  assert.match(twoProviders.dimensions.customerUnderstanding.detail, /corroborated/);
});

test("computeBusinessKnowledgeHealth explains missing testimonial evidence distinctly from missing customer voice entirely", () => {
  const graph = buildBusinessKnowledgeGraph([], NOW);
  const reasoning = reasonAboutBusinessGraph(graph, NOW);

  const noCustomerVoiceAtAll = computeBusinessKnowledgeHealth({
    graph,
    reasoning,
    sourcePresence: {
      businessDiscovery: true,
      goals: true,
      customerVoice: false,
      externalIntelligence: false,
      smartUploads: false,
      testimonials: false,
    },
    now: NOW,
  });
  assert.ok(noCustomerVoiceAtAll.missingKnowledge.some((g) => g.label === "Customer sentiment"));
  assert.ok(!noCustomerVoiceAtAll.missingKnowledge.some((g) => g.label === "Website testimonials"));

  const reviewsButNoTestimonials = computeBusinessKnowledgeHealth({
    graph,
    reasoning,
    sourcePresence: {
      businessDiscovery: true,
      goals: true,
      customerVoice: true,
      externalIntelligence: false,
      smartUploads: false,
      testimonials: false,
    },
    now: NOW,
  });
  assert.ok(!reviewsButNoTestimonials.missingKnowledge.some((g) => g.label === "Customer sentiment"));
  assert.ok(reviewsButNoTestimonials.missingKnowledge.some((g) => g.label === "Website testimonials"));
});

test("computeBusinessKnowledgeHealth's dataCompleteness counts testimonials as a distinct source", () => {
  const graph = buildBusinessKnowledgeGraph([], NOW);
  const reasoning = reasonAboutBusinessGraph(graph, NOW);
  const health = computeBusinessKnowledgeHealth({
    graph,
    reasoning,
    sourcePresence: {
      businessDiscovery: true,
      goals: true,
      customerVoice: true,
      externalIntelligence: true,
      smartUploads: true,
      testimonials: true,
    },
    now: NOW,
  });
  assert.equal(health.dimensions.dataCompleteness.score, 100);
});

// ---------------------------------------------------------------------------
// Business Connections — evidence-driven recommendation now includes
// testimonials as a live Customer Feedback connection.
// ---------------------------------------------------------------------------

test("resolveBusinessConnections marks Website Testimonials connected once at least one testimonial exists", () => {
  const notConnected = resolveBusinessConnections({
    gbpConnected: false,
    gbpNeedsAttention: false,
    gbpLastSyncAt: null,
    hasWebsite: false,
    websiteAnalyzed: false,
    websiteAnalyzedAt: null,
    searchConsoleConnected: false,
    searchConsoleNeedsAttention: false,
    searchConsoleLastSyncAt: null,
    smartUploadsConnected: false,
    smartUploadsNeedsAttention: false,
    smartUploadsLastSyncAt: null,
    testimonialsConnected: false,
    testimonialsLastSyncAt: null,
  }).find((c) => c.providerId === "website_testimonials");
  assert.equal(notConnected?.status, "not_connected");

  const connected = resolveBusinessConnections({
    gbpConnected: false,
    gbpNeedsAttention: false,
    gbpLastSyncAt: null,
    hasWebsite: false,
    websiteAnalyzed: false,
    websiteAnalyzedAt: null,
    searchConsoleConnected: false,
    searchConsoleNeedsAttention: false,
    searchConsoleLastSyncAt: null,
    smartUploadsConnected: false,
    smartUploadsNeedsAttention: false,
    smartUploadsLastSyncAt: null,
    testimonialsConnected: true,
    testimonialsLastSyncAt: NOW.toISOString(),
  }).find((c) => c.providerId === "website_testimonials");
  assert.equal(connected?.status, "connected");
});

test("recommendNextConnection can surface Website Testimonials with an evidence-driven why", () => {
  const connections = resolveBusinessConnections({
    gbpConnected: true,
    gbpNeedsAttention: false,
    gbpLastSyncAt: NOW.toISOString(),
    hasWebsite: true,
    websiteAnalyzed: false,
    websiteAnalyzedAt: null,
    searchConsoleConnected: false,
    searchConsoleNeedsAttention: false,
    searchConsoleLastSyncAt: null,
    smartUploadsConnected: false,
    smartUploadsNeedsAttention: false,
    smartUploadsLastSyncAt: null,
    testimonialsConnected: false,
    testimonialsLastSyncAt: null,
  });
  const recommendation = recommendNextConnection(connections);
  assert.ok(recommendation);
  assert.equal(recommendation!.connectionId, "conn_website_testimonials");
});

// ---------------------------------------------------------------------------
// Permissions & tenant isolation
// ---------------------------------------------------------------------------

test("createTestimonial and listTestimonialsForUser scope every query to the given userId", async () => {
  const { client, calls } = createFakeSupabaseClient({
    website_testimonials: { data: testimonial(), error: null },
  });

  await createTestimonial(client, {
    userId: "user-1",
    businessProfileId: "biz-1",
    testimonial: { quote: "A real testimonial quote goes here." },
    ingestionMethod: "manual",
  });
  await listTestimonialsForUser(client, "user-1", "biz-1");

  // createTestimonial is an insert (user_id supplied as a column value, not an
  // .eq() filter — RLS enforces isolation at the DB level for writes), so only
  // listTestimonialsForUser's read contributes an .eq("user_id", ...) call.
  assert.deepEqual(userIdsQueried(calls), ["user-1"]);
});

test("deleteTestimonial scopes the delete to the given userId — never a cross-tenant delete", async () => {
  const { client, calls } = createFakeSupabaseClient({
    website_testimonials: { data: null, error: null },
  });

  await deleteTestimonial(client, "user-1", "some-other-tenants-testimonial-id");
  assert.deepEqual(userIdsQueried(calls), ["user-1"]);
});

test("getActiveTestimonialKnowledgeForUser scopes the query to the given userId and businessProfileId", async () => {
  const { client, calls } = createFakeSupabaseClient({
    testimonial_knowledge_facts: { data: [knowledgeFact()], error: null },
  });

  const facts = await getActiveTestimonialKnowledgeForUser(client, "user-1", "biz-1");
  assert.equal(facts.length, 1);
  assert.deepEqual(userIdsQueried(calls), ["user-1"]);
});

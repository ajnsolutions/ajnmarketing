import { test } from "node:test";
import assert from "node:assert/strict";

import { scoreOpportunity, evidenceStrengthScore, historicalSuccessScore } from "../lib/opportunity-engine/score.ts";
import { mergeOpportunityCandidates } from "../lib/opportunity-engine/dedupe.ts";
import { planOpportunityReconciliation, EXPIRE_AFTER_DAYS } from "../lib/opportunity-engine/reconcile.ts";
import { detectOpportunityCandidates } from "../lib/opportunity-engine/detect.ts";
import { externalIntelligenceOpportunityCandidates } from "../lib/opportunity-engine/adapters/externalIntelligence.ts";
import { customerVoiceOpportunityCandidates } from "../lib/opportunity-engine/adapters/customerVoice.ts";
import { smartUploadsOpportunityCandidates } from "../lib/opportunity-engine/adapters/smartUploads.ts";
import { businessLearningEngineOpportunityCandidates } from "../lib/opportunity-engine/adapters/businessLearningEngine.ts";
import { OpportunityTypes, type DetectedOpportunity, type OpportunityCandidateInput } from "../lib/opportunity-engine/types.ts";
import { buildBusinessTimeline } from "../lib/business-timeline/build.ts";
import { BusinessTimelineEntryTypes } from "../lib/business-timeline/types.ts";
import { computeBusinessKnowledgeHealth } from "../lib/business-knowledge-graph/knowledgeHealth.ts";
import type { BusinessKnowledgeGraph } from "../lib/business-knowledge-graph/types.ts";
import { reasonAboutBusinessGraph } from "../lib/business-knowledge-graph/reasoning.ts";
import { resolvePrimaryObjective } from "../lib/growth-planner/primaryObjective.ts";
import { synthesizePlanEvidence } from "../lib/growth-planner/evidence.ts";
import { PrimaryObjectiveKeys } from "../lib/growth-planner/types.ts";
import type { HeadOfMarketingBriefing } from "../lib/head-of-marketing/types.ts";
import type { ExternalIntelligence } from "../lib/external-intelligence/types.ts";
import type { CustomerVoiceIntelligence, CustomerVoiceTheme } from "../lib/customer-voice/types.ts";
import type { BusinessPattern } from "../lib/business-learning-engine/types.ts";
import { RecommendedActionTypes } from "../lib/marketing-decisions/types.ts";
import { createFakeSupabaseClient, userIdsQueried } from "./support/fake-supabase-client.ts";
import {
  getActiveOpportunitiesForUser,
  insertOpportunity,
  refreshOpportunity,
  retireOpportunity,
} from "../lib/opportunity-engine/persistence.ts";

const NOW = new Date("2026-08-01T00:00:00.000Z");

function evidence(id: string, providerId: string, daysAgo = 1) {
  return {
    id,
    sourceProviderId: providerId,
    sourceLabel: providerId,
    summary: `evidence from ${providerId}`,
    occurredAt: new Date(NOW.getTime() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
  };
}

function opportunity(overrides: Partial<DetectedOpportunity> = {}): DetectedOpportunity {
  return {
    id: "opp-1",
    type: OpportunityTypes.SERVICE_SPOTLIGHT,
    topic: "commercial roofing",
    statement: "Spotlight commercial roofing",
    whyNow: "Customers keep asking",
    expectedOutcome: "More bookings",
    evidence: [evidence("e1", "customer_voice")],
    contributingProviders: ["customer_voice"],
    confidence: "medium",
    score: { total: 50, evidenceStrength: 50, businessImpact: 50, urgency: 50, confidence: 50, historicalSuccess: 50 },
    status: "active",
    relatedActionType: null,
    firstDetectedAt: NOW.toISOString(),
    lastSeenAt: NOW.toISOString(),
    retiredAt: null,
    retiredReason: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Part 3 — Scoring
// ---------------------------------------------------------------------------

test("evidenceStrengthScore rewards more corroborating providers and more recent evidence", () => {
  const single = evidenceStrengthScore([evidence("e1", "customer_voice", 1)], NOW);
  const multi = evidenceStrengthScore(
    [evidence("e1", "customer_voice", 1), evidence("e2", "external_intelligence", 1), evidence("e3", "smart_uploads", 1)],
    NOW,
  );
  const stale = evidenceStrengthScore([evidence("e1", "customer_voice", 90)], NOW);

  assert.ok(multi > single);
  assert.ok(single > stale);
});

test("historicalSuccessScore is neutral without a relevant, reinforced pattern, and never fabricates one", () => {
  assert.equal(historicalSuccessScore(null, []), 50);
  assert.equal(historicalSuccessScore(RecommendedActionTypes.CREATE_TIMELY_CONTENT, []), 50);

  const thinPattern: BusinessPattern = {
    id: "p1",
    patternKey: `recommendation_action_outcome:${RecommendedActionTypes.CREATE_TIMELY_CONTENT}`,
    statement: "s",
    direction: "positive",
    confidenceLevel: "high",
    contributingProviders: ["recommendation_outcomes"],
    evidence: [],
    firstObserved: NOW.toISOString(),
    lastReinforced: NOW.toISOString(),
    reinforcementCount: 1,
    decayState: "fresh",
    effectiveConfidence: "high",
  };
  assert.equal(historicalSuccessScore(RecommendedActionTypes.CREATE_TIMELY_CONTENT, [thinPattern]), 50);
});

test("historicalSuccessScore rewards a genuinely positive, reinforced pattern and penalizes a negative one", () => {
  const positive: BusinessPattern = {
    id: "p1",
    patternKey: `recommendation_action_outcome:${RecommendedActionTypes.CREATE_TIMELY_CONTENT}`,
    statement: "s",
    direction: "positive",
    confidenceLevel: "high",
    contributingProviders: ["recommendation_outcomes"],
    evidence: [],
    firstObserved: NOW.toISOString(),
    lastReinforced: NOW.toISOString(),
    reinforcementCount: 3,
    decayState: "fresh",
    effectiveConfidence: "high",
  };
  const negative: BusinessPattern = { ...positive, direction: "negative" };

  assert.equal(historicalSuccessScore(RecommendedActionTypes.CREATE_TIMELY_CONTENT, [positive]), 100);
  assert.equal(historicalSuccessScore(RecommendedActionTypes.CREATE_TIMELY_CONTENT, [negative]), 0);
});

test("scoreOpportunity weights evidence strength highest, so strong current evidence beats a fabricated historical boost", () => {
  const strongEvidenceWeakHistory = scoreOpportunity({
    evidence: [evidence("e1", "customer_voice", 1), evidence("e2", "external_intelligence", 1), evidence("e3", "smart_uploads", 1)],
    businessImpact: "high",
    urgency: "high",
    confidence: "high",
    patterns: [],
    now: NOW,
  });
  const weakEvidenceOnly = scoreOpportunity({
    evidence: [evidence("e1", "customer_voice", 90)],
    businessImpact: "low",
    urgency: "low",
    confidence: "low",
    patterns: [],
    now: NOW,
  });

  assert.ok(strongEvidenceWeakHistory.total > weakEvidenceOnly.total);
  assert.ok(strongEvidenceWeakHistory.evidenceStrength >= strongEvidenceWeakHistory.historicalSuccess);
});

// ---------------------------------------------------------------------------
// Part 2/4 — Adapters, detection, deduplication
// ---------------------------------------------------------------------------

test("externalIntelligenceOpportunityCandidates covers seasonal, local event, trending search, and competitive positioning", () => {
  const insight = (overrides: Record<string, unknown>) => ({
    id: "i1",
    category: "seasonal_opportunities",
    insight: "text",
    confidence: "high",
    businessImpact: "high",
    timeHorizon: "short_term",
    evidence: [],
    possibleActions: [],
    relatedGoals: [],
    lastUpdated: NOW.toISOString(),
    clusterKey: "k",
    corroboratingProviderCount: 1,
    ...overrides,
  });

  const ei = {
    businessProfileId: "b1",
    generatedAt: NOW.toISOString(),
    lastUpdated: NOW.toISOString(),
    insights: [],
    seasonalOpportunities: [insight({ insight: "Spring is coming" })],
    localEvents: [insight({ insight: "Street fair this weekend" })],
    searchDemandTrends: [insight({ insight: "Roofing searches rising" })],
    competitorActivity: [insight({ insight: "Competitor launched a promo" })],
    industryRegulatoryUpdates: [],
    weather: [],
    holidayCalendar: [],
    confidence: "high",
    businessImpact: "high",
    evidenceCount: 4,
    score: {} as ExternalIntelligence["score"],
    contributingProviders: ["google_trends"],
    emptyState: null,
  } as unknown as ExternalIntelligence;

  const candidates = externalIntelligenceOpportunityCandidates(ei);
  const types = candidates.map((c) => c.type).sort();
  assert.deepEqual(types, [
    OpportunityTypes.COMPETITIVE_POSITIONING,
    OpportunityTypes.LOCAL_EVENT,
    OpportunityTypes.SEASONAL,
    OpportunityTypes.TRENDING_SEARCH,
  ].sort());
});

test("externalIntelligenceOpportunityCandidates produces nothing when there is no evidence", () => {
  assert.deepEqual(externalIntelligenceOpportunityCandidates(null), []);
  assert.deepEqual(
    externalIntelligenceOpportunityCandidates({ emptyState: "no_evidence" } as unknown as ExternalIntelligence),
    [],
  );
});

function theme(overrides: Partial<CustomerVoiceTheme>): CustomerVoiceTheme {
  return {
    key: "k",
    label: "rapid response",
    kind: "strength",
    sentiment: "positive",
    confidence: "high",
    businessImpact: "high",
    evidenceCount: 5,
    percentageOfReviews: 40,
    trendDirection: "stable",
    languageVariants: [],
    evidenceIds: [],
    lastUpdated: NOW.toISOString(),
    ...overrides,
  };
}

test("customerVoiceOpportunityCandidates never invents a reputation concern from a thin or low-impact theme", () => {
  const thin = customerVoiceOpportunityCandidates({
    concerns: [theme({ evidenceCount: 1, businessImpact: "high" })],
    strengths: [],
    frequentlyMentionedServices: [],
    score: { maturityLabel: "well_established" },
    evidenceCount: 20,
    emptyState: null,
  } as unknown as CustomerVoiceIntelligence);
  assert.deepEqual(
    thin.filter((c) => c.type === OpportunityTypes.REPUTATION),
    [],
  );
});

test("customerVoiceOpportunityCandidates surfaces reputation, review-request, and service-spotlight from real, well-evidenced themes", () => {
  const cv = {
    concerns: [theme({ label: "slow callbacks", evidenceCount: 3, businessImpact: "high", sentiment: "negative" })],
    strengths: [],
    frequentlyMentionedServices: [theme({ label: "commercial roofing", evidenceCount: 4, confidence: "medium" })],
    score: { maturityLabel: "continuing_to_learn" },
    evidenceCount: 3,
    lastUpdated: NOW.toISOString(),
    emptyState: null,
  } as unknown as CustomerVoiceIntelligence;

  const candidates = customerVoiceOpportunityCandidates(cv);
  const types = candidates.map((c) => c.type).sort();
  assert.deepEqual(
    types,
    [OpportunityTypes.REPUTATION, OpportunityTypes.REVIEW_REQUEST, OpportunityTypes.SERVICE_SPOTLIGHT].sort(),
  );
  const reviewRequest = candidates.find((c) => c.type === OpportunityTypes.REVIEW_REQUEST);
  assert.equal(reviewRequest?.relatedActionType, RecommendedActionTypes.REQUEST_REVIEWS);
});

test("smartUploadsOpportunityCandidates reuses findWebsiteContentGaps and surfaces FAQ facts", () => {
  const facts = [
    {
      id: "f1",
      user_id: "u1",
      business_profile_id: "b1",
      document_id: "d1",
      category: "service",
      fact: "Commercial roofing installation",
      source_excerpt: null,
      confidence: "high",
      date_learned: NOW.toISOString(),
      last_verified_at: NOW.toISOString(),
      superseded_by: null,
      created_at: NOW.toISOString(),
      updated_at: NOW.toISOString(),
    },
    {
      id: "f2",
      user_id: "u1",
      business_profile_id: "b1",
      document_id: "d1",
      category: "faq",
      fact: "Do you offer free estimates?",
      source_excerpt: null,
      confidence: "medium",
      date_learned: NOW.toISOString(),
      last_verified_at: NOW.toISOString(),
      superseded_by: null,
      created_at: NOW.toISOString(),
      updated_at: NOW.toISOString(),
    },
  ];

  const candidates = smartUploadsOpportunityCandidates({
    smartUploadFacts: facts as never,
    smartUploadDocuments: [{ id: "d1", file_name: "brochure.pdf" } as never],
    websiteServices: ["residential plumbing repair"],
  });

  const types = candidates.map((c) => c.type).sort();
  assert.deepEqual(types, [OpportunityTypes.CONTENT_GAP, OpportunityTypes.FAQ].sort());
});

test("businessLearningEngineOpportunityCandidates only speaks up once a content pattern has real reinforcement", () => {
  const thin: BusinessPattern = {
    id: "p1",
    patternKey: `recommendation_action_outcome:${RecommendedActionTypes.REFRESH_WEBSITE_CONTENT}`,
    statement: "s",
    direction: "negative",
    confidenceLevel: "high",
    contributingProviders: [],
    evidence: [],
    firstObserved: NOW.toISOString(),
    lastReinforced: NOW.toISOString(),
    reinforcementCount: 1,
    decayState: "fresh",
    effectiveConfidence: "high",
  };
  assert.deepEqual(businessLearningEngineOpportunityCandidates([thin]), []);

  const reinforced: BusinessPattern = { ...thin, reinforcementCount: 3 };
  const candidates = businessLearningEngineOpportunityCandidates([reinforced]);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]!.type, OpportunityTypes.UNDERPERFORMING_CONTENT_REFRESH);

  const positiveReinforced: BusinessPattern = { ...reinforced, direction: "positive" };
  const expansion = businessLearningEngineOpportunityCandidates([positiveReinforced]);
  assert.equal(expansion[0]!.type, OpportunityTypes.HIGH_PERFORMING_CONTENT_EXPANSION);
});

test("mergeOpportunityCandidates fuses same-type, overlapping-topic candidates and keeps unrelated ones distinct", () => {
  const candidates: OpportunityCandidateInput[] = [
    {
      sourceProviderId: "customer_voice",
      sourceLabel: "Customer Voice",
      type: OpportunityTypes.SERVICE_SPOTLIGHT,
      topic: "commercial roofing repair",
      statement: "Customers mention commercial roofing",
      whyNow: "why",
      expectedOutcome: "outcome",
      confidence: "medium",
      businessImpact: "medium",
      urgency: "medium",
      evidenceSummary: "e1",
      occurredAt: NOW.toISOString(),
    },
    {
      sourceProviderId: "business_knowledge_graph",
      sourceLabel: "Business Knowledge Graph",
      type: OpportunityTypes.SERVICE_SPOTLIGHT,
      topic: "commercial roofing installation",
      statement: "Commercial roofing is a growth opportunity",
      whyNow: "why2",
      expectedOutcome: "outcome2",
      confidence: "high",
      businessImpact: "high",
      urgency: "low",
      evidenceSummary: "e2",
      occurredAt: NOW.toISOString(),
    },
    {
      sourceProviderId: "external_intelligence",
      sourceLabel: "External Intelligence",
      type: OpportunityTypes.SEASONAL,
      topic: "holiday promotion",
      statement: "Seasonal window",
      whyNow: "why3",
      expectedOutcome: "outcome3",
      confidence: "low",
      businessImpact: "low",
      urgency: "high",
      evidenceSummary: "e3",
      occurredAt: NOW.toISOString(),
    },
  ];

  const merged = mergeOpportunityCandidates(candidates);
  assert.equal(merged.length, 2);

  const roofing = merged.find((m) => m.type === OpportunityTypes.SERVICE_SPOTLIGHT)!;
  assert.equal(roofing.evidence.length, 2);
  assert.equal(roofing.confidence, "high");
  assert.equal(roofing.businessImpact, "high");
});

test("detectOpportunityCandidates never fabricates candidates when every source is empty", () => {
  assert.deepEqual(detectOpportunityCandidates({}), []);
});

// ---------------------------------------------------------------------------
// Part 4 — Lifecycle reconciliation
// ---------------------------------------------------------------------------

test("planOpportunityReconciliation creates new opportunities and updates re-detected ones", () => {
  const existing = opportunity({ id: "existing-1", type: OpportunityTypes.SERVICE_SPOTLIGHT, topic: "commercial roofing" });
  const scoredMatch = {
    merged: {
      type: OpportunityTypes.SERVICE_SPOTLIGHT,
      topic: "commercial roofing repair",
      statement: "s",
      whyNow: "w",
      expectedOutcome: "e",
      confidence: "high" as const,
      businessImpact: "high" as const,
      urgency: "medium" as const,
      relatedActionType: null,
      evidence: [evidence("e1", "customer_voice")],
      occurredAt: NOW.toISOString(),
    },
    score: { total: 80, evidenceStrength: 80, businessImpact: 80, urgency: 80, confidence: 80, historicalSuccess: 50 },
  };
  const scoredNew = {
    merged: {
      type: OpportunityTypes.FAQ,
      topic: "warranty coverage",
      statement: "s2",
      whyNow: "w2",
      expectedOutcome: "e2",
      confidence: "medium" as const,
      businessImpact: "medium" as const,
      urgency: "low" as const,
      relatedActionType: null,
      evidence: [evidence("e2", "smart_uploads")],
      occurredAt: NOW.toISOString(),
    },
    score: { total: 55, evidenceStrength: 55, businessImpact: 55, urgency: 55, confidence: 55, historicalSuccess: 50 },
  };

  const plan = planOpportunityReconciliation({
    existingActive: [existing],
    scoredCandidates: [scoredMatch, scoredNew],
    learningPatterns: [],
    now: NOW,
  });

  assert.equal(plan.toCreate.length, 1);
  assert.equal(plan.toCreate[0]!.merged.type, OpportunityTypes.FAQ);
  assert.equal(plan.toUpdate.length, 1);
  assert.equal(plan.toUpdate[0]!.existing.id, "existing-1");
  assert.deepEqual(plan.toExpire, []);
  assert.deepEqual(plan.toComplete, []);
});

test("planOpportunityReconciliation expires an undetected opportunity only after the grace window, and never before", () => {
  const recentlyQuiet = opportunity({
    id: "recent",
    lastSeenAt: new Date(NOW.getTime() - (EXPIRE_AFTER_DAYS - 1) * 24 * 60 * 60 * 1000).toISOString(),
  });
  const longQuiet = opportunity({
    id: "stale",
    lastSeenAt: new Date(NOW.getTime() - (EXPIRE_AFTER_DAYS + 1) * 24 * 60 * 60 * 1000).toISOString(),
  });

  const plan = planOpportunityReconciliation({
    existingActive: [recentlyQuiet, longQuiet],
    scoredCandidates: [],
    learningPatterns: [],
    now: NOW,
  });

  assert.deepEqual(
    plan.unchanged.map((o) => o.id),
    ["recent"],
  );
  assert.deepEqual(
    plan.toExpire.map((o) => o.id),
    ["stale"],
  );
});

test("planOpportunityReconciliation completes an opportunity only when the Learning Engine has real, reinforced positive evidence for its action type", () => {
  const withAction = opportunity({ id: "acted-on", relatedActionType: RecommendedActionTypes.REQUEST_REVIEWS });
  const pattern: BusinessPattern = {
    id: "p1",
    patternKey: `recommendation_action_outcome:${RecommendedActionTypes.REQUEST_REVIEWS}`,
    statement: "s",
    direction: "positive",
    confidenceLevel: "high",
    contributingProviders: [],
    evidence: [],
    firstObserved: NOW.toISOString(),
    lastReinforced: NOW.toISOString(),
    reinforcementCount: 2,
    decayState: "fresh",
    effectiveConfidence: "high",
  };

  const plan = planOpportunityReconciliation({
    existingActive: [withAction],
    scoredCandidates: [],
    learningPatterns: [pattern],
    now: NOW,
  });

  assert.deepEqual(
    plan.toComplete.map((o) => o.id),
    ["acted-on"],
  );
  assert.deepEqual(plan.toExpire, []);
});

// ---------------------------------------------------------------------------
// Part 5 — Growth Advisor integration
// ---------------------------------------------------------------------------

test("Growth Advisor surfaces only the single top opportunity, with why-now, expected outcome, and evidence", async () => {
  const { buildWhatINoticedObservations } = await import("../lib/growth-advisor/observations.ts");
  const briefing = { noticed: [], thisWeek: [] } as unknown as HeadOfMarketingBriefing;

  const top = opportunity({
    statement: "Spotlight commercial roofing",
    whyNow: "Customers keep asking about it",
    expectedOutcome: "More bookings from an existing strength",
    evidence: [evidence("e1", "customer_voice"), evidence("e2", "business_knowledge_graph")],
  });

  const observations = buildWhatINoticedObservations({ briefing, topOpportunity: top });
  const opportunityObs = observations.find((o) => o.evidenceSource.startsWith("opportunity_engine:"));
  assert.ok(opportunityObs);
  assert.equal(opportunityObs!.headline, "Spotlight commercial roofing");
  assert.equal(opportunityObs!.whyItMatters, "Customers keep asking about it");
  assert.equal(opportunityObs!.expectedOutcome, "More bookings from an existing strength");
  assert.equal(opportunityObs!.supportingEvidence?.length, 2);

  const withoutOpportunity = buildWhatINoticedObservations({ briefing });
  assert.ok(!withoutOpportunity.some((o) => o.evidenceSource.startsWith("opportunity_engine:")));
});

// ---------------------------------------------------------------------------
// Part 6 — Weekly Growth Plan integration
// ---------------------------------------------------------------------------

test("resolvePrimaryObjective is driven by a strong active opportunity, but defers to existing resolution when the opportunity is weak", () => {
  const briefing = { topRecommendationDetail: null } as unknown as HeadOfMarketingBriefing;

  const strong = opportunity({
    type: OpportunityTypes.REPUTATION,
    score: { total: 75, evidenceStrength: 75, businessImpact: 75, urgency: 75, confidence: 75, historicalSuccess: 50 },
  });
  const resolvedStrong = resolvePrimaryObjective({ briefing, goals: [], topOpportunity: strong });
  assert.equal(resolvedStrong.key, PrimaryObjectiveKeys.IMPROVE_REVIEW_VELOCITY);

  const weak = opportunity({
    type: OpportunityTypes.REPUTATION,
    score: { total: 30, evidenceStrength: 30, businessImpact: 30, urgency: 30, confidence: 30, historicalSuccess: 50 },
  });
  const resolvedWeak = resolvePrimaryObjective({ briefing, goals: [], topOpportunity: weak });
  assert.equal(resolvedWeak.key, PrimaryObjectiveKeys.GROW_LOCAL_AWARENESS);
});

test("synthesizePlanEvidence cites the top opportunity first when one is present", () => {
  const briefing = { thisWeek: [], topRecommendationDetail: null } as unknown as HeadOfMarketingBriefing;
  const top = opportunity({ statement: "Spotlight commercial roofing" });

  const items = synthesizePlanEvidence({ briefing, goals: [], topOpportunity: top });
  assert.equal(items[0]!.source, "opportunity_engine");
  assert.equal(items[0]!.statement, "Spotlight commercial roofing");
});

// ---------------------------------------------------------------------------
// Part 7 — Business Timeline integration
// ---------------------------------------------------------------------------

test("Business Timeline shows detected, completed, expired, and learned-from opportunity entries", () => {
  const detected = opportunity({ id: "o1", status: "active" });
  const completed = opportunity({
    id: "o2",
    status: "completed",
    retiredAt: NOW.toISOString(),
    retiredReason: "completed",
    relatedActionType: RecommendedActionTypes.REQUEST_REVIEWS,
  });
  const expired = opportunity({ id: "o3", status: "expired", retiredAt: NOW.toISOString(), retiredReason: "expired" });

  const entries = buildBusinessTimeline({
    recommendationOutcomeEvents: [],
    campaigns: [],
    smartUploadDocuments: [],
    learningPatterns: [],
    opportunities: [detected, completed, expired],
  });

  const types = new Set(entries.map((e) => e.type));
  assert.ok(types.has(BusinessTimelineEntryTypes.OPPORTUNITY_DETECTED));
  assert.ok(types.has(BusinessTimelineEntryTypes.OPPORTUNITY_COMPLETED));
  assert.ok(types.has(BusinessTimelineEntryTypes.OPPORTUNITY_EXPIRED));
  assert.ok(types.has(BusinessTimelineEntryTypes.OPPORTUNITY_LEARNED_FROM));

  // The expired opportunity never produces a "learned from" entry — it has
  // no related action type and never completed.
  assert.ok(!entries.some((e) => e.id === `opportunity_learned_${expired.id}`));
});

// ---------------------------------------------------------------------------
// Part 8 — Marketing Health integration
// ---------------------------------------------------------------------------

test("computeBusinessKnowledgeHealth's opportunityReadiness dimension rewards active opportunities and explains missed ones", () => {
  const graph: BusinessKnowledgeGraph = { generatedAt: NOW.toISOString(), entities: [], relationships: [] };
  const reasoning = reasonAboutBusinessGraph(graph, NOW);

  const withOpportunities = computeBusinessKnowledgeHealth({
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
    activeOpportunityCount: 3,
    expiredOpportunityCount: 2,
    now: NOW,
  });
  assert.ok(withOpportunities.dimensions.opportunityReadiness.score > 0);
  assert.match(withOpportunities.dimensions.opportunityReadiness.detail, /2 others expired/);

  const withoutOpportunities = computeBusinessKnowledgeHealth({
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
  assert.equal(withoutOpportunities.dimensions.opportunityReadiness.score, 0);
  assert.ok(withoutOpportunities.missingKnowledge.some((gap) => gap.label === "Active opportunities"));
});

// ---------------------------------------------------------------------------
// Permissions & tenant isolation
// ---------------------------------------------------------------------------

test("insertOpportunity, getActiveOpportunitiesForUser, refreshOpportunity, and retireOpportunity all scope to the given userId", async () => {
  const row = {
    id: "opp-db-1",
    opportunity_type: "service_spotlight",
    topic: "commercial roofing",
    statement: "s",
    why_now: "w",
    expected_outcome: "e",
    evidence: [],
    contributing_providers: [],
    confidence: "medium",
    score_total: 50,
    score_evidence_strength: 50,
    score_business_impact: 50,
    score_urgency: 50,
    score_confidence: 50,
    score_historical_success: 50,
    status: "active",
    related_action_type: null,
    first_detected_at: NOW.toISOString(),
    last_seen_at: NOW.toISOString(),
    retired_at: null,
    retired_reason: null,
  };

  const { client, calls } = createFakeSupabaseClient({
    detected_opportunities: (op) => (op === "single" ? { data: row, error: null } : { data: [row], error: null }),
  });

  await insertOpportunity(client, "user-1", "biz-1", {
    type: "service_spotlight" as never,
    topic: "commercial roofing",
    statement: "s",
    whyNow: "w",
    expectedOutcome: "e",
    evidence: [],
    contributingProviders: [],
    confidence: "medium",
    score: { total: 50, evidenceStrength: 50, businessImpact: 50, urgency: 50, confidence: 50, historicalSuccess: 50 },
    status: "active",
    relatedActionType: null,
    firstDetectedAt: NOW.toISOString(),
    lastSeenAt: NOW.toISOString(),
    retiredAt: null,
    retiredReason: null,
  });
  await getActiveOpportunitiesForUser(client, "user-1", "biz-1");
  await refreshOpportunity(client, "opp-db-1", opportunity({ id: "opp-db-1", topic: "commercial roofing" }));
  await retireOpportunity(client, "opp-db-1", "expired", NOW);

  // insertOpportunity supplies user_id as a column value (not an .eq()
  // filter, since it's a write); refreshOpportunity/retireOpportunity scope
  // by opportunity id and rely on RLS for tenant isolation on update — the
  // same established pattern as business-learning-engine's
  // updateBusinessLearningPattern. Only the read below issues a real
  // .eq("user_id", ...) filter.
  assert.deepEqual(userIdsQueried(calls), ["user-1"]);
});

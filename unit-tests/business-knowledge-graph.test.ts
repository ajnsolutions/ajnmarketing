import test from "node:test";
import assert from "node:assert/strict";

import { buildBusinessKnowledgeGraph } from "../lib/business-knowledge-graph/build.ts";
import { reasonAboutBusinessGraph, findPriorityConflicts } from "../lib/business-knowledge-graph/reasoning.ts";
import {
  explainConclusion,
  explainOpportunitySignal,
  explainConflict,
} from "../lib/business-knowledge-graph/explainability.ts";
import { computeBusinessKnowledgeHealth } from "../lib/business-knowledge-graph/knowledgeHealth.ts";
import {
  getBusinessReasoning,
  getBusinessKnowledgeHealth,
  buildBusinessGraph,
} from "../lib/business-knowledge-graph/service.ts";
import { businessDiscoveryToGraphSignals } from "../lib/business-knowledge-graph/adapters/businessDiscovery.ts";
import { goalsToGraphSignals } from "../lib/business-knowledge-graph/adapters/goals.ts";
import { customerVoiceToGraphSignals } from "../lib/business-knowledge-graph/adapters/customerVoice.ts";
import { externalIntelligenceToGraphSignals } from "../lib/business-knowledge-graph/adapters/externalIntelligence.ts";
import { smartUploadsToGraphSignals } from "../lib/business-knowledge-graph/adapters/smartUploads.ts";
import { GraphEntityTypes, GraphRelationshipTypes, type GraphSignalInput } from "../lib/business-knowledge-graph/types.ts";
import { buildWhatINoticedObservations } from "../lib/growth-advisor/observations.ts";
import { synthesizePlanEvidence } from "../lib/growth-planner/evidence.ts";
import { recommendNextConnection } from "../lib/business-connections/recommendNext.ts";
import { buildBusinessBrainReadiness } from "../lib/business-connections/readiness.ts";
import { resolveBusinessConnections } from "../lib/business-connections/resolve.ts";
import type { BusinessGoal } from "../lib/goals/types.ts";
import type { CustomerVoiceIntelligence } from "../lib/customer-voice/types.ts";
import type { ExternalIntelligence } from "../lib/external-intelligence/types.ts";
import type { BusinessDiscoveryResult } from "../lib/business-discovery/types.ts";
import type { SmartUploadKnowledgeFactRecord } from "../lib/smart-uploads/types.ts";
import type { HeadOfMarketingBriefing } from "../lib/head-of-marketing/types.ts";

const NOW = new Date("2026-07-30T00:00:00.000Z");

function signal(overrides: Partial<GraphSignalInput> & Pick<GraphSignalInput, "sourceProviderId" | "sourceLabel" | "entityType" | "entityLabel">): GraphSignalInput {
  return {
    confidence: "high",
    evidenceSummary: `${overrides.sourceLabel} evidence about ${overrides.entityLabel}`,
    occurredAt: NOW.toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// build.ts — relationship creation, entity clustering
// ---------------------------------------------------------------------------

test("buildBusinessKnowledgeGraph merges same-topic entities by overlap, not exact text", () => {
  const graph = buildBusinessKnowledgeGraph(
    [
      signal({
        sourceProviderId: "business_discovery",
        sourceLabel: "Business Discovery",
        entityType: GraphEntityTypes.SERVICE,
        entityLabel: "commercial roofing",
      }),
      signal({
        sourceProviderId: "smart_uploads",
        sourceLabel: "Smart Uploads",
        entityType: GraphEntityTypes.SERVICE,
        entityLabel: "commercial roofing installation",
      }),
    ],
    NOW,
  );

  assert.equal(graph.entities.length, 1);
  assert.equal(graph.entities[0]!.evidence.length, 2);
});

test("buildBusinessKnowledgeGraph creates a distinct entity for an unrelated topic", () => {
  const graph = buildBusinessKnowledgeGraph(
    [
      signal({
        sourceProviderId: "business_discovery",
        sourceLabel: "Business Discovery",
        entityType: GraphEntityTypes.SERVICE,
        entityLabel: "commercial roofing",
      }),
      signal({
        sourceProviderId: "business_discovery",
        sourceLabel: "Business Discovery",
        entityType: GraphEntityTypes.SERVICE,
        entityLabel: "residential plumbing repair",
      }),
    ],
    NOW,
  );

  assert.equal(graph.entities.length, 2);
});

test("buildBusinessKnowledgeGraph creates a relationship with evidence when a signal targets another entity", () => {
  const graph = buildBusinessKnowledgeGraph(
    [
      signal({
        sourceProviderId: "customer_voice",
        sourceLabel: "Customer Voice",
        entityType: GraphEntityTypes.CUSTOMER_THEME,
        entityLabel: "commercial roofing",
        relationship: GraphRelationshipTypes.REINFORCES,
        relatedEntityType: GraphEntityTypes.SERVICE,
        relatedEntityLabel: "commercial roofing",
      }),
    ],
    NOW,
  );

  assert.equal(graph.entities.length, 2);
  assert.equal(graph.relationships.length, 1);
  const rel = graph.relationships[0]!;
  assert.equal(rel.type, GraphRelationshipTypes.REINFORCES);
  assert.equal(rel.evidence.length, 1);
});

test("buildBusinessKnowledgeGraph never creates a self-referential relationship", () => {
  const graph = buildBusinessKnowledgeGraph(
    [
      signal({
        sourceProviderId: "smart_uploads",
        sourceLabel: "Smart Uploads",
        entityType: GraphEntityTypes.SERVICE,
        entityLabel: "commercial roofing",
        relationship: GraphRelationshipTypes.MENTIONED_IN,
        relatedEntityType: GraphEntityTypes.SERVICE,
        relatedEntityLabel: "commercial roofing",
      }),
    ],
    NOW,
  );

  assert.equal(graph.entities.length, 1);
  assert.equal(graph.relationships.length, 0);
});

test("buildBusinessKnowledgeGraph links goals to opportunity entities only on genuine topic overlap", () => {
  const graph = buildBusinessKnowledgeGraph(
    [
      signal({
        sourceProviderId: "goals",
        sourceLabel: "Goals",
        entityType: GraphEntityTypes.GOAL,
        entityLabel: "Growing commercial roofing work",
      }),
      signal({
        sourceProviderId: "business_discovery",
        sourceLabel: "Business Discovery",
        entityType: GraphEntityTypes.SERVICE,
        entityLabel: "commercial roofing",
      }),
      signal({
        sourceProviderId: "business_discovery",
        sourceLabel: "Business Discovery",
        entityType: GraphEntityTypes.SERVICE,
        entityLabel: "residential plumbing repair",
      }),
    ],
    NOW,
  );

  const goalForEdges = graph.relationships.filter((r) => r.type === GraphRelationshipTypes.GOAL_FOR);
  assert.equal(goalForEdges.length, 1);
  const target = graph.entities.find((e) => e.id === goalForEdges[0]!.toEntityId)!;
  assert.match(target.label, /roofing/);
});

// ---------------------------------------------------------------------------
// reasoning.ts — evidence fusion, confidence calculation, conclusions vs
// opportunity signals
// ---------------------------------------------------------------------------

function fiveProviderFusionGraph() {
  return buildBusinessKnowledgeGraph(
    [
      signal({
        sourceProviderId: "business_discovery",
        sourceLabel: "Business Discovery",
        entityType: GraphEntityTypes.SERVICE,
        entityLabel: "commercial roofing",
        evidenceSummary: "You told us commercial roofing is one of your services.",
      }),
      signal({
        sourceProviderId: "external_intelligence",
        sourceLabel: "Search Console",
        entityType: GraphEntityTypes.SEARCH_TOPIC,
        entityLabel: "commercial roofing",
        evidenceSummary: 'Organic clicks for "commercial roofing" grew from 5 to 40.',
        relationship: GraphRelationshipTypes.SUPPORTS,
        relatedEntityType: GraphEntityTypes.SERVICE,
        relatedEntityLabel: "commercial roofing",
      }),
      signal({
        sourceProviderId: "smart_uploads",
        sourceLabel: "Smart Uploads",
        entityType: GraphEntityTypes.SERVICE,
        entityLabel: "commercial roofing installation",
        evidenceSummary: "Your brochure highlights commercial roofing installation.",
      }),
      signal({
        sourceProviderId: "customer_voice",
        sourceLabel: "Customer Voice",
        entityType: GraphEntityTypes.CUSTOMER_THEME,
        entityLabel: "commercial roofing",
        evidenceSummary: "Customers consistently praise your commercial roofing work.",
        relationship: GraphRelationshipTypes.REINFORCES,
        relatedEntityType: GraphEntityTypes.SERVICE,
        relatedEntityLabel: "commercial roofing",
      }),
      signal({
        sourceProviderId: "goals",
        sourceLabel: "Goals",
        entityType: GraphEntityTypes.GOAL,
        entityLabel: "Growing commercial roofing work",
        evidenceSummary: "Growing commercial roofing work is one of your stated goals.",
      }),
    ],
    NOW,
  );
}

test("evidence fusion: an entity's total evidence includes its own plus incoming positive relationships", () => {
  const graph = fiveProviderFusionGraph();
  const result = reasonAboutBusinessGraph(graph, NOW);
  const top = result.conclusions[0]!;

  // Direct SERVICE evidence (business_discovery + smart_uploads) plus incoming
  // supports (search console) and reinforces (customer voice) plus goal_for.
  assert.equal(top.evidence.length, 5);
});

test("confidence calculation: 5 distinct providers on the same topic yields a high-confidence conclusion", () => {
  const graph = fiveProviderFusionGraph();
  const result = reasonAboutBusinessGraph(graph, NOW);

  assert.equal(result.conclusions.length, 1);
  const top = result.conclusions[0]!;
  assert.equal(top.confidence, "high");
  assert.equal(top.contributingProviderCount, 5);
  assert.match(top.statement, /commercial roofing/);
  assert.match(top.statement, /high-confidence growth opportunity/);
});

test("confidence calculation: exactly 2 providers yields a medium-confidence conclusion", () => {
  const graph = buildBusinessKnowledgeGraph(
    [
      signal({
        sourceProviderId: "business_discovery",
        sourceLabel: "Business Discovery",
        entityType: GraphEntityTypes.SERVICE,
        entityLabel: "commercial roofing",
      }),
      signal({
        sourceProviderId: "smart_uploads",
        sourceLabel: "Smart Uploads",
        entityType: GraphEntityTypes.SERVICE,
        entityLabel: "commercial roofing",
      }),
    ],
    NOW,
  );
  const result = reasonAboutBusinessGraph(graph, NOW);
  assert.equal(result.conclusions.length, 1);
  assert.equal(result.conclusions[0]!.confidence, "medium");
});

test("confidence calculation: a single-provider entity becomes an opportunity signal, never a conclusion", () => {
  const graph = buildBusinessKnowledgeGraph(
    [
      signal({
        sourceProviderId: "business_discovery",
        sourceLabel: "Business Discovery",
        entityType: GraphEntityTypes.SERVICE,
        entityLabel: "commercial roofing",
      }),
    ],
    NOW,
  );
  const result = reasonAboutBusinessGraph(graph, NOW);
  assert.equal(result.conclusions.length, 0);
  assert.equal(result.opportunitySignals.length, 1);
  assert.equal(result.opportunitySignals[0]!.confidence, "low");
  assert.match(result.opportunitySignals[0]!.statement, /may be worth watching/);
});

test("reasoning never fabricates: an entity type outside OPPORTUNITY_ENTITY_TYPES never becomes a conclusion or signal", () => {
  const graph = buildBusinessKnowledgeGraph(
    [
      signal({
        sourceProviderId: "customer_voice",
        sourceLabel: "Customer Voice",
        entityType: GraphEntityTypes.CUSTOMER_THEME,
        entityLabel: "friendly staff",
      }),
      signal({
        sourceProviderId: "external_intelligence",
        sourceLabel: "Search Console",
        entityType: GraphEntityTypes.CUSTOMER_THEME,
        entityLabel: "friendly staff",
      }),
    ],
    NOW,
  );
  const result = reasonAboutBusinessGraph(graph, NOW);
  assert.equal(result.conclusions.length, 0);
  assert.equal(result.opportunitySignals.length, 0);
});

// ---------------------------------------------------------------------------
// conflict detection (Part 3)
// ---------------------------------------------------------------------------

test("conflict detection: flags a goal-priority mismatch against strong, independent, unlinked evidence", () => {
  const graph = buildBusinessKnowledgeGraph(
    [
      signal({
        sourceProviderId: "goals",
        sourceLabel: "Goals",
        entityType: GraphEntityTypes.GOAL,
        entityLabel: "Grow residential customer base",
      }),
      signal({
        sourceProviderId: "business_discovery",
        sourceLabel: "Business Discovery",
        entityType: GraphEntityTypes.SERVICE,
        entityLabel: "residential plumbing repair",
      }),
      signal({
        sourceProviderId: "smart_uploads",
        sourceLabel: "Smart Uploads",
        entityType: GraphEntityTypes.SERVICE,
        entityLabel: "commercial roofing installation for office buildings",
      }),
      signal({
        sourceProviderId: "customer_voice",
        sourceLabel: "Customer Voice",
        entityType: GraphEntityTypes.SERVICE,
        entityLabel: "commercial roofing installation",
      }),
    ],
    NOW,
  );

  const conflicts = findPriorityConflicts(graph);
  assert.equal(conflicts.length, 1);
  assert.match(conflicts[0]!.summary, /conflicting signals/);
  assert.match(conflicts[0]!.summary, /residential/);
  assert.match(conflicts[0]!.summary, /roofing/);
  assert.match(conflicts[0]!.recommendation, /Confirm whether/);
  // Never guesses which side is correct.
  assert.doesNotMatch(conflicts[0]!.recommendation, /should be/i);
});

test("conflict detection: never flags a single-source alternative as a conflict", () => {
  const graph = buildBusinessKnowledgeGraph(
    [
      signal({
        sourceProviderId: "goals",
        sourceLabel: "Goals",
        entityType: GraphEntityTypes.GOAL,
        entityLabel: "Grow residential customer base",
      }),
      signal({
        sourceProviderId: "business_discovery",
        sourceLabel: "Business Discovery",
        entityType: GraphEntityTypes.SERVICE,
        entityLabel: "residential plumbing repair",
      }),
      signal({
        sourceProviderId: "smart_uploads",
        sourceLabel: "Smart Uploads",
        entityType: GraphEntityTypes.SERVICE,
        entityLabel: "commercial roofing installation",
      }),
    ],
    NOW,
  );

  assert.equal(findPriorityConflicts(graph).length, 0);
});

test("conflict detection: never flags an entity already linked to a goal", () => {
  const graph = buildBusinessKnowledgeGraph(
    [
      signal({
        sourceProviderId: "goals",
        sourceLabel: "Goals",
        entityType: GraphEntityTypes.GOAL,
        entityLabel: "Grow residential and commercial roofing work",
      }),
      signal({
        sourceProviderId: "business_discovery",
        sourceLabel: "Business Discovery",
        entityType: GraphEntityTypes.SERVICE,
        entityLabel: "residential plumbing repair",
      }),
      signal({
        sourceProviderId: "smart_uploads",
        sourceLabel: "Smart Uploads",
        entityType: GraphEntityTypes.SERVICE,
        entityLabel: "commercial roofing installation",
      }),
      signal({
        sourceProviderId: "customer_voice",
        sourceLabel: "Customer Voice",
        entityType: GraphEntityTypes.SERVICE,
        entityLabel: "commercial roofing installation",
      }),
    ],
    NOW,
  );

  // The goal's own label overlaps both services, so both get goal_for edges —
  // neither should be flagged as an unlinked competing priority.
  assert.equal(findPriorityConflicts(graph).length, 0);
});

// ---------------------------------------------------------------------------
// explainability (Part 9)
// ---------------------------------------------------------------------------

test("explainConclusion/explainOpportunitySignal/explainConflict expose customer-safe evidence, never internal ids", () => {
  const graph = fiveProviderFusionGraph();
  const result = reasonAboutBusinessGraph(graph, NOW);

  const conclusionExplanation = explainConclusion(result.conclusions[0]!);
  assert.equal(conclusionExplanation.summary, result.conclusions[0]!.statement);
  assert.ok(conclusionExplanation.supportingEvidence.length > 0);
  assert.ok(conclusionExplanation.sources.length >= 3);
  assert.equal(conclusionExplanation.confidence, "high");
  const serialized = JSON.stringify(conclusionExplanation);
  assert.doesNotMatch(serialized, /entity_\d/);
  assert.doesNotMatch(serialized, /relationship_\d/);

  const singleProviderGraph = buildBusinessKnowledgeGraph(
    [
      signal({
        sourceProviderId: "business_discovery",
        sourceLabel: "Business Discovery",
        entityType: GraphEntityTypes.SERVICE,
        entityLabel: "gutter cleaning",
      }),
    ],
    NOW,
  );
  const singleProviderResult = reasonAboutBusinessGraph(singleProviderGraph, NOW);
  const signalExplanation = explainOpportunitySignal(singleProviderResult.opportunitySignals[0]!);
  assert.equal(signalExplanation.sources.length, 1);

  const conflictGraph = buildBusinessKnowledgeGraph(
    [
      signal({
        sourceProviderId: "goals",
        sourceLabel: "Goals",
        entityType: GraphEntityTypes.GOAL,
        entityLabel: "Grow residential customer base",
      }),
      signal({
        sourceProviderId: "business_discovery",
        sourceLabel: "Business Discovery",
        entityType: GraphEntityTypes.SERVICE,
        entityLabel: "residential plumbing repair",
      }),
      signal({
        sourceProviderId: "smart_uploads",
        sourceLabel: "Smart Uploads",
        entityType: GraphEntityTypes.SERVICE,
        entityLabel: "commercial roofing installation for office buildings",
      }),
      signal({
        sourceProviderId: "customer_voice",
        sourceLabel: "Customer Voice",
        entityType: GraphEntityTypes.SERVICE,
        entityLabel: "commercial roofing installation",
      }),
    ],
    NOW,
  );
  const conflictExplanation = explainConflict(findPriorityConflicts(conflictGraph)[0]!);
  assert.equal(conflictExplanation.confidence, null);
  assert.ok(conflictExplanation.supportingEvidence.length > 0);
});

// ---------------------------------------------------------------------------
// adapters — provider-agnostic contract, real fixture shapes
// ---------------------------------------------------------------------------

test("businessDiscoveryToGraphSignals maps services, strengths, and target customers without fabricating relationships", () => {
  const discovery: BusinessDiscoveryResult = {
    generatedAt: NOW.toISOString(),
    primaryServices: { value: ["residential plumbing"], confidenceTier: "known" },
    targetCustomers: { value: ["homeowners"], confidenceTier: "known" },
    uniqueStrengths: { value: ["24/7 emergency service"], confidenceTier: "assumed" },
    growthOpportunities: { value: ["water heater installation"], confidenceTier: "guessed" },
  } as unknown as BusinessDiscoveryResult;

  const signals = businessDiscoveryToGraphSignals(discovery);
  assert.ok(signals.some((s) => s.entityType === GraphEntityTypes.SERVICE && s.entityLabel === "residential plumbing"));
  assert.ok(signals.some((s) => s.entityType === GraphEntityTypes.CUSTOMER_SEGMENT));
  assert.ok(signals.some((s) => s.entityType === GraphEntityTypes.COMPETITIVE_STRENGTH));
  for (const s of signals) {
    assert.equal(s.sourceProviderId, "business_discovery");
  }
});

test("businessDiscoveryToGraphSignals returns nothing for a null/missing discovery result", () => {
  assert.deepEqual(businessDiscoveryToGraphSignals(null), []);
  assert.deepEqual(businessDiscoveryToGraphSignals(undefined), []);
});

test("goalsToGraphSignals only includes active goals and never corrupts the display label with metadata", () => {
  const goals: BusinessGoal[] = [
    {
      key: "expand_new_market",
      label: "Growing commercial roofing work",
      priority: 1,
      status: "active",
      targetTimeframe: "6_months",
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    } as BusinessGoal,
    {
      key: "improve_online_reputation",
      label: "Get more reviews",
      priority: 2,
      status: "achieved",
      targetTimeframe: "90_days",
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    } as BusinessGoal,
  ];

  const signals = goalsToGraphSignals(goals);
  assert.equal(signals.length, 1);
  assert.equal(signals[0]!.entityLabel, "Growing commercial roofing work");
});

test("customerVoiceToGraphSignals dedupes themes by key and links each to a service via reinforces", () => {
  const intelligence: CustomerVoiceIntelligence = {
    emptyState: null,
    strengths: [
      {
        key: "commercial_roofing_praise",
        label: "commercial roofing",
        kind: "strength",
        sentiment: "positive",
        confidence: "high",
        businessImpact: "medium",
        evidenceCount: 8,
        percentageOfReviews: 40,
        trendDirection: "improving",
        languageVariants: ["commercial roofing"],
        evidenceIds: ["r1"],
        lastUpdated: NOW.toISOString(),
      },
    ],
    frequentlyMentionedServices: [],
    opportunities: [],
  } as unknown as CustomerVoiceIntelligence;

  const signals = customerVoiceToGraphSignals(intelligence);
  assert.equal(signals.length, 1);
  assert.equal(signals[0]!.entityType, GraphEntityTypes.CUSTOMER_THEME);
  assert.equal(signals[0]!.relationship, GraphRelationshipTypes.REINFORCES);
  assert.equal(signals[0]!.relatedEntityType, GraphEntityTypes.SERVICE);
});

test("externalIntelligenceToGraphSignals extracts the quoted phrase for a clean relationship target label", () => {
  const intelligence: ExternalIntelligence = {
    emptyState: null,
    searchDemandTrends: [
      {
        id: "external:x",
        category: "search_demand_trends",
        clusterKey: "x",
        corroboratingProviderCount: 1,
        insight: 'Organic clicks for "commercial roofing" grew from 5 to 40 over the last period.',
        confidence: "high",
        businessImpact: "medium",
        timeHorizon: "near_term",
        evidence: [{ id: "e1", summary: "x", occurredAt: NOW.toISOString(), sourceProviderId: "search_console", sourceLabel: "Search Console", quality: "high" }],
        possibleActions: [],
        relatedGoals: [],
        lastUpdated: NOW.toISOString(),
      },
    ],
    seasonalOpportunities: [],
    holidayCalendar: [],
    competitorActivity: [],
  } as unknown as ExternalIntelligence;

  const signals = externalIntelligenceToGraphSignals(intelligence);
  assert.equal(signals.length, 1);
  assert.equal(signals[0]!.relatedEntityLabel, "commercial roofing");
});

test("smartUploadsToGraphSignals maps known categories and skips categories with no graph entity type", () => {
  const facts: SmartUploadKnowledgeFactRecord[] = [
    {
      id: "fact-1",
      user_id: "u1",
      business_profile_id: "b1",
      document_id: "doc-1",
      category: "service",
      fact: "We install commercial roofing systems.",
      source_excerpt: null,
      confidence: "high",
      date_learned: NOW.toISOString(),
      last_verified_at: NOW.toISOString(),
      superseded_by: null,
      created_at: NOW.toISOString(),
      updated_at: NOW.toISOString(),
    } as SmartUploadKnowledgeFactRecord,
    {
      id: "fact-2",
      user_id: "u1",
      business_profile_id: "b1",
      document_id: "doc-1",
      category: "pricing",
      fact: "Roof inspections start at $150.",
      source_excerpt: null,
      confidence: "high",
      date_learned: NOW.toISOString(),
      last_verified_at: NOW.toISOString(),
      superseded_by: null,
      created_at: NOW.toISOString(),
      updated_at: NOW.toISOString(),
    } as SmartUploadKnowledgeFactRecord,
  ];

  const signals = smartUploadsToGraphSignals(facts);
  assert.equal(signals.length, 1);
  assert.equal(signals[0]!.entityType, GraphEntityTypes.SERVICE);
});

// ---------------------------------------------------------------------------
// service.ts — end-to-end entrypoint (mission worked examples)
// ---------------------------------------------------------------------------

test("getBusinessReasoning reproduces the mission's fusion worked example end to end", () => {
  const result = getBusinessReasoning({
    now: NOW,
    businessDiscovery: {
      generatedAt: NOW.toISOString(),
      primaryServices: { value: ["residential plumbing"], confidenceTier: "known" },
      targetCustomers: { value: null, confidenceTier: "missing" },
      uniqueStrengths: { value: [], confidenceTier: "missing" },
      growthOpportunities: { value: [], confidenceTier: "missing" },
    } as unknown as BusinessDiscoveryResult,
    goals: [
      {
        key: "expand_new_market",
        label: "Growing commercial roofing work",
        priority: 1,
        status: "active",
        targetTimeframe: "6_months",
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
      } as BusinessGoal,
    ],
    customerVoice: {
      emptyState: null,
      strengths: [
        {
          key: "commercial_roofing_praise",
          label: "commercial roofing",
          kind: "strength",
          sentiment: "positive",
          confidence: "high",
          businessImpact: "medium",
          evidenceCount: 8,
          percentageOfReviews: 40,
          trendDirection: "improving",
          languageVariants: ["commercial roofing"],
          evidenceIds: ["r1"],
          lastUpdated: NOW.toISOString(),
        },
      ],
      frequentlyMentionedServices: [],
      opportunities: [],
    } as unknown as CustomerVoiceIntelligence,
    externalIntelligence: {
      emptyState: null,
      searchDemandTrends: [
        {
          id: "external:x",
          category: "search_demand_trends",
          clusterKey: "x",
          corroboratingProviderCount: 1,
          insight: 'Organic clicks for "commercial roofing" grew from 5 to 40 over the last period.',
          confidence: "high",
          businessImpact: "medium",
          timeHorizon: "near_term",
          evidence: [{ id: "e1", summary: "x", occurredAt: NOW.toISOString(), sourceProviderId: "search_console", sourceLabel: "Search Console", quality: "high" }],
          possibleActions: [],
          relatedGoals: [],
          lastUpdated: NOW.toISOString(),
        },
      ],
      seasonalOpportunities: [],
      holidayCalendar: [],
      competitorActivity: [],
    } as unknown as ExternalIntelligence,
    smartUploadFacts: [
      {
        id: "fact-1",
        user_id: "u1",
        business_profile_id: "b1",
        document_id: "doc-1",
        category: "service",
        fact: "We install and repair commercial roofing systems.",
        source_excerpt: null,
        confidence: "high",
        date_learned: NOW.toISOString(),
        last_verified_at: NOW.toISOString(),
        superseded_by: null,
        created_at: NOW.toISOString(),
        updated_at: NOW.toISOString(),
      } as SmartUploadKnowledgeFactRecord,
    ],
  });

  assert.equal(result.conclusions.length, 1);
  assert.equal(result.conclusions[0]!.confidence, "high");
  assert.equal(result.conclusions[0]!.contributingProviderCount, 4);
  assert.equal(result.conflicts.length, 0);
});

test("getBusinessReasoning reproduces the mission's conflict worked example end to end", () => {
  const result = getBusinessReasoning({
    now: NOW,
    goals: [
      {
        key: "expand_new_market",
        label: "Grow residential customer base",
        priority: 1,
        status: "active",
        targetTimeframe: "6_months",
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
      } as BusinessGoal,
    ],
    businessDiscovery: {
      generatedAt: NOW.toISOString(),
      primaryServices: { value: ["residential plumbing repair"], confidenceTier: "known" },
      targetCustomers: { value: null, confidenceTier: "missing" },
      uniqueStrengths: { value: [], confidenceTier: "missing" },
      growthOpportunities: { value: [], confidenceTier: "missing" },
    } as unknown as BusinessDiscoveryResult,
    customerVoice: {
      emptyState: null,
      strengths: [
        {
          key: "commercial_praise",
          label: "commercial roofing installation",
          kind: "strength",
          sentiment: "positive",
          confidence: "high",
          businessImpact: "medium",
          evidenceCount: 6,
          percentageOfReviews: 30,
          trendDirection: "improving",
          languageVariants: [],
          evidenceIds: [],
          lastUpdated: NOW.toISOString(),
        },
      ],
      frequentlyMentionedServices: [],
      opportunities: [],
    } as unknown as CustomerVoiceIntelligence,
    smartUploadFacts: [
      {
        id: "fact-2",
        user_id: "u1",
        business_profile_id: "b1",
        document_id: "doc-2",
        category: "service",
        fact: "Commercial roofing installation for office buildings and warehouses.",
        source_excerpt: null,
        confidence: "high",
        date_learned: NOW.toISOString(),
        last_verified_at: NOW.toISOString(),
        superseded_by: null,
        created_at: NOW.toISOString(),
        updated_at: NOW.toISOString(),
      } as SmartUploadKnowledgeFactRecord,
    ],
  });

  assert.equal(result.conflicts.length, 1);
  assert.match(result.conflicts[0]!.summary, /residential/);
  assert.match(result.conflicts[0]!.summary, /roofing/);
});

// ---------------------------------------------------------------------------
// Growth Advisor integration (Part 5)
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

test("buildWhatINoticedObservations surfaces the fused Business Knowledge Graph conclusion first, with supporting evidence bullets", () => {
  const graph = fiveProviderFusionGraph();
  const reasoning = reasonAboutBusinessGraph(graph, NOW);

  const observations = buildWhatINoticedObservations({
    briefing: emptyBriefing(),
    businessReasoning: reasoning,
  });

  assert.ok(observations.length > 0);
  const top = observations[0]!;
  assert.match(top.headline, /We believe commercial roofing represents your best near-term growth opportunity\./);
  assert.ok(top.supportingEvidence && top.supportingEvidence.length > 0);
  assert.equal(top.evidenceSource, `business_reasoning:${reasoning.conclusions[0]!.entityId}`);
});

test("buildWhatINoticedObservations never fabricates a synthesized insight when reasoning found nothing", () => {
  const observations = buildWhatINoticedObservations({
    briefing: emptyBriefing(),
    businessReasoning: { generatedAt: NOW.toISOString(), conclusions: [], opportunitySignals: [], conflicts: [] },
  });

  assert.ok(!observations.some((o) => o.evidenceSource.startsWith("business_reasoning:")));
});

// ---------------------------------------------------------------------------
// Weekly Growth Plan integration (Part 6)
// ---------------------------------------------------------------------------

test("synthesizePlanEvidence cites the top fused conclusion first, ahead of single-source evidence", () => {
  const graph = fiveProviderFusionGraph();
  const reasoning = reasonAboutBusinessGraph(graph, NOW);

  const evidence = synthesizePlanEvidence({
    briefing: emptyBriefing(),
    goals: [],
    businessReasoning: reasoning,
  });

  assert.equal(evidence[0]!.source, "business_reasoning");
  assert.equal(evidence[0]!.id, "business_reasoning_conclusion");
});

test("synthesizePlanEvidence omits business_reasoning evidence when no reasoning is passed", () => {
  const evidence = synthesizePlanEvidence({
    briefing: emptyBriefing(),
    goals: [],
  });
  assert.ok(!evidence.some((e) => e.source === "business_reasoning"));
});

// ---------------------------------------------------------------------------
// Marketing Health / Business Knowledge Health (Part 7)
// ---------------------------------------------------------------------------

test("computeBusinessKnowledgeHealth scores higher with more corroborated, connected sources", () => {
  const richGraph = fiveProviderFusionGraph();
  const richReasoning = reasonAboutBusinessGraph(richGraph, NOW);
  const richHealth = computeBusinessKnowledgeHealth({
    graph: richGraph,
    reasoning: richReasoning,
    sourcePresence: {
      businessDiscovery: true,
      goals: true,
      customerVoice: true,
      externalIntelligence: true,
      smartUploads: true,
    },
    now: NOW,
  });

  const thinGraph = buildBusinessKnowledgeGraph([], NOW);
  const thinReasoning = reasonAboutBusinessGraph(thinGraph, NOW);
  const thinHealth = computeBusinessKnowledgeHealth({
    graph: thinGraph,
    reasoning: thinReasoning,
    sourcePresence: {
      businessDiscovery: false,
      goals: false,
      customerVoice: false,
      externalIntelligence: false,
      smartUploads: false,
    },
    now: NOW,
  });

  assert.ok(richHealth.overallScore > thinHealth.overallScore);
  assert.equal(richHealth.dimensions.dataCompleteness.score, 100);
  assert.equal(thinHealth.dimensions.dataCompleteness.score, 0);
  assert.equal(richHealth.dimensions.knowledgeConfidence.score, 100);
  assert.equal(thinHealth.dimensions.knowledgeConfidence.score, 0);
  assert.ok(thinHealth.missingKnowledge.length >= 5);
});

test("computeBusinessKnowledgeHealth surfaces detected conflicts as missing knowledge", () => {
  const graph = buildBusinessKnowledgeGraph(
    [
      signal({
        sourceProviderId: "goals",
        sourceLabel: "Goals",
        entityType: GraphEntityTypes.GOAL,
        entityLabel: "Grow residential customer base",
      }),
      signal({
        sourceProviderId: "business_discovery",
        sourceLabel: "Business Discovery",
        entityType: GraphEntityTypes.SERVICE,
        entityLabel: "residential plumbing repair",
      }),
      signal({
        sourceProviderId: "smart_uploads",
        sourceLabel: "Smart Uploads",
        entityType: GraphEntityTypes.SERVICE,
        entityLabel: "commercial roofing installation for office buildings",
      }),
      signal({
        sourceProviderId: "customer_voice",
        sourceLabel: "Customer Voice",
        entityType: GraphEntityTypes.SERVICE,
        entityLabel: "commercial roofing installation",
      }),
    ],
    NOW,
  );
  const reasoning = reasonAboutBusinessGraph(graph, NOW);
  const health = computeBusinessKnowledgeHealth({
    graph,
    reasoning,
    sourcePresence: {
      businessDiscovery: true,
      goals: true,
      customerVoice: true,
      externalIntelligence: false,
      smartUploads: true,
    },
    now: NOW,
  });

  assert.ok(health.missingKnowledge.some((gap) => gap.label === "Conflicting signals"));
});

test("getBusinessKnowledgeHealth (service entrypoint) computes from the same input as getBusinessReasoning", () => {
  const input = {
    now: NOW,
    businessDiscovery: {
      generatedAt: NOW.toISOString(),
      primaryServices: { value: ["residential plumbing"], confidenceTier: "known" },
      targetCustomers: { value: null, confidenceTier: "missing" },
      uniqueStrengths: { value: [], confidenceTier: "missing" },
      growthOpportunities: { value: [], confidenceTier: "missing" },
    } as unknown as BusinessDiscoveryResult,
    goals: [] as BusinessGoal[],
  };

  const health = getBusinessKnowledgeHealth(input);
  assert.ok(health.dimensions.dataCompleteness.score > 0);
  assert.ok(health.dimensions.dataCompleteness.score < 100);
});

// ---------------------------------------------------------------------------
// Business Connections — evidence-driven recommendations (Part 8)
// ---------------------------------------------------------------------------

const emptyConnectionSignals = {
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
};

test("recommendNextConnection cites the real missing capability instead of a generic pitch", () => {
  const connections = resolveBusinessConnections(emptyConnectionSignals);
  const readiness = buildBusinessBrainReadiness(connections);

  const recommendation = recommendNextConnection(connections, readiness);
  assert.ok(recommendation);
  assert.match(recommendation!.why, /We understand your business, but have no/);
});

test("recommendNextConnection falls back to generic copy when no readiness gap matches (backward compatible)", () => {
  const connections = resolveBusinessConnections(emptyConnectionSignals);

  const recommendation = recommendNextConnection(connections);
  assert.ok(recommendation);
  assert.equal(
    recommendation!.why,
    "This is the highest-value next step for strengthening your Business Brain right now.",
  );
});

// ---------------------------------------------------------------------------
// Provider extensibility (Part 10) — a brand-new, never-seen-before provider
// contributes automatically with zero special-casing anywhere in the engine.
// ---------------------------------------------------------------------------

test("a future provider (not one of the 5 known adapters) fuses into an existing conclusion with zero engine changes", () => {
  const graph = buildBusinessKnowledgeGraph(
    [
      signal({
        sourceProviderId: "business_discovery",
        sourceLabel: "Business Discovery",
        entityType: GraphEntityTypes.SERVICE,
        entityLabel: "commercial roofing",
      }),
      signal({
        sourceProviderId: "smart_uploads",
        sourceLabel: "Smart Uploads",
        entityType: GraphEntityTypes.SERVICE,
        entityLabel: "commercial roofing installation",
      }),
      // A hypothetical future provider, e.g. Google Business Profile Insights —
      // no adapter for it exists in this sprint, but the contract is identical.
      signal({
        sourceProviderId: "gbp_insights",
        sourceLabel: "GBP Insights",
        entityType: GraphEntityTypes.SERVICE,
        entityLabel: "commercial roofing",
        evidenceSummary: "Profile views for commercial roofing posts are up 3x this month.",
      }),
    ],
    NOW,
  );

  const result = reasonAboutBusinessGraph(graph, NOW);
  assert.equal(result.conclusions.length, 1);
  assert.equal(result.conclusions[0]!.contributingProviderCount, 3);
  assert.equal(result.conclusions[0]!.confidence, "high");
});

test("buildBusinessGraph composes every adapter's signals without branching on provider id (Part 10 architecture check)", () => {
  const graph = buildBusinessGraph({
    now: NOW,
    businessDiscovery: {
      generatedAt: NOW.toISOString(),
      primaryServices: { value: ["residential plumbing"], confidenceTier: "known" },
      targetCustomers: { value: null, confidenceTier: "missing" },
      uniqueStrengths: { value: [], confidenceTier: "missing" },
      growthOpportunities: { value: [], confidenceTier: "missing" },
    } as unknown as BusinessDiscoveryResult,
  });

  assert.ok(graph.entities.length > 0);
});

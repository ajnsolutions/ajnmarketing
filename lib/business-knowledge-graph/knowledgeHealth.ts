/**
 * Business Knowledge Health — seven additive dimensions describing how well
 * the Business Brain understands this business, computed purely from the
 * graph and reasoning outputs already built this request (Part 7 of the
 * Business Knowledge Graph sprint; `customerUnderstanding` added by the
 * Website Testimonials sprint). This is a new, additive signal — it does
 * not replace or touch the three existing, independent "Marketing Health"
 * implementations (command-center score, Head of Marketing state, Customer
 * Voice health); those are unchanged.
 *
 * Never a second decision engine: nothing here re-ranks or recommends —
 * it only describes evidence coverage and confidence for display.
 */

import {
  GraphEntityTypes,
  OPPORTUNITY_ENTITY_TYPES,
  type BusinessKnowledgeGraph,
  type ConfidenceLevel,
} from "@/lib/business-knowledge-graph/types";
import type { BusinessReasoningResult } from "@/lib/business-knowledge-graph/reasoning";

const ALL_ENTITY_TYPES = Object.values(GraphEntityTypes);

export type KnowledgeHealthLevel = "strong" | "developing" | "limited";

export type KnowledgeHealthDimension = {
  /** 0-100. */
  score: number;
  level: KnowledgeHealthLevel;
  /** Customer-safe explanation — never internal graph mechanics. */
  detail: string;
};

export type KnowledgeHealthGap = {
  label: string;
  detail: string;
};

export type BusinessKnowledgeHealth = {
  generatedAt: string;
  overallScore: number;
  dimensions: {
    businessUnderstanding: KnowledgeHealthDimension;
    evidenceCoverage: KnowledgeHealthDimension;
    knowledgeConfidence: KnowledgeHealthDimension;
    recommendationConfidence: KnowledgeHealthDimension;
    dataCompleteness: KnowledgeHealthDimension;
    crossSourceAlignment: KnowledgeHealthDimension;
    customerUnderstanding: KnowledgeHealthDimension;
  };
  /** What's missing, in priority order — feeds Business Connections. */
  missingKnowledge: KnowledgeHealthGap[];
};

/** Which Business Brain sources contributed at least one signal — used for
 * Data Completeness. Presence is measured by whether the source produced
 * any graph signal, not by connection status (a connected-but-empty source
 * is honestly "not yet contributing"). */
export type KnowledgeSourcePresence = {
  businessDiscovery: boolean;
  goals: boolean;
  customerVoice: boolean;
  externalIntelligence: boolean;
  smartUploads: boolean;
  /** Website Testimonials specifically — a second, distinct Customer Voice
   * provider alongside Google Reviews (see customerVoice above, which is
   * true whenever *any* Customer Voice provider contributed). */
  testimonials: boolean;
};

function levelFromScore(score: number): KnowledgeHealthLevel {
  if (score >= 70) return "strong";
  if (score >= 35) return "developing";
  return "limited";
}

function dimension(score: number, detail: string): KnowledgeHealthDimension {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  return { score: clamped, level: levelFromScore(clamped), detail };
}

const CONFIDENCE_SCORE: Record<ConfidenceLevel, number> = {
  high: 100,
  medium: 60,
  low: 30,
};

function businessUnderstanding(graph: BusinessKnowledgeGraph): KnowledgeHealthDimension {
  const typesPresent = new Set(graph.entities.map((e) => e.type));
  const score = (typesPresent.size / ALL_ENTITY_TYPES.length) * 100;
  const detail =
    typesPresent.size === 0
      ? "We don't understand enough about this business yet to describe it."
      : `We understand ${typesPresent.size} of ${ALL_ENTITY_TYPES.length} aspects of this business (services, customers, markets, and more).`;
  return dimension(score, detail);
}

function evidenceCoverage(
  graph: BusinessKnowledgeGraph,
  reasoning: BusinessReasoningResult,
): KnowledgeHealthDimension {
  const opportunityEntityCount = graph.entities.filter((e) =>
    OPPORTUNITY_ENTITY_TYPES.includes(e.type),
  ).length;
  const withEvidence = reasoning.conclusions.length + reasoning.opportunitySignals.length;
  if (opportunityEntityCount === 0) {
    return dimension(0, "No growth opportunities have been identified with evidence yet.");
  }
  const score = (withEvidence / opportunityEntityCount) * 100;
  return dimension(
    score,
    `${withEvidence} of ${opportunityEntityCount} growth opportunities are backed by real evidence.`,
  );
}

function knowledgeConfidence(reasoning: BusinessReasoningResult): KnowledgeHealthDimension {
  if (reasoning.conclusions.length === 0) {
    return dimension(0, "Not enough corroborating evidence yet to draw confident conclusions.");
  }
  const average =
    reasoning.conclusions.reduce((sum, c) => sum + CONFIDENCE_SCORE[c.confidence], 0) /
    reasoning.conclusions.length;
  return dimension(
    average,
    `${reasoning.conclusions.length} conclusion${reasoning.conclusions.length === 1 ? "" : "s"} drawn from corroborating evidence.`,
  );
}

function recommendationConfidence(reasoning: BusinessReasoningResult): KnowledgeHealthDimension {
  const top = reasoning.conclusions[0];
  if (!top) {
    return dimension(0, "We don't yet have a well-corroborated growth opportunity to recommend.");
  }
  return dimension(
    CONFIDENCE_SCORE[top.confidence],
    `Our leading recommendation is backed by ${top.contributingProviderCount} independent source${top.contributingProviderCount === 1 ? "" : "s"}.`,
  );
}

function dataCompleteness(presence: KnowledgeSourcePresence): KnowledgeHealthDimension {
  const flags = Object.values(presence);
  const connectedCount = flags.filter(Boolean).length;
  const score = (connectedCount / flags.length) * 100;
  return dimension(
    score,
    `${connectedCount} of ${flags.length} Business Brain sources are contributing knowledge.`,
  );
}

function crossSourceAlignment(reasoning: BusinessReasoningResult): KnowledgeHealthDimension {
  const totalSignals = reasoning.conclusions.length + reasoning.opportunitySignals.length;
  if (totalSignals === 0) {
    return dimension(0, "Not enough signals yet to check whether sources agree.");
  }
  const agreementRatio = reasoning.conclusions.length / totalSignals;
  const conflictPenalty = Math.min(reasoning.conflicts.length * 20, 60);
  const score = agreementRatio * 100 - conflictPenalty;
  const detail =
    reasoning.conflicts.length > 0
      ? `${reasoning.conflicts.length} conflicting signal${reasoning.conflicts.length === 1 ? "" : "s"} found between sources — worth a quick clarification.`
      : "Sources agree with each other — no conflicting signals found.";
  return dimension(score, detail);
}

/**
 * Customer Understanding — rewards both real evidence volume and, distinctly,
 * corroboration from more than one Customer Voice provider (Google Reviews
 * and Website Testimonials reinforcing each other). Never fabricates: a
 * business with zero customer evidence scores 0, plainly explained.
 */
function customerUnderstanding(input: {
  customerVoiceProviderCount: number;
  customerVoiceEvidenceCount: number;
}): KnowledgeHealthDimension {
  if (input.customerVoiceEvidenceCount === 0) {
    return dimension(
      0,
      "We don't have any customer evidence yet — reviews or testimonials would help us understand your customers.",
    );
  }

  const providerScore = Math.min(input.customerVoiceProviderCount, 2) * 50;
  const volumeScore = Math.min(input.customerVoiceEvidenceCount / 10, 1) * 100;
  const score = providerScore * 0.5 + volumeScore * 0.5;

  const detail =
    input.customerVoiceProviderCount >= 2
      ? `Customer understanding is corroborated by ${input.customerVoiceProviderCount} distinct evidence sources (e.g. reviews and testimonials reinforcing each other).`
      : "Customer understanding currently comes from a single evidence source — adding testimonials would give it a second, corroborating perspective.";

  return dimension(score, detail);
}

function buildMissingKnowledge(
  presence: KnowledgeSourcePresence,
  reasoning: BusinessReasoningResult,
): KnowledgeHealthGap[] {
  const gaps: KnowledgeHealthGap[] = [];

  if (!presence.customerVoice) {
    gaps.push({
      label: "Customer sentiment",
      detail: "We understand your business, but have no customer sentiment yet.",
    });
  } else if (!presence.testimonials) {
    gaps.push({
      label: "Website testimonials",
      detail: "We understand your business, but have no website testimonials yet — they'd add a second perspective alongside reviews.",
    });
  }
  if (!presence.externalIntelligence) {
    gaps.push({
      label: "Search & market performance",
      detail: "We understand your business, but have no search performance data yet.",
    });
  }
  if (!presence.smartUploads) {
    gaps.push({
      label: "Uploaded documents",
      detail: "We understand your business, but have no uploaded documents yet.",
    });
  }
  if (!presence.businessDiscovery) {
    gaps.push({
      label: "Business profile",
      detail: "We don't yet have a discovered business profile to reason from.",
    });
  }
  if (!presence.goals) {
    gaps.push({
      label: "Stated goals",
      detail: "No stated goals yet — we can't check whether your growth opportunities match your priorities.",
    });
  }
  for (const conflict of reasoning.conflicts) {
    gaps.push({ label: "Conflicting signals", detail: conflict.summary });
  }

  return gaps;
}

export function computeBusinessKnowledgeHealth(input: {
  graph: BusinessKnowledgeGraph;
  reasoning: BusinessReasoningResult;
  sourcePresence: KnowledgeSourcePresence;
  /** Distinct Customer Voice providers that contributed evidence this run
   * (e.g. Google Reviews + Website Testimonials = 2) and total evidence
   * count — primitives only, never the raw CustomerVoiceIntelligence
   * package, to keep this module decoupled from Customer Voice's shape. */
  customerVoiceProviderCount?: number;
  customerVoiceEvidenceCount?: number;
  now?: Date;
}): BusinessKnowledgeHealth {
  const now = input.now ?? new Date();
  const dimensions = {
    businessUnderstanding: businessUnderstanding(input.graph),
    evidenceCoverage: evidenceCoverage(input.graph, input.reasoning),
    knowledgeConfidence: knowledgeConfidence(input.reasoning),
    recommendationConfidence: recommendationConfidence(input.reasoning),
    dataCompleteness: dataCompleteness(input.sourcePresence),
    crossSourceAlignment: crossSourceAlignment(input.reasoning),
    customerUnderstanding: customerUnderstanding({
      customerVoiceProviderCount: input.customerVoiceProviderCount ?? 0,
      customerVoiceEvidenceCount: input.customerVoiceEvidenceCount ?? 0,
    }),
  };

  const overallScore = Math.round(
    Object.values(dimensions).reduce((sum, d) => sum + d.score, 0) / Object.values(dimensions).length,
  );

  return {
    generatedAt: now.toISOString(),
    overallScore,
    dimensions,
    missingKnowledge: buildMissingKnowledge(input.sourcePresence, input.reasoning),
  };
}

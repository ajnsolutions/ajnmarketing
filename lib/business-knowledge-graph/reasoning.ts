/**
 * The reasoning engine — turns a BusinessKnowledgeGraph into Business
 * Conclusions, Opportunity Signals, and Conflicts. Every output cites the
 * real evidence it was built from; nothing here fabricates a claim no
 * source actually supports (Part 4). This is an evidence layer, not a
 * second decision engine — Marketing Director remains the sole prioritizer
 * of what to actually recommend (see docs/project-magic/BUSINESS_BRAIN.md,
 * docs/project-magic/GROWTH_ADVISOR_EXPERIENCE.md).
 */

import { topicOverlap, TOPIC_UNRELATED_THRESHOLD } from "@/lib/business-knowledge-graph/topicMatch";
import {
  contributingProviders,
  GraphRelationshipTypes,
  OPPORTUNITY_ENTITY_TYPES,
  POSITIVE_RELATIONSHIP_TYPES,
  type BusinessKnowledgeGraph,
  type ConfidenceLevel,
  type GraphEntity,
  type GraphEvidence,
} from "@/lib/business-knowledge-graph/types";

export type BusinessConclusion = {
  id: string;
  entityId: string;
  /** Customer-safe summary of what the graph concludes, e.g. "Commercial roofing is a high-confidence growth opportunity." */
  statement: string;
  /** Deterministic "because:" reasoning built only from real evidence summaries — never an invented take. */
  reasoning: string;
  confidence: ConfidenceLevel;
  evidence: GraphEvidence[];
  contributingProviderCount: number;
  lastUpdated: string;
};

export type OpportunitySignal = {
  id: string;
  entityId: string;
  statement: string;
  confidence: ConfidenceLevel;
  evidence: GraphEvidence[];
  lastUpdated: string;
};

export type BusinessConflict = {
  id: string;
  /** Never a guess at which side is "right" — always framed as a question to resolve. */
  summary: string;
  recommendation: string;
  evidenceForA: GraphEvidence[];
  evidenceForB: GraphEvidence[];
  entityLabelA: string;
  entityLabelB: string;
};

export type BusinessReasoningResult = {
  generatedAt: string;
  conclusions: BusinessConclusion[];
  opportunitySignals: OpportunitySignal[];
  conflicts: BusinessConflict[];
};

function dedupeEvidence(evidence: GraphEvidence[]): GraphEvidence[] {
  const seen = new Map<string, GraphEvidence>();
  for (const item of evidence) {
    if (!seen.has(item.id)) seen.set(item.id, item);
  }
  return [...seen.values()];
}

/** All evidence touching an entity: its own direct evidence, plus evidence
 * from every positive relationship pointing at it (reinforces/supports/
 * expands/goal_for/etc.) — the fusion step from Part 2. */
function gatherEntityEvidence(graph: BusinessKnowledgeGraph, entity: GraphEntity): GraphEvidence[] {
  const incoming = graph.relationships.filter(
    (r) => r.toEntityId === entity.id && POSITIVE_RELATIONSHIP_TYPES.includes(r.type),
  );
  return dedupeEvidence([...entity.evidence, ...incoming.flatMap((r) => r.evidence)]);
}

function confidenceFromProviderCount(count: number): ConfidenceLevel {
  if (count >= 3) return "high";
  if (count === 2) return "medium";
  return "low";
}

function buildReasoningSentence(entityLabel: string, evidence: GraphEvidence[]): string {
  const bullets = evidence
    .slice()
    .sort((a, b) => (b.occurredAt ?? "").localeCompare(a.occurredAt ?? ""))
    .slice(0, 5)
    .map((e) => `${e.summary}`);

  return [`We believe "${entityLabel}" is a high-confidence growth opportunity because:`, ...bullets].join("\n");
}

/**
 * Entities with corroboration from 2+ distinct providers become Business
 * Conclusions (medium/high confidence); single-provider entities become
 * lighter-weight Opportunity Signals ("worth watching," not "we believe").
 */
export function reasonAboutBusinessGraph(
  graph: BusinessKnowledgeGraph,
  now: Date = new Date(),
): BusinessReasoningResult {
  const opportunityEntities = graph.entities.filter((e) => OPPORTUNITY_ENTITY_TYPES.includes(e.type));

  const conclusions: BusinessConclusion[] = [];
  const opportunitySignals: OpportunitySignal[] = [];

  for (const entity of opportunityEntities) {
    const evidence = gatherEntityEvidence(graph, entity);
    const providerCount = contributingProviders(evidence).length;
    const confidence = confidenceFromProviderCount(providerCount);
    const lastUpdated =
      evidence
        .map((e) => e.occurredAt)
        .filter((d): d is string => Boolean(d))
        .sort()
        .at(-1) ?? now.toISOString();

    if (providerCount >= 2) {
      conclusions.push({
        id: `conclusion_${entity.id}`,
        entityId: entity.id,
        statement: `"${entity.label}" is a ${confidence}-confidence growth opportunity.`,
        reasoning: buildReasoningSentence(entity.label, evidence),
        confidence,
        evidence,
        contributingProviderCount: providerCount,
        lastUpdated,
      });
    } else if (evidence.length > 0) {
      opportunitySignals.push({
        id: `opportunity_${entity.id}`,
        entityId: entity.id,
        statement: `"${entity.label}" may be worth watching as a growth opportunity.`,
        confidence: "low",
        evidence,
        lastUpdated,
      });
    }
  }

  conclusions.sort((a, b) => b.contributingProviderCount - a.contributingProviderCount || b.evidence.length - a.evidence.length);

  const conflicts = findPriorityConflicts(graph);

  return {
    generatedAt: now.toISOString(),
    conclusions,
    opportunitySignals,
    conflicts,
  };
}

/**
 * Conflict detection (Part 3): a goal states a priority (goal_for -> entity
 * A), while a *different*, topically unrelated entity B has strong,
 * independent corroboration of its own. Never guesses which side is right —
 * always surfaces the disagreement and recommends clarification.
 */
export function findPriorityConflicts(graph: BusinessKnowledgeGraph): BusinessConflict[] {
  const goalForEdges = graph.relationships.filter((r) => r.type === GraphRelationshipTypes.GOAL_FOR);
  if (goalForEdges.length === 0) return [];

  const opportunityEntities = graph.entities.filter((e) => OPPORTUNITY_ENTITY_TYPES.includes(e.type));
  const conflicts: BusinessConflict[] = [];
  const seenPairs = new Set<string>();

  for (const edge of goalForEdges) {
    const prioritized = graph.entities.find((e) => e.id === edge.toEntityId);
    const goal = graph.entities.find((e) => e.id === edge.fromEntityId);
    if (!prioritized || !goal) continue;

    for (const other of opportunityEntities) {
      if (other.id === prioritized.id || other.type !== prioritized.type) continue;
      if (topicOverlap(prioritized.label, other.label) >= TOPIC_UNRELATED_THRESHOLD) continue;

      const otherEvidence = gatherEntityEvidence(graph, other);
      const otherProviders = contributingProviders(otherEvidence);
      // The alternative must be corroborated by real, independent evidence —
      // never flagged on a single thin signal — and must not itself already
      // be linked to the same (or any) goal, or this isn't really a conflict.
      const otherAlreadyPrioritized = graph.relationships.some(
        (r) => r.type === GraphRelationshipTypes.GOAL_FOR && r.toEntityId === other.id,
      );
      if (otherProviders.length < 2 || otherAlreadyPrioritized) continue;

      const pairKey = [prioritized.id, other.id].sort().join(":");
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);

      conflicts.push({
        id: `conflict_${pairKey}`,
        summary: `We found conflicting signals: "${goal.label}" prioritizes "${prioritized.label}", but evidence from ${otherProviders.length} other source${otherProviders.length === 1 ? "" : "s"} shows real activity around "${other.label}" instead.`,
        recommendation: `Confirm whether "${other.label}" should also be a priority, or whether that evidence reflects work you'd rather not expand.`,
        evidenceForA: gatherEntityEvidence(graph, prioritized),
        evidenceForB: otherEvidence,
        entityLabelA: prioritized.label,
        entityLabelB: other.label,
      });
    }
  }

  return conflicts;
}

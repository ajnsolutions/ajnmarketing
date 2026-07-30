/**
 * Fuses normalized provider signals into a logical graph — entities and
 * relationships, each carrying the evidence that produced them. Pure
 * function — no I/O. Operates only on the common GraphSignalInput contract,
 * never on a provider-specific payload (Part 10: a future provider needs
 * only an adapter that emits this shape; nothing here branches on provider id).
 */

import {
  RELATIONSHIP_TARGET_THRESHOLD,
  TOPIC_MERGE_THRESHOLD,
  topicOverlap,
} from "@/lib/business-knowledge-graph/topicMatch";
import type {
  BusinessKnowledgeGraph,
  GraphEntity,
  GraphEntityType,
  GraphEvidence,
  GraphRelationship,
  GraphRelationshipType,
  GraphSignalInput,
} from "@/lib/business-knowledge-graph/types";
import { GraphEntityTypes, GraphRelationshipTypes, OPPORTUNITY_ENTITY_TYPES } from "@/lib/business-knowledge-graph/types";

function toEvidence(signal: GraphSignalInput, idx: number): GraphEvidence {
  return {
    id: `evidence_${idx}`,
    sourceProviderId: signal.sourceProviderId,
    sourceLabel: signal.sourceLabel,
    summary: signal.evidenceSummary,
    occurredAt: signal.occurredAt,
    confidence: signal.confidence,
  };
}

class GraphBuilder {
  private entities: GraphEntity[] = [];
  private relationships: GraphRelationship[] = [];
  private entityCounter = 0;
  private relationshipCounter = 0;

  findOrCreateEntity(type: GraphEntityType, label: string, evidence: GraphEvidence): GraphEntity {
    const existing = this.entities.find(
      (e) => e.type === type && topicOverlap(e.label, label) >= TOPIC_MERGE_THRESHOLD,
    );

    if (existing) {
      existing.evidence.push(evidence);
      return existing;
    }

    this.entityCounter += 1;
    const created: GraphEntity = {
      id: `entity_${this.entityCounter}`,
      type,
      label,
      evidence: [evidence],
    };
    this.entities.push(created);
    return created;
  }

  /** Weaker match than findOrCreateEntity — for resolving a relationship's
   * target against an entity that may be described very differently (e.g. a
   * full sentence vs. a short label). */
  findRelationshipTarget(type: GraphEntityType, label: string): GraphEntity | null {
    let best: { entity: GraphEntity; overlap: number } | null = null;
    for (const entity of this.entities) {
      if (entity.type !== type) continue;
      const overlap = topicOverlap(entity.label, label);
      if (overlap >= RELATIONSHIP_TARGET_THRESHOLD && (!best || overlap > best.overlap)) {
        best = { entity, overlap };
      }
    }
    return best?.entity ?? null;
  }

  addRelationship(
    type: GraphRelationshipType,
    fromEntityId: string,
    toEntityId: string,
    evidence: GraphEvidence,
  ): void {
    if (fromEntityId === toEntityId) return;

    const existing = this.relationships.find(
      (r) => r.type === type && r.fromEntityId === fromEntityId && r.toEntityId === toEntityId,
    );

    if (existing) {
      existing.evidence.push(evidence);
      return;
    }

    this.relationshipCounter += 1;
    this.relationships.push({
      id: `relationship_${this.relationshipCounter}`,
      type,
      fromEntityId,
      toEntityId,
      evidence: [evidence],
    });
  }

  build(now: Date): BusinessKnowledgeGraph {
    return {
      generatedAt: now.toISOString(),
      entities: this.entities,
      relationships: this.relationships,
    };
  }
}

/**
 * Builds the graph from every provider's already-normalized signals. Goal ->
 * opportunity-entity linking (`goal_for`) is a second pass over the resolved
 * entities, since a goal can only be linked once every entity it might refer
 * to has been created.
 */
export function buildBusinessKnowledgeGraph(
  signals: GraphSignalInput[],
  now: Date = new Date(),
): BusinessKnowledgeGraph {
  const builder = new GraphBuilder();

  signals.forEach((signal, idx) => {
    const evidence = toEvidence(signal, idx);
    const fromEntity = builder.findOrCreateEntity(signal.entityType, signal.entityLabel, evidence);

    if (!signal.relationship || !signal.relatedEntityType || !signal.relatedEntityLabel) return;

    let toEntity = builder.findRelationshipTarget(signal.relatedEntityType, signal.relatedEntityLabel);
    if (!toEntity) {
      toEntity = builder.findOrCreateEntity(signal.relatedEntityType, signal.relatedEntityLabel, evidence);
    }

    builder.addRelationship(signal.relationship, fromEntity.id, toEntity.id, evidence);
  });

  const graph = builder.build(now);

  // Second pass: link goal entities to opportunity-shaped entities they
  // genuinely overlap with — never forced, only when the goal's own label
  // shares real topic overlap with the entity (see adapters/goals.ts).
  const goalEntities = graph.entities.filter((e) => e.type === GraphEntityTypes.GOAL);
  const opportunityEntities = graph.entities.filter((e) => OPPORTUNITY_ENTITY_TYPES.includes(e.type));

  for (const goal of goalEntities) {
    for (const entity of opportunityEntities) {
      if (topicOverlap(goal.label, entity.label) < RELATIONSHIP_TARGET_THRESHOLD) continue;

      const existing = graph.relationships.find(
        (r) => r.type === GraphRelationshipTypes.GOAL_FOR && r.fromEntityId === goal.id && r.toEntityId === entity.id,
      );
      if (existing) continue;

      graph.relationships.push({
        id: `relationship_goal_${goal.id}_${entity.id}`,
        type: GraphRelationshipTypes.GOAL_FOR,
        fromEntityId: goal.id,
        toEntityId: entity.id,
        evidence: [goal.evidence[0]!],
      });
    }
  }

  return graph;
}

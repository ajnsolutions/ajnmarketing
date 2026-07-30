/**
 * Business Knowledge Graph — a logical graph, not a graph database.
 *
 * Normalized entities and relationships built in memory, at request time, from
 * already-computed Business Brain packages (Business Discovery, Goals,
 * Customer Voice, External Intelligence, Smart Uploads). Nothing here is
 * persisted — this is a composition layer over evidence that already exists,
 * matching the Business Brain rule that no feature gets a private data store
 * duplicating what the Business Brain already knows (see
 * docs/project-magic/BUSINESS_BRAIN.md).
 *
 * See docs/project-magic/BUSINESS_KNOWLEDGE_GRAPH.md.
 */

export const GraphEntityTypes = {
  SERVICE: "service",
  PRODUCT: "product",
  INDUSTRY: "industry",
  CUSTOMER_SEGMENT: "customer_segment",
  GEOGRAPHIC_MARKET: "geographic_market",
  GOAL: "goal",
  SEARCH_TOPIC: "search_topic",
  CUSTOMER_THEME: "customer_theme",
  BRAND_VOICE: "brand_voice",
  COMPETITIVE_STRENGTH: "competitive_strength",
  SEASONAL_OPPORTUNITY: "seasonal_opportunity",
  MARKETING_CHANNEL: "marketing_channel",
} as const;

export type GraphEntityType = (typeof GraphEntityTypes)[keyof typeof GraphEntityTypes];

/** Entity types a positive signal can reasonably "grow" or "reinforce" — the
 * subset conclusions/opportunity-signals are computed over. */
export const OPPORTUNITY_ENTITY_TYPES: readonly GraphEntityType[] = [
  GraphEntityTypes.SERVICE,
  GraphEntityTypes.PRODUCT,
  GraphEntityTypes.GEOGRAPHIC_MARKET,
  GraphEntityTypes.SEASONAL_OPPORTUNITY,
];

export const GraphRelationshipTypes = {
  SUPPORTS: "supports",
  REINFORCES: "reinforces",
  CONTRADICTS: "contradicts",
  RELATED_TO: "related_to",
  EXPANDS: "expands",
  COMPETES_WITH: "competes_with",
  MENTIONED_IN: "mentioned_in",
  OBSERVED_BY: "observed_by",
  GOAL_FOR: "goal_for",
  SERVED_BY: "served_by",
} as const;

export type GraphRelationshipType =
  (typeof GraphRelationshipTypes)[keyof typeof GraphRelationshipTypes];

/** Relationship types that count as positive corroboration for an entity
 * (used for opportunity/conclusion confidence — never contradicts/competes_with). */
export const POSITIVE_RELATIONSHIP_TYPES: readonly GraphRelationshipType[] = [
  GraphRelationshipTypes.SUPPORTS,
  GraphRelationshipTypes.REINFORCES,
  GraphRelationshipTypes.EXPANDS,
  GraphRelationshipTypes.GOAL_FOR,
  GraphRelationshipTypes.MENTIONED_IN,
  GraphRelationshipTypes.OBSERVED_BY,
  GraphRelationshipTypes.SERVED_BY,
];

export const ConfidenceLevels = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
} as const;

export type ConfidenceLevel = (typeof ConfidenceLevels)[keyof typeof ConfidenceLevels];

/** One piece of evidence backing an entity, relationship, conclusion, or
 * conflict — always traceable to a real, opaque provider id. Never a raw
 * provider payload; never chain-of-thought. */
export type GraphEvidence = {
  id: string;
  /** Opaque provider id — consumers (including the reasoning engine) must
   * never branch product logic on this; it exists for citation only. */
  sourceProviderId: string;
  sourceLabel: string;
  summary: string;
  occurredAt: string | null;
  confidence: ConfidenceLevel;
};

/**
 * One normalized signal a provider adapter emits — the common contract every
 * adapter (Business Discovery, Goals, Customer Voice, External Intelligence,
 * Smart Uploads, and any future provider) produces. The graph builder and
 * reasoning engine only ever operate on this shape — never on a
 * provider-specific payload — which is what lets a future provider (Part 10)
 * contribute automatically by adding one adapter, with zero branching
 * anywhere else.
 */
export type GraphSignalInput = {
  sourceProviderId: string;
  sourceLabel: string;
  entityType: GraphEntityType;
  /** Free-text label — the graph builder clusters signals into entities by
   * topic overlap, not exact string equality (real text never normalizes
   * identically across providers). */
  entityLabel: string;
  confidence: ConfidenceLevel;
  evidenceSummary: string;
  occurredAt: string | null;
  /** Optional relationship this signal implies toward another entity. */
  relationship?: GraphRelationshipType;
  relatedEntityType?: GraphEntityType;
  relatedEntityLabel?: string;
};

export type GraphEntity = {
  id: string;
  type: GraphEntityType;
  /** Representative label — the first/most common phrasing seen. */
  label: string;
  evidence: GraphEvidence[];
};

export type GraphRelationship = {
  id: string;
  type: GraphRelationshipType;
  fromEntityId: string;
  toEntityId: string;
  evidence: GraphEvidence[];
};

export type BusinessKnowledgeGraph = {
  generatedAt: string;
  entities: GraphEntity[];
  relationships: GraphRelationship[];
};

/** Every distinct sourceProviderId represented anywhere in an entity/edge's evidence. */
export function contributingProviders(evidence: GraphEvidence[]): string[] {
  return [...new Set(evidence.map((e) => e.sourceProviderId))];
}

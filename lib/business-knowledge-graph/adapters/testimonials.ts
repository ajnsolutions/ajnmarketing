/**
 * Testimonial knowledge facts -> graph signals. Pure function — no I/O.
 * Mirrors lib/business-knowledge-graph/adapters/smartUploads.ts: only
 * categories that map cleanly onto a Part 1 entity type produce a graph
 * signal. Every signal cites the real testimonial excerpt it came from —
 * never fabricated — and merges into existing entities via the graph
 * builder's ordinary topic-overlap clustering, which is what lets a second
 * provider (this one) increase confidence on a conclusion Google Reviews or
 * Smart Uploads already support (Part 4: confidence only rises when
 * multiple providers agree).
 */

import type { TestimonialKnowledgeFactRecord } from "@/lib/testimonials/types";
import { GraphEntityTypes, type GraphEntityType, type GraphSignalInput } from "@/lib/business-knowledge-graph/types";

const PROVIDER_ID = "website_testimonials";
const PROVIDER_LABEL = "Website Testimonials";

const CATEGORY_TO_ENTITY_TYPE: Partial<Record<string, GraphEntityType>> = {
  business_strength: GraphEntityTypes.COMPETITIVE_STRENGTH,
  differentiator: GraphEntityTypes.COMPETITIVE_STRENGTH,
  trust_indicator: GraphEntityTypes.COMPETITIVE_STRENGTH,
  customer_segment: GraphEntityTypes.CUSTOMER_SEGMENT,
  industry_terminology: GraphEntityTypes.INDUSTRY,
  customer_benefit: GraphEntityTypes.CUSTOMER_THEME,
  recurring_outcome: GraphEntityTypes.CUSTOMER_THEME,
  objection_overcome: GraphEntityTypes.CUSTOMER_THEME,
  emotional_language: GraphEntityTypes.BRAND_VOICE,
};

export function testimonialKnowledgeToGraphSignals(
  facts: TestimonialKnowledgeFactRecord[] | null | undefined,
): GraphSignalInput[] {
  const active = facts ?? [];
  if (active.length === 0) return [];

  const signals: GraphSignalInput[] = [];

  for (const fact of active) {
    const entityType = CATEGORY_TO_ENTITY_TYPE[fact.category];
    if (!entityType) continue;

    signals.push({
      sourceProviderId: PROVIDER_ID,
      sourceLabel: PROVIDER_LABEL,
      entityType,
      entityLabel: fact.fact,
      confidence: fact.confidence,
      evidenceSummary: fact.source_excerpt ?? fact.fact,
      occurredAt: fact.created_at,
    });
  }

  return signals;
}

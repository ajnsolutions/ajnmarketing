/**
 * Smart Uploads -> graph signals. Pure function — no I/O.
 *
 * Only categories that map cleanly onto a Part 1 entity type produce a graph
 * signal. Categories like pricing/FAQ/terminology/guarantee/etc. are real,
 * useful knowledge (see lib/smart-uploads/), but they aren't graph entities
 * on their own — they stay available to Content Generator and Growth Advisor
 * through the existing Smart Uploads adapters without needing a graph node.
 */

import type { SmartUploadKnowledgeFactRecord } from "@/lib/smart-uploads/types";
import { GraphEntityTypes, type GraphEntityType, type GraphSignalInput } from "@/lib/business-knowledge-graph/types";

const PROVIDER_ID = "smart_uploads";
const PROVIDER_LABEL = "Smart Uploads";

const CATEGORY_TO_ENTITY_TYPE: Partial<Record<string, GraphEntityType>> = {
  product: GraphEntityTypes.PRODUCT,
  service: GraphEntityTypes.SERVICE,
  target_customer: GraphEntityTypes.CUSTOMER_SEGMENT,
  geographic_market: GraphEntityTypes.GEOGRAPHIC_MARKET,
  unique_selling_point: GraphEntityTypes.COMPETITIVE_STRENGTH,
  competitive_advantage: GraphEntityTypes.COMPETITIVE_STRENGTH,
  seasonal_offering: GraphEntityTypes.SEASONAL_OPPORTUNITY,
  industry_served: GraphEntityTypes.INDUSTRY,
  brand_voice: GraphEntityTypes.BRAND_VOICE,
};

export function smartUploadsToGraphSignals(
  facts: SmartUploadKnowledgeFactRecord[] | null | undefined,
): GraphSignalInput[] {
  const active = (facts ?? []).filter((fact) => !fact.superseded_by);
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
      occurredAt: fact.date_learned,
    });
  }

  return signals;
}

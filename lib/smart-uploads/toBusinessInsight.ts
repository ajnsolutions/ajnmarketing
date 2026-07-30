/**
 * Safe adapter: Smart Upload knowledge facts → shared BusinessInsight contract.
 * Mirrors lib/customer-voice/toBusinessInsight.ts — does not change Smart Upload
 * fact storage or introduce a second knowledge representation.
 */

import type { BusinessInsight } from "@/lib/business-brain/insight";
import { BusinessImpactLevels, TimeHorizons } from "@/lib/business-brain/insight";
import {
  KNOWLEDGE_CATEGORY_LABELS,
  type SmartUploadDocumentRecord,
  type SmartUploadKnowledgeFactRecord,
} from "@/lib/smart-uploads/types";

const HIGH_IMPACT_CATEGORIES = new Set([
  "pricing",
  "unique_selling_point",
  "competitive_advantage",
  "guarantee",
]);

function businessImpactForCategory(category: string): (typeof BusinessImpactLevels)[keyof typeof BusinessImpactLevels] {
  return HIGH_IMPACT_CATEGORIES.has(category) ? BusinessImpactLevels.MEDIUM : BusinessImpactLevels.LOW;
}

/**
 * One fact -> one insight, so removing (or superseding) a fact retracts
 * exactly the insight it produced — never a bundled multi-fact summary that
 * would outlive the individual claim it was built from.
 */
export function smartUploadFactToBusinessInsight(
  fact: SmartUploadKnowledgeFactRecord,
  document: Pick<SmartUploadDocumentRecord, "id" | "file_name">,
): BusinessInsight {
  return {
    id: `smart_uploads:${fact.id}`,
    category: `smart_uploads_${fact.category}`,
    insight: fact.fact,
    confidence: fact.confidence,
    businessImpact: businessImpactForCategory(fact.category),
    timeHorizon: fact.category === "seasonal_offering" ? TimeHorizons.THIS_SEASON : TimeHorizons.ONGOING,
    evidence: [
      {
        id: document.id,
        summary: fact.source_excerpt ?? fact.fact,
        occurredAt: fact.date_learned,
        sourceProviderId: "smart_uploads",
        sourceLabel: `Smart Uploads · ${document.file_name}`,
        quality: fact.confidence,
      },
    ],
    possibleActions: [],
    relatedGoals: [],
    lastUpdated: fact.last_verified_at,
  };
}

export function knowledgeCategoryLabel(category: string): string {
  return KNOWLEDGE_CATEGORY_LABELS[category as keyof typeof KNOWLEDGE_CATEGORY_LABELS] ?? category;
}

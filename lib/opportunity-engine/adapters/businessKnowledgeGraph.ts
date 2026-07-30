/**
 * Business Knowledge Graph adapter — reuses the reasoning engine's own
 * multi-source conclusions (lib/business-knowledge-graph/reasoning.ts)
 * rather than re-deriving them. A conclusion already required 2+
 * independent providers to agree, so this adapter only relabels it as a
 * concrete opportunity type based on which kind of entity it's about.
 */

import { GraphEntityTypes } from "@/lib/business-knowledge-graph/types";
import type { BusinessReasoningResult } from "@/lib/business-knowledge-graph/reasoning";
import { OpportunityTypes, type OpportunityCandidateInput, type OpportunityType } from "@/lib/opportunity-engine/types";

const SOURCE_PROVIDER_ID = "business_knowledge_graph";
const SOURCE_LABEL = "Business Knowledge Graph";

/** Maps the graph entity id back to its type isn't available on a
 * conclusion directly, so callers pass the graph alongside the reasoning
 * result only when they already have both in hand (the dashboard already
 * builds both from the same request). When unavailable, conclusions default
 * to service_spotlight — still an honest opportunity, just less specific. */
export function businessKnowledgeGraphOpportunityCandidates(input: {
  businessReasoning?: BusinessReasoningResult | null;
  entityTypeById?: Map<string, string>;
}): OpportunityCandidateInput[] {
  const conclusions = input.businessReasoning?.conclusions ?? [];
  if (conclusions.length === 0) return [];

  return conclusions.slice(0, 3).map((conclusion) => {
    const entityType = input.entityTypeById?.get(conclusion.entityId);
    const type: OpportunityType =
      entityType === GraphEntityTypes.SEASONAL_OPPORTUNITY
        ? OpportunityTypes.SEASONAL
        : entityType === GraphEntityTypes.GEOGRAPHIC_MARKET
          ? OpportunityTypes.WEBSITE_IMPROVEMENT
          : OpportunityTypes.SERVICE_SPOTLIGHT;

    return {
      sourceProviderId: SOURCE_PROVIDER_ID,
      sourceLabel: SOURCE_LABEL,
      type,
      topic: conclusion.statement,
      statement: conclusion.statement,
      whyNow: `${conclusion.contributingProviderCount} independent sources already agree on this.`,
      expectedOutcome: "Acting on a conclusion multiple sources corroborate independently carries less risk than a single-source guess.",
      confidence: conclusion.confidence,
      businessImpact: conclusion.confidence === "high" ? "high" : "medium",
      urgency: "medium",
      evidenceSummary: conclusion.reasoning,
      occurredAt: conclusion.lastUpdated,
    };
  });
}

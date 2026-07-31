/**
 * Opportunity Detection Engine adapter — Marketing Opportunities. Reuses
 * the engine's own persisted, scored, evidence-linked active opportunities
 * directly — no re-scoring, no re-detection.
 */

import { OPPORTUNITY_TYPE_LABELS, type DetectedOpportunity } from "@/lib/opportunity-engine/types";
import { BrainSections, type KnowledgeCard } from "@/lib/business-brain-inspector/types";

export function opportunityEngineKnowledgeCards(opportunities: DetectedOpportunity[] | null | undefined): KnowledgeCard[] {
  if (!opportunities?.length) return [];

  return opportunities.slice(0, 6).map((opportunity) => ({
    id: `opportunity_engine_${opportunity.id}`,
    section: BrainSections.MARKETING_OPPORTUNITIES,
    title: OPPORTUNITY_TYPE_LABELS[opportunity.type],
    statement: opportunity.statement,
    confidence: opportunity.confidence,
    confidenceReason: opportunity.whyNow,
    evidenceCount: opportunity.evidence.length,
    evidence: opportunity.evidence.map((e) => ({
      sourceProviderId: e.sourceProviderId,
      sourceLabel: e.sourceLabel,
      summary: e.summary,
    })),
    correction: { label: "See this on your Growth Advisor", href: "/dashboard" },
  }));
}

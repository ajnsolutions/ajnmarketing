/**
 * External Intelligence adapter — Search Trends and Seasonality. Reuses the
 * already-categorized searchDemandTrends/seasonalOpportunities/localEvents
 * insights directly; introduces no new detection logic.
 */

import type { ExternalIntelligence, ExternalIntelligenceInsight } from "@/lib/external-intelligence/types";
import { fromConfidenceLevel } from "@/lib/business-brain-inspector/confidence";
import { BrainSections, type BrainSectionKey, type KnowledgeCard } from "@/lib/business-brain-inspector/types";

function cardFrom(section: BrainSectionKey, insight: ExternalIntelligenceInsight, idx: number): KnowledgeCard {
  return {
    id: `external_intelligence_${section}_${idx}`,
    section,
    title: insight.insight.length > 60 ? `${insight.insight.slice(0, 57)}...` : insight.insight,
    statement: insight.insight,
    confidence: fromConfidenceLevel(insight.confidence),
    confidenceReason:
      insight.corroboratingProviderCount > 1
        ? `Corroborated by ${insight.corroboratingProviderCount} independent signals.`
        : "Based on a single external signal so far.",
    evidenceCount: insight.evidence.length,
    evidence: insight.evidence.map((e) => ({
      sourceProviderId: e.sourceProviderId,
      sourceLabel: e.sourceLabel,
      summary: e.summary,
    })),
    correction: { label: "Review Search Console", href: "/dashboard/search-console" },
  };
}

export function externalIntelligenceKnowledgeCards(
  externalIntelligence: ExternalIntelligence | null | undefined,
): KnowledgeCard[] {
  if (!externalIntelligence || externalIntelligence.emptyState === "no_evidence") return [];

  const searchTrends = externalIntelligence.searchDemandTrends
    .slice(0, 5)
    .map((insight, idx) => cardFrom(BrainSections.SEARCH_TRENDS, insight, idx));

  const seasonality = [...externalIntelligence.seasonalOpportunities, ...externalIntelligence.localEvents]
    .slice(0, 5)
    .map((insight, idx) => cardFrom(BrainSections.SEASONALITY, insight, idx));

  return [...searchTrends, ...seasonality];
}

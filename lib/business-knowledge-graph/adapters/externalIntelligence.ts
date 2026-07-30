/**
 * External Intelligence (Search Console + future providers behind it) ->
 * graph signals. Pure function — no I/O. Never branches on the specific
 * provider that produced a given ExternalIntelligenceInsight — reads only
 * the already-normalized ExternalIntelligence package.
 */

import type { ExternalIntelligence, ExternalIntelligenceInsight } from "@/lib/external-intelligence/types";
import { GraphEntityTypes, type GraphEntityType, type GraphSignalInput } from "@/lib/business-knowledge-graph/types";

/** Search Console's own normalization (lib/google-search-console/normalize.ts)
 * quotes the specific query/page phrase inside its insight sentence — prefer
 * that clean phrase as the related-entity label over the whole sentence when
 * present, so the resulting service/topic entity reads naturally. */
function extractQuotedPhrase(text: string): string | null {
  const match = text.match(/"([^"]{3,80})"/);
  return match?.[1] ?? null;
}

function insightToSignal(
  insight: ExternalIntelligenceInsight,
  entityType: GraphEntityType,
  relationship: GraphSignalInput["relationship"],
): GraphSignalInput {
  const providerId = insight.evidence[0]?.sourceProviderId ?? "external_intelligence";
  const providerLabel = insight.evidence[0]?.sourceLabel ?? "External Intelligence";
  const relatedLabel = extractQuotedPhrase(insight.insight) ?? insight.insight;

  return {
    sourceProviderId: providerId,
    sourceLabel: providerLabel,
    entityType,
    entityLabel: insight.insight,
    confidence: insight.confidence,
    evidenceSummary: insight.insight,
    occurredAt: insight.lastUpdated,
    relationship,
    relatedEntityType: GraphEntityTypes.SERVICE,
    relatedEntityLabel: relatedLabel,
  };
}

export function externalIntelligenceToGraphSignals(
  intelligence: ExternalIntelligence | null | undefined,
): GraphSignalInput[] {
  if (!intelligence || intelligence.emptyState === "no_evidence") return [];

  const signals: GraphSignalInput[] = [];

  for (const insight of intelligence.searchDemandTrends) {
    signals.push(insightToSignal(insight, GraphEntityTypes.SEARCH_TOPIC, "supports"));
  }

  for (const insight of intelligence.seasonalOpportunities) {
    signals.push(insightToSignal(insight, GraphEntityTypes.SEASONAL_OPPORTUNITY, "related_to"));
  }

  for (const insight of intelligence.holidayCalendar) {
    signals.push(insightToSignal(insight, GraphEntityTypes.SEASONAL_OPPORTUNITY, "related_to"));
  }

  for (const insight of intelligence.competitorActivity) {
    signals.push(insightToSignal(insight, GraphEntityTypes.COMPETITIVE_STRENGTH, "competes_with"));
  }

  return signals;
}

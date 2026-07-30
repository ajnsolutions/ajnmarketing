/**
 * Customer Voice -> graph signals. Pure function — no I/O.
 */

import type { CustomerVoiceIntelligence, CustomerVoiceTheme } from "@/lib/customer-voice/types";
import { GraphEntityTypes, type GraphSignalInput } from "@/lib/business-knowledge-graph/types";

const PROVIDER_ID = "customer_voice";
const PROVIDER_LABEL = "Customer Voice";

function themeToSignal(theme: CustomerVoiceTheme): GraphSignalInput {
  return {
    sourceProviderId: PROVIDER_ID,
    sourceLabel: PROVIDER_LABEL,
    entityType: GraphEntityTypes.CUSTOMER_THEME,
    entityLabel: theme.label,
    confidence: theme.confidence,
    evidenceSummary: `${theme.percentageOfReviews}% of reviewed feedback mentions "${theme.label}"`,
    occurredAt: theme.lastUpdated,
    // Customer feedback about a real service reinforces that service being a
    // genuine strength — the graph builder resolves the target by topic
    // overlap against existing service/product entities.
    relationship: "reinforces",
    relatedEntityType: GraphEntityTypes.SERVICE,
    relatedEntityLabel: theme.label,
  };
}

export function customerVoiceToGraphSignals(
  intelligence: CustomerVoiceIntelligence | null | undefined,
): GraphSignalInput[] {
  if (!intelligence || intelligence.emptyState === "no_evidence") return [];

  const themes = [
    ...intelligence.strengths,
    ...intelligence.frequentlyMentionedServices,
    ...intelligence.opportunities,
  ];

  // Same theme can appear in more than one bucket (e.g. a strength that's
  // also a frequently mentioned service) — dedupe by key so it isn't
  // double-counted as two separate corroborating signals from one theme.
  const seen = new Set<string>();
  const signals: GraphSignalInput[] = [];
  for (const theme of themes) {
    if (seen.has(theme.key)) continue;
    seen.add(theme.key);
    signals.push(themeToSignal(theme));
  }

  return signals;
}

/**
 * Safe adapter: Customer Voice themes → shared BusinessInsight contract.
 * Does not change Customer Voice theme storage or existing consumers.
 */

import type { BusinessInsight } from "@/lib/business-brain/insight";
import { TimeHorizons } from "@/lib/business-brain/insight";
import { insightSentenceForTheme, possibleActionsForTheme } from "@/lib/customer-voice/possibleActions";
import type { CustomerVoiceTheme } from "@/lib/customer-voice/types";

export function customerVoiceThemeToBusinessInsight(
  theme: CustomerVoiceTheme,
): BusinessInsight {
  return {
    id: `customer_voice:${theme.key}`,
    category: `customer_voice_${theme.kind}`,
    insight: insightSentenceForTheme(theme),
    confidence: theme.confidence,
    businessImpact: theme.businessImpact,
    timeHorizon: TimeHorizons.ONGOING,
    evidence: theme.evidenceIds.map((id) => ({
      id,
      summary: theme.languageVariants[0] ?? theme.label,
      occurredAt: theme.lastUpdated,
      sourceProviderId: "customer_voice",
      sourceLabel: "Customer Voice",
      quality: theme.confidence,
    })),
    possibleActions: possibleActionsForTheme(theme),
    relatedGoals: [],
    lastUpdated: theme.lastUpdated,
  };
}

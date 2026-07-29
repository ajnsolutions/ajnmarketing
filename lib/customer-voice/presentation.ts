/**
 * Conversational presentation + explainability for Customer Voice insights.
 * No chain-of-thought — only customer-safe reasons.
 */

import {
  insightSentenceForTheme,
  possibleActionsForTheme,
  type PossibleAction,
} from "@/lib/customer-voice/possibleActions";
import { buildMarketingCopySuggestions } from "@/lib/customer-voice/copySuggestions";
import { resolveCustomerVoiceHealth, type CustomerVoiceHealth } from "@/lib/customer-voice/health";
import type {
  CustomerVoiceIntelligence,
  CustomerVoiceTheme,
  SentimentTrendPoint,
} from "@/lib/customer-voice/types";
import type { MarketingCopySuggestion } from "@/lib/customer-voice/copySuggestions";

export type CustomerVoiceInsightCard = {
  themeKey: string;
  insight: string;
  confidence: string;
  businessImpact: string;
  supportingReviewCount: number;
  percentageOfReviews: number;
  trend: string;
  whyBelievable: string;
  possibleActions: PossibleAction[];
};

export type CustomerVoicePageModel = {
  businessName: string;
  generatedAt: string;
  health: CustomerVoiceHealth;
  maturityCopy: string;
  loves: CustomerVoiceInsightCard[];
  opportunities: CustomerVoiceInsightCard[];
  customerLanguage: CustomerVoiceInsightCard[];
  mentionedServices: CustomerVoiceInsightCard[];
  recentTrends: SentimentTrendPoint[];
  suggestedMarketingOpportunities: MarketingCopySuggestion[];
  emptyState: "no_evidence" | "insufficient_evidence" | null;
};

function trendLabel(trend: CustomerVoiceTheme["trendDirection"]): string {
  switch (trend) {
    case "improving":
      return "Improving";
    case "declining":
      return "Declining";
    case "stable":
      return "Stable";
    default:
      return "Still establishing";
  }
}

function whyBelievable(theme: CustomerVoiceTheme): string {
  const parts = [
    `${theme.evidenceCount} supporting review${theme.evidenceCount === 1 ? "" : "s"}`,
    `${theme.percentageOfReviews}% of reviewed feedback`,
    `${theme.confidence} confidence`,
  ];
  if (theme.languageVariants.length > 0) {
    parts.push(`language like “${theme.languageVariants[0]}”`);
  }
  return `I believe this because ${parts.join(", ")}.`;
}

export function toInsightCard(theme: CustomerVoiceTheme): CustomerVoiceInsightCard {
  return {
    themeKey: theme.key,
    insight: insightSentenceForTheme(theme),
    confidence: theme.confidence,
    businessImpact: theme.businessImpact,
    supportingReviewCount: theme.evidenceCount,
    percentageOfReviews: theme.percentageOfReviews,
    trend: trendLabel(theme.trendDirection),
    whyBelievable: whyBelievable(theme),
    possibleActions: possibleActionsForTheme(theme),
  };
}

export function buildCustomerVoicePageModel(input: {
  intelligence: CustomerVoiceIntelligence;
  businessName: string;
}): CustomerVoicePageModel {
  const { intelligence, businessName } = input;
  const health = resolveCustomerVoiceHealth(intelligence);

  return {
    businessName,
    generatedAt: intelligence.generatedAt,
    health,
    maturityCopy: intelligence.score.maturityCopy,
    loves: intelligence.strengths.slice(0, 6).map(toInsightCard),
    opportunities: [...intelligence.concerns, ...intelligence.opportunities, ...intelligence.requests]
      .slice(0, 6)
      .map(toInsightCard),
    customerLanguage: intelligence.commonCustomerLanguage.slice(0, 6).map(toInsightCard),
    mentionedServices: intelligence.frequentlyMentionedServices.slice(0, 6).map(toInsightCard),
    recentTrends: intelligence.sentimentTrends,
    suggestedMarketingOpportunities: buildMarketingCopySuggestions(intelligence),
    emptyState: intelligence.emptyState,
  };
}

/** Natural Growth Advisor lines — never invents themes. */
export function growthAdvisorCustomerVoiceLines(
  intelligence: CustomerVoiceIntelligence | null | undefined,
): {
  noticedLine: string | null;
  recommendationContext: string | null;
  health: CustomerVoiceHealth;
} {
  const health = resolveCustomerVoiceHealth(intelligence);
  if (!intelligence || intelligence.emptyState === "no_evidence") {
    return { noticedLine: null, recommendationContext: null, health };
  }

  const topStrength = intelligence.strengths.find(
    (t) => t.evidenceCount >= 2 && t.confidence !== "low",
  );
  if (!topStrength) {
    return {
      noticedLine:
        intelligence.emptyState === "insufficient_evidence"
          ? "I'm still establishing a baseline from customer feedback."
          : null,
      recommendationContext: null,
      health,
    };
  }

  const noticedLine = insightSentenceForTheme(topStrength);
  return {
    noticedLine,
    recommendationContext: noticedLine,
    health,
  };
}

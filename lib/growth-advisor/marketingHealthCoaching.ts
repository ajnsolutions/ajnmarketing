/**
 * Marketing Health coaching (Project Magic Phase 2, Part 4) — a single,
 * presentation-only composition over the app's existing, independent health
 * signals (Head of Marketing state, Customer Voice health, Business
 * Knowledge health, Learning Maturity). It creates no new score, invents no
 * number, and never re-ranks a recommendation — it only explains what the
 * already-computed signals mean, why they matter, the next best action
 * (the same primary action Growth Advisor already recommends — never a
 * second, competing recommendation engine), and a qualitative expected
 * improvement grounded in real, already-written detail text.
 */

import type { HeadOfMarketingHealth, HeadOfMarketingPrimaryAction } from "@/lib/head-of-marketing/types";
import type { CustomerVoiceHealth } from "@/lib/customer-voice/health";
import type { BusinessKnowledgeHealth } from "@/lib/business-knowledge-graph/knowledgeHealth";
import type { LearningMaturity } from "@/lib/business-learning-engine/learningMaturity";

export type MarketingHealthSupportingScore = {
  key: string;
  label: string;
  score: number;
  detail: string;
};

export type MarketingHealthCoaching = {
  label: string;
  /** What the score/state means, in plain language. */
  whatItMeans: string;
  /** Why it matters right now. */
  whyItMatters: string;
  /** The single next best action — reuses the same primary action Growth
   * Advisor already recommends, never a second, competing recommendation. */
  nextBestAction: { label: string; href: string } | null;
  /** A qualitative, evidence-grounded statement of what improves and how —
   * never a fabricated score delta. */
  expectedImprovement: string;
  /** Supporting detail, tucked behind progressive disclosure in the UI. */
  supportingScores: MarketingHealthSupportingScore[];
};

function learningMaturityScores(learningMaturity: LearningMaturity | null | undefined): MarketingHealthSupportingScore[] {
  if (!learningMaturity) return [];
  return [
    {
      key: "learning_maturity",
      label: "Learning maturity",
      score: learningMaturity.overallScore,
      detail: "How much the Business Learning Engine has learned from real outcomes, and how much to trust it.",
    },
  ];
}

function knowledgeHealthScores(knowledgeHealth: BusinessKnowledgeHealth | null | undefined): MarketingHealthSupportingScore[] {
  if (!knowledgeHealth) return [];
  return [
    {
      key: "business_understanding",
      label: "Business understanding",
      score: knowledgeHealth.overallScore,
      detail: "How well we understand your business across every connected source.",
    },
  ];
}

function customerVoiceScores(customerVoiceHealth: CustomerVoiceHealth | null | undefined): MarketingHealthSupportingScore[] {
  if (!customerVoiceHealth) return [];
  return [
    {
      key: "customer_voice",
      label: `Customer Voice · ${customerVoiceHealth.label}`,
      score: -1,
      detail: customerVoiceHealth.message,
    },
  ];
}

/**
 * The single most useful, honest "what happens if you act on this" line.
 * Prefers the most specific, already-written gap explanation available —
 * never invents a number.
 */
function resolveExpectedImprovement(input: {
  health: HeadOfMarketingHealth;
  customerVoiceHealth?: CustomerVoiceHealth | null;
  knowledgeHealth?: BusinessKnowledgeHealth | null;
  learningMaturity?: LearningMaturity | null;
}): string {
  if (input.health.state === "excellent") {
    return "You're in a strong position — keep the current weekly rhythm going.";
  }

  const topGap = input.knowledgeHealth?.missingKnowledge[0];
  if (topGap) {
    return `${topGap.detail} Closing this gap is the fastest way to strengthen your marketing health.`;
  }

  const weakestLearningDimension = input.learningMaturity
    ? Object.values(input.learningMaturity.dimensions).find((dimension) => dimension.level !== "strong")
    : null;
  if (weakestLearningDimension) {
    return weakestLearningDimension.improvementTip;
  }

  if (input.customerVoiceHealth && input.customerVoiceHealth.state !== "healthy") {
    return input.customerVoiceHealth.reason;
  }

  return "Keep going — I'll flag the next thing worth strengthening as soon as I notice it.";
}

export function buildMarketingHealthCoaching(input: {
  health: HeadOfMarketingHealth;
  primaryAction: HeadOfMarketingPrimaryAction;
  customerVoiceHealth?: CustomerVoiceHealth | null;
  knowledgeHealth?: BusinessKnowledgeHealth | null;
  learningMaturity?: LearningMaturity | null;
}): MarketingHealthCoaching {
  return {
    label: input.health.label,
    whatItMeans: input.health.message,
    whyItMatters: input.health.reason,
    nextBestAction:
      input.primaryAction.kind !== "none"
        ? { label: input.primaryAction.label, href: input.primaryAction.href }
        : null,
    expectedImprovement: resolveExpectedImprovement(input),
    supportingScores: [
      ...customerVoiceScores(input.customerVoiceHealth),
      ...knowledgeHealthScores(input.knowledgeHealth),
      ...learningMaturityScores(input.learningMaturity),
    ],
  };
}

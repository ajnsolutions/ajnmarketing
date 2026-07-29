/**
 * Your Growth Advisor — pure presentation transform.
 *
 * Takes the already-computed HeadOfMarketingBriefing (built by
 * lib/head-of-marketing/weeklyBriefing.ts from Marketing Director,
 * Marketing Health, the Journal, and Marketing Memory) and reshapes it into
 * the conversational hierarchy this sprint asks for: greeting → what changed
 * → what I noticed (top 3) → what I recommend (exactly one) → primary action
 * → supporting context.
 *
 * This file computes NO new scores, decisions, or recommendations. Every
 * sentence here traces back to a field the briefing already produced from
 * real signals — see docs/project-magic/GROWTH_ADVISOR.md's "reuse, don't
 * rebuild" rule.
 */

import type { HeadOfMarketingBriefing } from "@/lib/head-of-marketing/types";
import { confidenceExplanation, confidenceLabelText } from "@/lib/recommendation-presentation/confidenceLabels";
import type {
  GrowthAdvisorBriefing,
  GrowthAdvisorEmptyStateKind,
  GrowthAdvisorObservation,
  GrowthAdvisorRecommendation,
} from "@/lib/growth-advisor/types";
import type { BusinessDiscoveryResult } from "@/lib/business-discovery/types";

/**
 * Plain-language "why it matters" per noticed-item category. `buildNoticed`
 * (lib/head-of-marketing/weeklyBriefing.ts) already prefixes each item with
 * one of these category labels — this is the same fixed vocabulary, not a
 * new taxonomy, so parsing it here can't silently drift out of sync in a way
 * that produces a wrong "why it matters" for a real category.
 */
const WHY_IT_MATTERS: Record<string, string> = {
  "Search visibility": "That's often the first way a new customer finds you.",
  "Review trends": "Reviews shape whether someone trusts you enough to reach out.",
  "Competitor activity": "Knowing what others are doing helps keep your offer sharp.",
  "Seasonal opportunities": "Timing well means less competition for the same customers.",
  "Community & content": "A few minutes now keeps your content moving without it piling up.",
};

const GENERIC_WHY_IT_MATTERS = "Worth keeping an eye on as the week goes on.";

/** Splits a "Category: sentence." noticed-item into headline + why-it-matters. */
function toObservation(item: string): GrowthAdvisorObservation {
  const separatorIndex = item.indexOf(": ");
  if (separatorIndex === -1) {
    return { headline: item, whyItMatters: GENERIC_WHY_IT_MATTERS };
  }

  const category = item.slice(0, separatorIndex);
  const headline = item.slice(separatorIndex + 2);
  return { headline, whyItMatters: WHY_IT_MATTERS[category] ?? GENERIC_WHY_IT_MATTERS };
}

/**
 * A single, honestly-derived observation from Business Discovery — used only
 * to fill out "What I noticed" when the primary signals (buildNoticed) are
 * thin, never to displace a real signal. Never fabricates: only fires when a
 * genuine growth-opportunity insight exists with an actual value.
 */
function businessDiscoveryObservation(
  businessDiscovery: BusinessDiscoveryResult | null | undefined,
): GrowthAdvisorObservation | null {
  const opportunities = businessDiscovery?.growthOpportunities;
  if (!opportunities?.value?.length) return null;

  return {
    headline: `Your business profile: ${opportunities.value[0]}`,
    whyItMatters: "Something I noticed while studying your business and website.",
  };
}

function buildWhatINoticed(
  briefing: HeadOfMarketingBriefing,
  businessDiscovery: BusinessDiscoveryResult | null | undefined,
): GrowthAdvisorObservation[] {
  const fromSignals = briefing.noticed
    .filter((item) => !/^Nothing urgent/.test(item))
    .map(toObservation);

  if (fromSignals.length >= 3) return fromSignals.slice(0, 3);

  const supplement = businessDiscoveryObservation(businessDiscovery);
  const combined = supplement ? [...fromSignals, supplement] : fromSignals;
  return combined.slice(0, 3);
}

/**
 * "This week" always resolves to at least one line — even the fallback path
 * (lib/head-of-marketing/weeklyBriefing.ts's buildThisWeek) returns a single
 * honest, low-key sentence rather than nothing. A single item is a reliable
 * proxy for "nothing meaningful happened yet" without needing this
 * presentation layer to re-derive the raw weekly-wins counts itself.
 */
function buildWhatChanged(briefing: HeadOfMarketingBriefing): GrowthAdvisorBriefing["whatChanged"] {
  const hasMeaningfulChange = briefing.thisWeek.length > 1;
  return {
    hasMeaningfulChange,
    items: briefing.thisWeek,
    memoryLine: briefing.relationshipMemory,
  };
}

function estimatedEffortFromTimeLabel(timeRespectLabel: string): string {
  if (timeRespectLabel === "Nothing to review") return "No effort needed from you right now.";
  return `About ${timeRespectLabel} of your time.`;
}

function buildRecommendation(briefing: HeadOfMarketingBriefing): GrowthAdvisorRecommendation | null {
  const recommendation = briefing.recommendation;
  if (!recommendation) return null;

  const detail = briefing.topRecommendationDetail;
  const confidenceLabel = detail?.confidenceLabel ?? null;

  return {
    title: detail?.title ?? recommendation.title,
    whyNow: detail?.whyNow ?? recommendation.why,
    expectedImpact: detail?.expectedBenefit ?? recommendation.expectedBenefit,
    estimatedEffort: estimatedEffortFromTimeLabel(briefing.timeRespectLabel),
    whyIBelieve: confidenceLabel
      ? confidenceExplanation(confidenceLabel)
      : "This is the clearest next step based on where things stand today.",
    confidenceLabel,
    confidenceLabelText: confidenceLabel ? confidenceLabelText(confidenceLabel) : null,
  };
}

function resolveEmptyStateKind(
  briefing: HeadOfMarketingBriefing,
  recommendation: GrowthAdvisorRecommendation | null,
): GrowthAdvisorEmptyStateKind {
  if (!briefing.confidence.gbpConnected) return "disconnected_integration";
  if (!recommendation) return "no_recommendation";
  if (briefing.journal.entries.length === 0) return "no_recent_activity";
  return null;
}

export function buildGrowthAdvisorBriefing(
  briefing: HeadOfMarketingBriefing,
  businessDiscovery?: BusinessDiscoveryResult | null,
): GrowthAdvisorBriefing {
  const recommendation = buildRecommendation(briefing);

  return {
    greeting: briefing.greeting,
    businessName: briefing.businessName,
    whatChanged: buildWhatChanged(briefing),
    whatINoticed: buildWhatINoticed(briefing, businessDiscovery),
    recommendation,
    primaryAction: briefing.primaryAction,
    primaryActionIsReassurance: briefing.primaryAction.kind === "none",
    emptyStateKind: resolveEmptyStateKind(briefing, recommendation),
    supporting: {
      health: {
        state: briefing.health.state,
        label: briefing.health.label,
        message: briefing.health.message,
      },
      journalIntro: briefing.journal.intro,
      hasRecentActivity: briefing.journal.entries.length > 0,
    },
  };
}

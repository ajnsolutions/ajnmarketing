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
 * Wave III adds goal progress + strategy-layer annotation on the single
 * recommendation. This file still computes NO new recommendation scores or
 * rankings — see docs/project-magic/GOALS_AND_STRATEGY.md.
 */

import type { HeadOfMarketingBriefing } from "@/lib/head-of-marketing/types";
import { confidenceExplanation, confidenceLabelText } from "@/lib/recommendation-presentation/confidenceLabels";
import type {
  GrowthAdvisorBriefing,
  GrowthAdvisorEmptyStateKind,
  GrowthAdvisorGoalProgressSummary,
  GrowthAdvisorObservation,
  GrowthAdvisorRecommendation,
} from "@/lib/growth-advisor/types";
import type { BusinessDiscoveryResult } from "@/lib/business-discovery/types";
import type { BusinessGoal } from "@/lib/goals/types";
import {
  buildGoalProgress,
  primaryStrategicFocus,
  type GoalProgressSignals,
} from "@/lib/goals/progress";
import { explainGoalRelevance } from "@/lib/strategy/goalRelevance";
import type { CustomerVoiceIntelligence } from "@/lib/customer-voice/types";
import { growthAdvisorCustomerVoiceLines } from "@/lib/customer-voice/presentation";


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

function customerVoiceObservation(
  noticedLine: string | null,
): GrowthAdvisorObservation | null {
  if (!noticedLine) return null;
  return {
    headline: noticedLine,
    whyItMatters: "Customer language is one of the strongest cues for authentic marketing.",
  };
}

function buildWhatINoticed(
  briefing: HeadOfMarketingBriefing,
  businessDiscovery: BusinessDiscoveryResult | null | undefined,
  customerVoiceLine: string | null,
): GrowthAdvisorObservation[] {
  const fromSignals = briefing.noticed
    .filter((item) => !/^Nothing urgent/.test(item))
    .map(toObservation);

  const voice = customerVoiceObservation(customerVoiceLine);
  const withVoice = voice ? [voice, ...fromSignals] : fromSignals;
  if (withVoice.length >= 3) return withVoice.slice(0, 3);

  const supplement = businessDiscoveryObservation(businessDiscovery);
  const combined = supplement ? [...withVoice, supplement] : withVoice;
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

function signalsFromBriefing(briefing: HeadOfMarketingBriefing): GoalProgressSignals {
  return {
    gbpConnected: briefing.confidence.gbpConnected,
    unansweredReviews: 0,
    pendingApprovals: briefing.confidence.pendingApprovals,
    publishFailures: briefing.confidence.publishFailures,
    openRecommendations: briefing.confidence.openRecommendations,
    weeklyReviewCount: briefing.confidence.weeklyNewReviews,
    weeklyPostCount: briefing.confidence.weeklyPublishedPosts,
    websiteConnected: Boolean(briefing.confidence.hasMarketingPlan) || briefing.confidence.gbpConnected,
    setupComplete: briefing.confidence.gbpConnected && !briefing.isEarlyCustomer,
    isEarlyCustomer: briefing.isEarlyCustomer,
  };
}

function buildGoalProgressSummary(
  goals: BusinessGoal[],
  briefing: HeadOfMarketingBriefing,
  signalOverrides?: Partial<GoalProgressSignals>,
): GrowthAdvisorGoalProgressSummary {
  if (goals.length === 0) {
    return {
      items: [],
      strategicFocus: null,
      primaryState: null,
      emptyDetail:
        "When you tell me what success looks like, I can track progress toward those goals here.",
    };
  }

  const signals: GoalProgressSignals = {
    ...signalsFromBriefing(briefing),
    ...signalOverrides,
  };
  const items = buildGoalProgress(goals, signals);
  const focus = primaryStrategicFocus(goals);

  return {
    items,
    strategicFocus: focus?.label ?? null,
    primaryState: items[0]?.state ?? null,
    emptyDetail: null,
  };
}

function buildRecommendation(
  briefing: HeadOfMarketingBriefing,
  goals: BusinessGoal[],
  customerVoiceContext: string | null,
): GrowthAdvisorRecommendation | null {
  const recommendation = briefing.recommendation;
  if (!recommendation) return null;

  const detail = briefing.topRecommendationDetail;
  const confidenceLabel = detail?.confidenceLabel ?? null;
  const relevance = explainGoalRelevance(
    goals,
    detail?.actionType ?? null,
    detail?.title ?? recommendation.title,
  );

  return {
    title: detail?.title ?? recommendation.title,
    supportsGoal: relevance?.supportsGoal ?? null,
    whySupportsGoal: relevance?.whySupportsGoal ?? null,
    whyNow: detail?.whyNow ?? recommendation.why,
    expectedImpact: detail?.expectedBenefit ?? recommendation.expectedBenefit,
    estimatedEffort: estimatedEffortFromTimeLabel(briefing.timeRespectLabel),
    whyIBelieve: confidenceLabel
      ? confidenceExplanation(confidenceLabel)
      : "This is the clearest next step based on where things stand today.",
    confidenceLabel,
    confidenceLabelText: confidenceLabel ? confidenceLabelText(confidenceLabel) : null,
    customerVoiceContext,
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

export type BuildGrowthAdvisorBriefingOptions = {
  goals?: BusinessGoal[];
  /** Optional signal overrides (e.g. unanswered review count from a richer fetch). */
  progressSignals?: Partial<GoalProgressSignals>;
  /** Existing Customer Voice intelligence — presentation only; never re-ranks. */
  customerVoice?: CustomerVoiceIntelligence | null;
};

export function buildGrowthAdvisorBriefing(
  briefing: HeadOfMarketingBriefing,
  businessDiscovery?: BusinessDiscoveryResult | null,
  options?: BuildGrowthAdvisorBriefingOptions,
): GrowthAdvisorBriefing {
  const goals = options?.goals ?? [];
  const voiceLines = growthAdvisorCustomerVoiceLines(options?.customerVoice);
  const recommendation = buildRecommendation(
    briefing,
    goals,
    voiceLines.recommendationContext,
  );

  return {
    greeting: briefing.greeting,
    businessName: briefing.businessName,
    whatChanged: buildWhatChanged(briefing),
    whatINoticed: buildWhatINoticed(briefing, businessDiscovery, voiceLines.noticedLine),
    goalProgress: buildGoalProgressSummary(goals, briefing, options?.progressSignals),
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
      customerVoiceHealth: {
        state: voiceLines.health.state,
        label: voiceLines.health.label,
        message: voiceLines.health.message,
      },
      journalIntro: briefing.journal.intro,
      hasRecentActivity: briefing.journal.entries.length > 0,
    },
  };
}

/**
 * Your Growth Advisor — pure presentation transform.
 *
 * Takes the already-computed HeadOfMarketingBriefing and reshapes it into the
 * conversational weekly meeting hierarchy:
 * This Week → What I Noticed → Recommendation → Expected Impact → Next Week → One Action.
 *
 * Still computes NO new recommendation scores or rankings — Marketing Director
 * remains the sole prioritizer. Business Brain sources enrich presentation only.
 *
 * See docs/project-magic/GROWTH_ADVISOR_EXPERIENCE.md.
 */

import type { HeadOfMarketingBriefing } from "@/lib/head-of-marketing/types";
import { confidenceExplanation, confidenceLabelText } from "@/lib/recommendation-presentation/confidenceLabels";
import type {
  GrowthAdvisorBriefing,
  GrowthAdvisorEmptyStateKind,
  GrowthAdvisorGoalProgressSummary,
  GrowthAdvisorLearningState,
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
import type { ExternalIntelligence } from "@/lib/external-intelligence/types";
import { buildWhatINoticedObservations } from "@/lib/growth-advisor/observations";
import { resolveExpectedBusinessOutcomes } from "@/lib/growth-advisor/expectedImpact";
import { buildNextWeekMonitoring } from "@/lib/growth-advisor/nextWeek";
import { TrustCertaintyLevels } from "@/lib/growth-advisor/trust";
import type { GuidedSetupExperience } from "@/lib/guided-setup/types";
import { KnowledgeStates } from "@/lib/guided-setup/types";

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

function buildSupportingEvidence(input: {
  detailWhyNow: string | null;
  customerVoiceContext: string | null;
  supportsGoal: string | null;
  confidenceLabelText: string | null;
}): string[] {
  const evidence: string[] = [];
  if (input.detailWhyNow) evidence.push(input.detailWhyNow);
  if (input.customerVoiceContext) evidence.push(input.customerVoiceContext);
  if (input.supportsGoal) evidence.push(`Related to your goal: ${input.supportsGoal}.`);
  if (input.confidenceLabelText) evidence.push(`Confidence: ${input.confidenceLabelText}.`);
  return evidence.slice(0, 5);
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

  const expectedBenefit = detail?.expectedBenefit ?? recommendation.expectedBenefit;
  const outcomes = resolveExpectedBusinessOutcomes({
    actionType: detail?.actionType ?? null,
    expectedBenefit,
    supportsGoal: relevance?.supportsGoal ?? null,
  });

  const confidenceLabelTextValue = confidenceLabel ? confidenceLabelText(confidenceLabel) : null;
  const whyNow = detail?.whyNow ?? recommendation.why;

  const whyIBelieveParts = [
    confidenceLabel
      ? confidenceExplanation(confidenceLabel)
      : "This is the clearest next step based on where things stand today.",
  ];
  if (customerVoiceContext) {
    whyIBelieveParts.push(customerVoiceContext);
  }
  if (relevance?.supportsGoal) {
    whyIBelieveParts.push(`It supports your goal of ${relevance.supportsGoal.toLowerCase()}.`);
  }

  return {
    title: detail?.title ?? recommendation.title,
    supportsGoal: relevance?.supportsGoal ?? null,
    whySupportsGoal: relevance?.whySupportsGoal ?? null,
    whyNow,
    expectedImpact: outcomes.summary,
    expectedOutcomes: outcomes.outcomes,
    estimatedEffort: estimatedEffortFromTimeLabel(briefing.timeRespectLabel),
    whyIBelieve: whyIBelieveParts.join(" "),
    supportingEvidence: buildSupportingEvidence({
      detailWhyNow: whyNow,
      customerVoiceContext,
      supportsGoal: relevance?.supportsGoal ?? null,
      confidenceLabelText: confidenceLabelTextValue,
    }),
    businessImpactLabel: confidenceLabel ? "Meaningful" : null,
    confidenceLabel,
    confidenceLabelText: confidenceLabelTextValue,
    customerVoiceContext,
    certainty: TrustCertaintyLevels.SUGGESTED,
  };
}

function buildLearningState(input: {
  briefing: HeadOfMarketingBriefing;
  whatINoticedCount: number;
  customerVoice?: CustomerVoiceIntelligence | null;
  externalIntelligence?: ExternalIntelligence | null;
  goals: BusinessGoal[];
  guidedSetup?: GuidedSetupExperience | null;
}): GrowthAdvisorLearningState {
  const suggestions: string[] = [];
  const gbpConnected = input.briefing.confidence.gbpConnected;
  const cvEmpty =
    !input.customerVoice ||
    input.customerVoice.emptyState === "no_evidence" ||
    input.customerVoice.emptyState === "insufficient_evidence";
  const eiEmpty =
    !input.externalIntelligence ||
    input.externalIntelligence.emptyState === "no_evidence" ||
    input.externalIntelligence.emptyState === "insufficient_evidence";

  if (input.guidedSetup?.recommendedNext && !input.guidedSetup.advisorReady) {
    suggestions.push(
      `${input.guidedSetup.recommendedNext.title}: ${input.guidedSetup.recommendedNext.brainImprovement}`,
    );
  }

  if (!gbpConnected) {
    suggestions.push("Connect Google Business Profile so I can learn from your local presence and reviews.");
  } else if (cvEmpty) {
    suggestions.push("Sync recent reviews so I can learn how customers naturally talk about you.");
  }
  if (input.goals.length === 0) {
    suggestions.push("Tell me what success looks like so recommendations stay tied to your goals.");
  }
  if (eiEmpty && gbpConnected) {
    suggestions.push("As market signals develop, I'll fold seasonal and local context into our weekly meeting.");
  }

  const waitingCount =
    input.guidedSetup?.knowledgeSignals.filter((s) => s.state === KnowledgeStates.WAITING).length ?? 0;
  const learningCount =
    input.guidedSetup?.knowledgeSignals.filter((s) => s.state === KnowledgeStates.LEARNING).length ?? 0;

  const isLearning =
    input.whatINoticedCount < 2 ||
    !gbpConnected ||
    (cvEmpty && eiEmpty && input.goals.length === 0) ||
    waitingCount > 0 ||
    learningCount > 0 ||
    Boolean(input.guidedSetup && !input.guidedSetup.advisorReady);

  if (!isLearning) {
    return { isLearning: false, message: null, improvementSuggestions: [] };
  }

  const guidedMessage = input.guidedSetup?.latestFirstWin
    ? `New insight unlocked: ${input.guidedSetup.latestFirstWin.title}. I'm still learning — recommendations stay honest about what's Known vs Waiting.`
    : "I'm still learning your business. I'll clearly mark what's Known, what I'm Learning, and what I'm Waiting for — I won't invent insights.";

  return {
    isLearning: true,
    message: guidedMessage,
    improvementSuggestions: [...new Set(suggestions)].slice(0, 3),
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
  /** External Intelligence — presentation only; never re-ranks. */
  externalIntelligence?: ExternalIntelligence | null;
  /** Guided setup / first-wins — presentation only; never re-ranks. */
  guidedSetup?: GuidedSetupExperience | null;
};

export function buildGrowthAdvisorBriefing(
  briefing: HeadOfMarketingBriefing,
  businessDiscovery?: BusinessDiscoveryResult | null,
  options?: BuildGrowthAdvisorBriefingOptions,
): GrowthAdvisorBriefing {
  const goals = options?.goals ?? [];
  const progressSignals: GoalProgressSignals = {
    ...signalsFromBriefing(briefing),
    ...options?.progressSignals,
  };
  const voiceLines = growthAdvisorCustomerVoiceLines(options?.customerVoice);
  const recommendation = buildRecommendation(
    briefing,
    goals,
    voiceLines.recommendationContext,
  );

  const whatINoticed = buildWhatINoticedObservations({
    briefing,
    businessDiscovery,
    customerVoice: options?.customerVoice,
    externalIntelligence: options?.externalIntelligence,
    goals,
    progressSignals,
  });

  const nextWeek = buildNextWeekMonitoring({
    briefing,
    goals,
    customerVoice: options?.customerVoice,
    externalIntelligence: options?.externalIntelligence,
  });

  const learning = buildLearningState({
    briefing,
    whatINoticedCount: whatINoticed.length,
    customerVoice: options?.customerVoice,
    externalIntelligence: options?.externalIntelligence,
    goals,
    guidedSetup: options?.guidedSetup,
  });

  return {
    greeting: briefing.greeting,
    businessName: briefing.businessName,
    whatChanged: buildWhatChanged(briefing),
    whatINoticed,
    goalProgress: buildGoalProgressSummary(goals, briefing, options?.progressSignals),
    recommendation,
    nextWeek,
    learning,
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

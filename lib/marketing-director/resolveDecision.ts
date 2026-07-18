/**
 * Marketing Director Intelligence — the single composition point for "what matters most
 * right now." See docs/MARKETING_DIRECTOR_FOUNDATION.md and
 * docs/MARKETING_DIRECTOR_ARCHITECTURE.md §8.
 *
 * Pure, deterministic, side-effect free: no OpenAI call, no database access, no new
 * scoring math. Every branch below composes an already-computed signal (recommendation
 * counts and their existing adaptive priority/urgency, health state, weekly wins,
 * seasonal hints, Monthly Focus) into one decision. Calling this twice with identical
 * inputs always returns a deep-equal result.
 *
 * The precedence below is the union of what buildPrimaryAction (weeklyBriefing.ts) and
 * proactive.ts's old buildPrimary each independently decided before this module existed
 * — see the architecture review's collision finding (MARKETING_DIRECTOR_ARCHITECTURE.md
 * §4). Consolidating them here also fixes a latent inconsistency: previously, when
 * `openRecommendations > 0` was the only active signal, buildPrimaryAction showed a
 * "Review Recommendation" CTA while proactive's message could say something unrelated
 * (e.g. a seasonal or celebration line), because proactive's own waterfall never checked
 * `openRecommendations` at all. That can no longer happen: both consumers now derive
 * from this one waterfall.
 */

import {
  DeferralReasons,
  MarketingDirectorDecisionTypes,
  type MarketingDirectorCandidate,
  type MarketingDirectorDecision,
  type MarketingDirectorDeferredAlternative,
  type MarketingDirectorInput,
  type MarketingDirectorPrimaryAction,
} from "@/lib/marketing-director/types";
import { ConfidenceLabels } from "@/lib/recommendation-presentation/types";

const NO_ACTION: MarketingDirectorPrimaryAction = {
  kind: "none",
  label: "Nothing needs your attention today",
  href: "/dashboard",
};

/**
 * Deferred alternatives never fabricate a reason beyond what's already on the row:
 * already in progress (a draft exists) beats "low urgency" beats the general default of
 * "ranked lower than this cycle's pick." Reasons the module declares but does not yet
 * assign (blocked_by_prerequisite, awaiting_outcome_data, outside_monthly_focus,
 * duplicate_or_overlapping) require signals not cheaply available at this composition
 * layer today — see docs/MARKETING_DIRECTOR_FOUNDATION.md's known limitations.
 */
function buildDeferred(
  candidates: MarketingDirectorCandidate[],
): MarketingDirectorDeferredAlternative[] {
  return candidates.map((candidate) => ({
    sourceId: candidate.id,
    title: candidate.actionTypeLabel,
    reason:
      candidate.status === "in_progress"
        ? DeferralReasons.ALREADY_HANDLED
        : candidate.urgency === "low"
          ? DeferralReasons.NOT_TIME_SENSITIVE
          : DeferralReasons.LOWER_PRIORITY,
  }));
}

function approvalNeededDecision(
  input: MarketingDirectorInput,
  now: Date,
  primaryAction: MarketingDirectorPrimaryAction,
  rationale: string,
  confidenceLabel: MarketingDirectorDecision["confidenceLabel"],
  presentationPriority: number,
  signal: string,
): MarketingDirectorDecision {
  return {
    decisionType: MarketingDirectorDecisionTypes.APPROVAL_NEEDED,
    title: "Needs your opinion",
    summary:
      input.publishingReadyOrScheduled > 0
        ? "I finished preparing next week's content — when you have a few minutes, I'd like your opinion."
        : "I've prepared a few things for your opinion this week.",
    rationale,
    targetOutcome: "Steady, approved marketing output",
    confidenceLabel,
    requiresCustomerAction: true,
    primaryAction,
    deferred: buildDeferred(input.candidateRecommendations),
    supportingSignals: [signal],
    sourceRecommendationId: null,
    presentationPriority,
    evaluatedAt: now.toISOString(),
  };
}

export function resolveMarketingDirectorDecision(
  input: MarketingDirectorInput,
  now: Date = new Date(),
): MarketingDirectorDecision {
  if (!input.gbpConnected) {
    return {
      decisionType: MarketingDirectorDecisionTypes.MEANINGFUL_DECISION,
      title: "Needs your opinion",
      summary:
        "I'd like us to connect Google when you have a moment so I can keep improving your local visibility.",
      rationale:
        "Google Business Profile is not yet connected — most other marketing work depends on it.",
      targetOutcome: "Local search visibility",
      confidenceLabel: ConfidenceLabels.STRONG_RECOMMENDATION,
      requiresCustomerAction: true,
      primaryAction: {
        kind: "connect_google",
        label: "Finish Google connection",
        href: "/dashboard/google-business-profile/connect",
      },
      deferred: buildDeferred(input.candidateRecommendations),
      supportingSignals: ["gbpConnected:false"],
      sourceRecommendationId: null,
      presentationPriority: 100,
      evaluatedAt: now.toISOString(),
    };
  }

  if (input.pendingApprovals > 0) {
    return approvalNeededDecision(
      input,
      now,
      { kind: "approve_weekly_package", label: "Review This Week", href: "/dashboard/approvals" },
      `${input.pendingApprovals} draft${input.pendingApprovals === 1 ? "" : "s"} already prepared and waiting on your review.`,
      ConfidenceLabels.STRONG_RECOMMENDATION,
      95,
      `pendingApprovals:${input.pendingApprovals}`,
    );
  }

  if (input.openRecommendations > 0 && input.candidateRecommendations.length > 0) {
    const [top, ...remaining] = input.candidateRecommendations;
    const detail = input.topRecommendationDetail;
    return {
      decisionType: MarketingDirectorDecisionTypes.HIGH_VALUE_RECOMMENDATION,
      title: "Recommendation",
      summary: detail?.whyNow ?? "I found a recommendation worth a closer look when you're ready.",
      rationale:
        detail?.whyNow ??
        `A recommendation (${top!.actionTypeLabel}) is open and ranked highest for your business right now.`,
      targetOutcome: detail?.expectedBenefit ?? "Consistent, well-timed marketing presence",
      confidenceLabel: detail?.confidenceLabel ?? ConfidenceLabels.STILL_LEARNING,
      requiresCustomerAction: true,
      primaryAction: {
        kind: "review_recommendation",
        label: "Review Recommendation",
        href: "/dashboard/marketing-recommendations",
      },
      deferred: buildDeferred(remaining),
      supportingSignals: [`openRecommendations:${input.openRecommendations}`],
      sourceRecommendationId: detail?.recommendationId ?? top!.id,
      presentationPriority: 80,
      evaluatedAt: now.toISOString(),
    };
  }

  if (input.unansweredReviews > 0) {
    return approvalNeededDecision(
      input,
      now,
      { kind: "review_week", label: "Review This Week", href: "/dashboard/approvals" },
      `${input.unansweredReviews} customer review${input.unansweredReviews === 1 ? "" : "s"} still waiting on a reply.`,
      ConfidenceLabels.GOOD_OPPORTUNITY,
      70,
      `unansweredReviews:${input.unansweredReviews}`,
    );
  }

  // Nothing requires the customer's attention this cycle — pick the calmest truthful
  // thing to say. Never invents urgency or a customer action from here down.
  const deferred = buildDeferred(input.candidateRecommendations);

  if (input.seasonalHint) {
    return {
      decisionType: MarketingDirectorDecisionTypes.OPPORTUNITY,
      title: "Opportunity",
      summary: `I noticed a seasonal opportunity we should prepare for (${input.seasonalHint}).`,
      rationale: "A seasonal window is open and nothing more urgent is waiting.",
      targetOutcome: "Timely seasonal visibility",
      confidenceLabel: ConfidenceLabels.GOOD_OPPORTUNITY,
      requiresCustomerAction: false,
      primaryAction: NO_ACTION,
      deferred,
      supportingSignals: ["seasonalHint:present"],
      sourceRecommendationId: null,
      presentationPriority: 60,
      evaluatedAt: now.toISOString(),
    };
  }

  if (input.healthState === "excellent") {
    return {
      decisionType: MarketingDirectorDecisionTypes.CELEBRATION,
      title: "Celebration",
      summary: "Marketing Health looks excellent — everything is on track.",
      rationale: "Marketing Health is at its highest state and nothing is waiting on the customer.",
      targetOutcome: "Sustained marketing health",
      confidenceLabel: ConfidenceLabels.STRONG_RECOMMENDATION,
      requiresCustomerAction: false,
      primaryAction: NO_ACTION,
      deferred,
      supportingSignals: ["healthState:excellent"],
      sourceRecommendationId: null,
      presentationPriority: 50,
      evaluatedAt: now.toISOString(),
    };
  }

  if (input.weeklyWins.reviews > 0) {
    const n = input.weeklyWins.reviews;
    return {
      decisionType: MarketingDirectorDecisionTypes.CELEBRATION,
      title: "Celebration",
      summary: `We received ${n} new review${n === 1 ? "" : "s"} this week.`,
      rationale: "New reviews arrived and nothing more urgent is waiting.",
      targetOutcome: "Reputation growth",
      confidenceLabel: ConfidenceLabels.GOOD_OPPORTUNITY,
      requiresCustomerAction: false,
      primaryAction: NO_ACTION,
      deferred,
      supportingSignals: [`weeklyWins.reviews:${n}`],
      sourceRecommendationId: null,
      presentationPriority: 45,
      evaluatedAt: now.toISOString(),
    };
  }

  if (input.weeklyWins.views > 40) {
    return {
      decisionType: MarketingDirectorDecisionTypes.CELEBRATION,
      title: "Progress",
      summary: "Search visibility improved — I'm seeing steady profile interest.",
      rationale: "Profile views are trending up and nothing more urgent is waiting.",
      targetOutcome: "Search visibility",
      confidenceLabel: ConfidenceLabels.GOOD_OPPORTUNITY,
      requiresCustomerAction: false,
      primaryAction: NO_ACTION,
      deferred,
      supportingSignals: [`weeklyWins.views:${input.weeklyWins.views}`],
      sourceRecommendationId: null,
      presentationPriority: 40,
      evaluatedAt: now.toISOString(),
    };
  }

  if (input.publishingReadyOrScheduled > 0) {
    return {
      decisionType: MarketingDirectorDecisionTypes.REASSURANCE,
      title: "Progress",
      summary: `I've been working on ${input.focusTheme}, and I finished preparing content for the week ahead.`,
      rationale: "Content is already prepared and nothing requires customer attention.",
      targetOutcome: "Consistent presence",
      confidenceLabel: ConfidenceLabels.GOOD_OPPORTUNITY,
      requiresCustomerAction: false,
      primaryAction: NO_ACTION,
      deferred,
      supportingSignals: [`publishingReadyOrScheduled:${input.publishingReadyOrScheduled}`],
      sourceRecommendationId: null,
      presentationPriority: 35,
      evaluatedAt: now.toISOString(),
    };
  }

  if (input.isEarlyCustomer) {
    return {
      decisionType: MarketingDirectorDecisionTypes.REASSURANCE,
      title: "Progress",
      summary: `I've been learning your business and working on ${input.focusTheme}.`,
      rationale: "This is an early relationship — foundational learning is still in progress.",
      targetOutcome: "A strong foundation",
      confidenceLabel: ConfidenceLabels.STILL_LEARNING,
      requiresCustomerAction: false,
      primaryAction: NO_ACTION,
      deferred,
      supportingSignals: ["isEarlyCustomer:true"],
      sourceRecommendationId: null,
      presentationPriority: 30,
      evaluatedAt: now.toISOString(),
    };
  }

  if (input.healthState === "healthy") {
    return {
      decisionType: MarketingDirectorDecisionTypes.REASSURANCE,
      title: "Reassurance",
      summary: "Everything is on track. Nothing needs your attention today.",
      rationale: "Marketing Health is healthy and no signal requires customer attention.",
      targetOutcome: "Sustained marketing health",
      confidenceLabel: ConfidenceLabels.GOOD_OPPORTUNITY,
      requiresCustomerAction: false,
      primaryAction: NO_ACTION,
      deferred,
      supportingSignals: ["healthState:healthy"],
      sourceRecommendationId: null,
      presentationPriority: 25,
      evaluatedAt: now.toISOString(),
    };
  }

  if (input.healthState === "needs_attention") {
    return {
      decisionType: MarketingDirectorDecisionTypes.OPPORTUNITY,
      title: "Observation",
      summary:
        "I'd recommend a calm look at a couple of items when you have a moment — nothing to stress about.",
      rationale:
        "Marketing Health needs attention, but nothing is urgent enough to require an immediate decision.",
      targetOutcome: "Sustained marketing health",
      confidenceLabel: ConfidenceLabels.WORTH_CONSIDERING,
      requiresCustomerAction: false,
      primaryAction: NO_ACTION,
      deferred,
      supportingSignals: ["healthState:needs_attention"],
      sourceRecommendationId: null,
      presentationPriority: 20,
      evaluatedAt: now.toISOString(),
    };
  }

  // at_risk fallback — still calm, no fear language.
  return {
    decisionType: MarketingDirectorDecisionTypes.REASSURANCE,
    title: "Progress",
    summary: `I'm focusing on the foundations that make ${input.focusTheme} possible.`,
    rationale: "Marketing Health is at risk; the priority is stabilizing foundations before anything else.",
    targetOutcome: "A stable foundation",
    confidenceLabel: ConfidenceLabels.STILL_LEARNING,
    requiresCustomerAction: false,
    primaryAction: NO_ACTION,
    deferred,
    supportingSignals: ["healthState:at_risk"],
    sourceRecommendationId: null,
    presentationPriority: 10,
    evaluatedAt: now.toISOString(),
  };
}

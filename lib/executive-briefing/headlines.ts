/**
 * Deterministic executive headlines — rule table only, no LLM.
 */

import type { MarketingDirectorDecision } from "@/lib/marketing-director/types";
import { MarketingDirectorDecisionTypes } from "@/lib/marketing-director/types";
import type { MarketingHealthState } from "@/lib/head-of-marketing/types";
import type { CommandCenterWeeklyWins } from "@/lib/command-center/types";

export type HeadlineInput = {
  decision: MarketingDirectorDecision;
  healthState: MarketingHealthState;
  weeklyWins: CommandCenterWeeklyWins;
  pendingApprovals: number;
  unansweredReviews: number;
  openRecommendations: number;
  seasonalHint: string | null;
  gbpConnected: boolean;
};

/**
 * One executive headline from the already-resolved Marketing Director decision and
 * supporting counts. Order mirrors MD precedence so the headline never contradicts
 * the primary CTA.
 */
export function buildExecutiveHeadline(input: HeadlineInput): string {
  if (!input.gbpConnected) {
    return "Google connection is the next foundational step.";
  }

  if (input.pendingApprovals > 0) {
    return input.pendingApprovals === 1
      ? "One item is waiting on your opinion today."
      : `${input.pendingApprovals} items are waiting on your opinion today.`;
  }

  if (
    input.decision.decisionType === MarketingDirectorDecisionTypes.HIGH_VALUE_RECOMMENDATION
  ) {
    return "There's a recommendation worth a closer look today.";
  }

  if (input.unansweredReviews > 0) {
    return input.unansweredReviews === 1
      ? "Reviews need attention today."
      : `${input.unansweredReviews} reviews need attention today.`;
  }

  if (input.seasonalHint) {
    return "A seasonal opportunity is approaching.";
  }

  if (input.healthState === "excellent" || input.weeklyWins.reviews > 0) {
    return "Strong momentum heading into the next stretch.";
  }

  if (input.weeklyWins.views > 40) {
    return "Search visibility is moving in the right direction.";
  }

  if (input.openRecommendations > 0) {
    return "A few marketing opportunities are ready when you are.";
  }

  if (input.healthState === "needs_attention" || input.healthState === "at_risk") {
    return "A calm check-in will keep things on track.";
  }

  return "Everything is on track — nothing urgent today.";
}

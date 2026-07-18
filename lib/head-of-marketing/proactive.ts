import type { CommandCenterWeeklyWins } from "@/lib/command-center/types";
import type { MarketingHealthState } from "@/lib/head-of-marketing/types";
import type { MonthlyFocus } from "@/lib/head-of-marketing/monthlyFocusTypes";
import type {
  MarketingDirectorDecision,
  MarketingDirectorDecisionType,
} from "@/lib/marketing-director/types";
import { MarketingDirectorDecisionTypes } from "@/lib/marketing-director/types";
import type {
  ProactiveCelebration,
  ProactiveMoment,
  ProactiveMomentPurpose,
  ProactivePresence,
} from "@/lib/head-of-marketing/proactiveTypes";

export type ProactiveInput = {
  healthState: MarketingHealthState;
  gbpConnected: boolean;
  unansweredReviews: number;
  pendingApprovals: number;
  openRecommendations: number;
  publishingReadyOrScheduled: number;
  weeklyWins: CommandCenterWeeklyWins;
  seasonalHint: string | null;
  monthlyFocus: MonthlyFocus;
  isEarlyCustomer: boolean;
  /**
   * The single shared decision computed once by weeklyBriefing.ts via
   * resolveMarketingDirectorDecision — this module no longer independently decides
   * what's most important. See lib/marketing-director/resolveDecision.ts.
   */
  decision: MarketingDirectorDecision;
  now?: Date;
};

/** Maps the shared decision's type to this module's own presentational voice — a fixed
 * lookup, not a precedence decision. The decision itself already decided what matters;
 * this only picks which tone-of-voice bucket to render it in. */
const PURPOSE_BY_DECISION_TYPE: Record<MarketingDirectorDecisionType, ProactiveMomentPurpose> = {
  [MarketingDirectorDecisionTypes.MEANINGFUL_DECISION]: "decision",
  [MarketingDirectorDecisionTypes.APPROVAL_NEEDED]: "decision",
  [MarketingDirectorDecisionTypes.HIGH_VALUE_RECOMMENDATION]: "opportunity",
  [MarketingDirectorDecisionTypes.OPPORTUNITY]: "opportunity",
  [MarketingDirectorDecisionTypes.REASSURANCE]: "reassure",
  [MarketingDirectorDecisionTypes.CELEBRATION]: "celebrate",
};

/**
 * Thin formatter — adapts the shared Marketing Director decision into this surface's
 * presentation shape. Does not reprioritize, does not apply a separate precedence
 * model, does not choose a different primary item, and does not invent rationale beyond
 * what the decision already carries.
 */
function derivePrimaryMoment(decision: MarketingDirectorDecision): ProactiveMoment {
  return {
    purpose: PURPOSE_BY_DECISION_TYPE[decision.decisionType],
    label: decision.title,
    message: decision.summary,
  };
}

function buildCelebrations(input: ProactiveInput): ProactiveCelebration[] {
  const out: ProactiveCelebration[] = [];

  if (input.healthState === "excellent") {
    out.push({ message: "Marketing Health reached Excellent." });
  }

  if (input.weeklyWins.reviews >= 3) {
    out.push({
      message: `We received ${input.weeklyWins.reviews} new reviews this week.`,
    });
  }

  if (input.weeklyWins.views > 100) {
    out.push({ message: "Search visibility improved." });
  }

  if (
    input.monthlyFocus.sourcedFromPlan &&
    (input.healthState === "excellent" || input.healthState === "healthy") &&
    input.pendingApprovals === 0
  ) {
    out.push({ message: "This month's focus is on track." });
  }

  if (input.publishingReadyOrScheduled > 0 && input.pendingApprovals === 0) {
    out.push({ message: "I finished preparing next week's content." });
  }

  // Cap — confidence, not a badge wall
  return out.slice(0, 3);
}

function buildMoreUpdates(input: ProactiveInput, primary: ProactiveMoment): string[] {
  const updates: string[] = [];

  if (input.healthState === "healthy" || input.healthState === "excellent") {
    updates.push("Everything looks healthy. I'll continue monitoring things.");
  }

  if (input.unansweredReviews === 0 && input.weeklyWins.reviews === 0 && input.gbpConnected) {
    updates.push("Nothing needs your attention on reputation today.");
  }

  if (input.openRecommendations > 0 && primary.purpose !== "opportunity") {
    updates.push("I noticed a few ideas worth a calm look when you're ready.");
  }

  if (input.publishingReadyOrScheduled > 0 && !primary.message.includes("preparing")) {
    updates.push("I've been preparing updates so your presence stays consistent.");
  }

  if (input.pendingApprovals === 0 && primary.purpose !== "decision") {
    updates.push("Nothing needs your attention today unless you'd like a look around.");
  }

  // Dedupe against primary message fragments
  const primaryLower = primary.message.toLowerCase();
  return updates
    .filter((line) => !primaryLower.includes(line.slice(0, 24).toLowerCase()))
    .slice(0, 4);
}

/**
 * Pure proactive presence orchestrator.
 * Reuses Weekly Briefing / Monthly Focus / Health / wins signals — no new engines.
 */
export function buildProactivePresence(input: ProactiveInput): ProactivePresence {
  const primary = derivePrimaryMoment(input.decision);
  const celebrations = buildCelebrations(input).filter(
    (c) => !primary.message.toLowerCase().includes(c.message.slice(0, 20).toLowerCase()),
  );
  const moreUpdates = buildMoreUpdates(input, primary);

  return {
    primary,
    celebrations,
    moreUpdates,
  };
}

export { PROACTIVE_FORBIDDEN_TERMS } from "@/lib/head-of-marketing/proactiveTypes";

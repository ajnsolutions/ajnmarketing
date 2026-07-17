import type { CommandCenterWeeklyWins } from "@/lib/command-center/types";
import type { MarketingHealthState } from "@/lib/head-of-marketing/types";
import type { MonthlyFocus } from "@/lib/head-of-marketing/monthlyFocusTypes";
import type {
  ProactiveCelebration,
  ProactiveMoment,
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
  primaryActionKind: "review_week" | "approve_weekly_package" | "review_recommendation" | "connect_google" | "none";
  now?: Date;
};

function timeGreeting(now = new Date()): "Good morning" | "Good afternoon" | "Good evening" {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function focusTheme(monthlyFocus: MonthlyFocus): string {
  const first = monthlyFocus.priorities[0]?.label?.trim();
  if (!first) return "your marketing";
  return first.charAt(0).toLowerCase() + first.slice(1);
}

/**
 * Pick one primary proactive moment.
 * Hierarchy: meaningful decision → opportunity → celebration → progress → reassurance.
 * Never invents urgency.
 */
function buildPrimary(input: ProactiveInput, now: Date): ProactiveMoment {
  const hello = timeGreeting(now);
  const theme = focusTheme(input.monthlyFocus);

  if (input.primaryActionKind === "connect_google" || !input.gbpConnected) {
    return {
      purpose: "decision",
      label: "Needs your opinion",
      message: `${hello}! I'd like us to connect Google when you have a moment so I can keep improving your local visibility.`,
    };
  }

  if (input.pendingApprovals > 0 || input.primaryActionKind === "approve_weekly_package" || input.primaryActionKind === "review_week") {
    return {
      purpose: "decision",
      label: "Needs your opinion",
      message:
        input.publishingReadyOrScheduled > 0
          ? `${hello}! I finished preparing next week's content — when you have a few minutes, I'd like your opinion.`
          : `${hello}! I've prepared a few things for your opinion this week.`,
    };
  }

  if (input.seasonalHint) {
    return {
      purpose: "opportunity",
      label: "Opportunity",
      message: `${hello}! I noticed a seasonal opportunity we should prepare for (${input.seasonalHint}).`,
    };
  }

  if (input.healthState === "excellent") {
    return {
      purpose: "celebrate",
      label: "Celebration",
      message: `${hello}! Marketing Health looks excellent — everything is on track.`,
    };
  }

  if (input.weeklyWins.reviews > 0) {
    const n = input.weeklyWins.reviews;
    return {
      purpose: "celebrate",
      label: "Celebration",
      message: `${hello}! We received ${n} new review${n === 1 ? "" : "s"} this week.`,
    };
  }

  if (input.weeklyWins.views > 40) {
    return {
      purpose: "celebrate",
      label: "Progress",
      message: `${hello}! Search visibility improved — I'm seeing steady profile interest.`,
    };
  }

  if (input.publishingReadyOrScheduled > 0) {
    return {
      purpose: "reassure",
      label: "Progress",
      message: `${hello}! I've been working on ${theme}, and I finished preparing content for the week ahead.`,
    };
  }

  if (input.isEarlyCustomer) {
    return {
      purpose: "reassure",
      label: "Progress",
      message: `${hello}! I've been learning your business and working on ${theme}.`,
    };
  }

  if (input.healthState === "healthy") {
    return {
      purpose: "reassure",
      label: "Reassurance",
      message: `${hello}! Everything is on track. Nothing needs your attention today.`,
    };
  }

  if (input.healthState === "needs_attention") {
    return {
      purpose: "opportunity",
      label: "Observation",
      message: `${hello}! I'd recommend a calm look at a couple of items when you have a moment — nothing to stress about.`,
    };
  }

  // at_risk — still calm, no fear language
  return {
    purpose: "reassure",
    label: "Progress",
    message: `${hello}! I'm focusing on the foundations that make ${theme} possible.`,
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
  const now = input.now ?? new Date();
  const primary = buildPrimary(input, now);
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

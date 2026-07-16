import { parseDeferredConnections } from "@/lib/onboarding-storage";
import type { CommandCenterBusinessHealth, CommandCenterWeeklyWins } from "@/lib/command-center/types";
import { resolveMarketingHealth } from "@/lib/head-of-marketing/marketingHealth";
import type {
  HeadOfMarketingBriefing,
  HeadOfMarketingPrimaryAction,
} from "@/lib/head-of-marketing/types";

export type HeadOfMarketingBriefingInput = {
  userName: string;
  businessName: string;
  websiteUrl: string | null;
  voiceNotes: string | null;
  gbpConnected: boolean;
  unansweredReviews: number;
  pendingApprovals: number;
  openRecommendations: number;
  publishFailures: number;
  publishingReadyOrScheduled: number;
  businessHealth: CommandCenterBusinessHealth;
  weeklyWins: CommandCenterWeeklyWins;
  planSummary: string | null;
  topPriorityTitle: string | null;
  now?: Date;
};

function firstNameFrom(userName: string): string {
  const trimmed = userName.trim();
  if (!trimmed) return "there";
  return trimmed.split(/\s+/)[0] ?? "there";
}

function timeOfDayGreeting(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function buildAccomplishments(input: HeadOfMarketingBriefingInput): string[] {
  const items: string[] = [];
  const wins = input.weeklyWins;

  if (wins.posts > 0) {
    items.push(`I published ${wins.posts} update${wins.posts === 1 ? "" : "s"}.`);
  }
  if (wins.reviews > 0) {
    items.push(`I tracked ${wins.reviews} new review${wins.reviews === 1 ? "" : "s"}.`);
  }
  if (wins.tasksCompleted > 0) {
    items.push(`I completed ${wins.tasksCompleted} marketing task${wins.tasksCompleted === 1 ? "" : "s"}.`);
  }
  if (input.publishingReadyOrScheduled > 0) {
    items.push(
      `I'm preparing ${input.publishingReadyOrScheduled} item${input.publishingReadyOrScheduled === 1 ? "" : "s"} for the week.`,
    );
  }
  if (wins.views > 0) {
    items.push(`I noticed ${wins.views.toLocaleString()} profile views coming in.`);
  }
  if (input.planSummary) {
    items.push("I kept your monthly plan moving forward.");
  }

  if (items.length === 0) {
    if (input.gbpConnected) {
      items.push("I'm already learning your business and preparing this week's work.");
    } else {
      items.push("I'm getting set up so I can start handling marketing for you.");
    }
  }

  return items.slice(0, 4);
}

function buildNoticed(input: HeadOfMarketingBriefingInput): string[] {
  const noticed: string[] = [];

  if (!input.gbpConnected) {
    noticed.push("Connecting Google will unlock local posts and review replies.");
  }
  if (input.pendingApprovals > 0) {
    noticed.push(
      `${input.pendingApprovals} draft${input.pendingApprovals === 1 ? "" : "s"} ready for your opinion.`,
    );
  }
  if (input.unansweredReviews > 0) {
    noticed.push("A customer is waiting on a thoughtful reply.");
  }
  if (input.openRecommendations > 0 && input.pendingApprovals === 0) {
    noticed.push("I found a few opportunities worth a quick look.");
  }
  if (noticed.length === 0) {
    noticed.push("Nothing urgent — momentum looks steady.");
  }

  return noticed.slice(0, 3);
}

function buildRecommendation(input: HeadOfMarketingBriefingInput): {
  title: string;
  why: string;
} | null {
  if (!input.gbpConnected) {
    return {
      title: "Finish connecting Google",
      why: "That lets me keep your local presence accurate without you chasing it.",
    };
  }
  if (input.pendingApprovals > 0) {
    return {
      title: "Review this week's drafts",
      why: "A few minutes from you keeps everything moving — I'll handle the rest.",
    };
  }
  if (input.topPriorityTitle) {
    return {
      title: input.topPriorityTitle,
      why: "Here's what I'd recommend next so we keep showing up consistently.",
    };
  }
  if (input.openRecommendations > 0) {
    return {
      title: "Look at what I'd recommend next",
      why: "I spotted something that can help customers find and trust you.",
    };
  }
  if (input.planSummary) {
    return {
      title: "Stay the course on this month's plan",
      why: input.planSummary,
    };
  }
  return null;
}

function buildPrimaryAction(
  input: HeadOfMarketingBriefingInput,
): HeadOfMarketingPrimaryAction {
  if (!input.gbpConnected) {
    return {
      kind: "connect_google",
      label: "Finish Google connection",
      href: "/dashboard/google-business-profile/connect",
    };
  }
  if (input.pendingApprovals > 0 || input.openRecommendations > 0 || input.unansweredReviews > 0) {
    return {
      kind: "review_week",
      label: "Review This Week",
      href: "/dashboard/approvals",
    };
  }
  return {
    kind: "none",
    label: "Nothing needs your attention today",
    href: "/dashboard",
  };
}

function buildMagicMoment(
  actionKind: HeadOfMarketingPrimaryAction["kind"],
  healthState: string,
): string | null {
  if (actionKind === "none") {
    if (healthState === "excellent") {
      return "Everything looks great. I've got this. Go enjoy your day.";
    }
    return "Nothing needs your attention today. I'll let you know when I need you.";
  }
  if (healthState === "healthy") {
    return "I've got this — just a quick check-in when you have a minute.";
  }
  return null;
}

function estimateReviewMinutes(input: HeadOfMarketingBriefingInput): number {
  if (!input.gbpConnected) return 2;
  const items = input.pendingApprovals + Math.min(input.unansweredReviews, 2);
  if (items <= 0) return 0;
  if (items === 1) return 2;
  if (items === 2) return 3;
  return Math.min(8, 2 + items);
}

/**
 * Pure presentation orchestrator: one customer briefing from existing signals.
 * Does not call recommendation, planning, or analytics engines.
 */
export function buildHeadOfMarketingBriefing(
  input: HeadOfMarketingBriefingInput,
): HeadOfMarketingBriefing {
  const deferred = parseDeferredConnections(input.voiceNotes ?? "");
  const isEarlyCustomer =
    !input.gbpConnected ||
    deferred.facebookSkipped ||
    deferred.instagramSkipped ||
    deferred.linkedinSkipped;

  const health = resolveMarketingHealth({
    overallScore: input.businessHealth.overall,
    gbpConnected: input.gbpConnected,
    pendingApprovals: input.pendingApprovals,
    unansweredReviews: input.unansweredReviews,
    publishFailures: input.publishFailures,
    openRecommendations: input.openRecommendations,
  });

  const primaryAction = buildPrimaryAction(input);
  const name = firstNameFrom(input.userName);
  const greeting = `${timeOfDayGreeting(input.now)}, ${name}.`;
  const lead = isEarlyCustomer
    ? "I'm getting started on your marketing..."
    : "While you were running your business...";

  return {
    greeting,
    lead,
    health,
    accomplishments: buildAccomplishments(input),
    noticed: buildNoticed(input),
    recommendation: buildRecommendation(input),
    primaryAction,
    estimatedReviewMinutes: estimateReviewMinutes(input),
    magicMoment: buildMagicMoment(primaryAction.kind, health.state),
    isEarlyCustomer,
    businessName: input.businessName || "your business",
  };
}

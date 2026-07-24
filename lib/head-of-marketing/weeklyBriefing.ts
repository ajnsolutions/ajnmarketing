import { parseDeferredConnections } from "@/lib/onboarding-storage";
import type {
  CommandCenterBusinessHealth,
  CommandCenterCalendarItem,
  CommandCenterWeeklyWins,
} from "@/lib/command-center/types";
import { buildHeadOfMarketingJournal } from "@/lib/head-of-marketing/journal";
import { buildMonthlyFocus } from "@/lib/head-of-marketing/monthlyFocus";
import { buildProactivePresence } from "@/lib/head-of-marketing/proactive";
import { resolveMarketingHealth } from "@/lib/head-of-marketing/marketingHealth";
import type {
  BriefingCadenceSupport,
  HeadOfMarketingBriefing,
  HeadOfMarketingPrimaryAction,
  WeeklyBriefingRecommendation,
} from "@/lib/head-of-marketing/types";
import type { MonthlyFocus } from "@/lib/head-of-marketing/monthlyFocusTypes";
import {
  buildMonthlyExecutiveReport,
  buildMorningBrief,
  buildWeeklyStrategyBrief,
} from "@/lib/executive-briefing/buildBrief";
import { resolveMarketingDirectorDecision } from "@/lib/marketing-director/resolveDecision";
import type {
  MarketingDirectorCandidate,
  MarketingDirectorTopRecommendationDetail,
} from "@/lib/marketing-director/types";
import type { MarketingMemoryEvidencePackage } from "@/lib/marketing-memory/evidenceTypes";

export type WeeklyBriefingInput = {
  userName: string;
  businessName: string;
  websiteUrl: string | null;
  voiceNotes: string | null;
  profileCreatedAt: string | null;
  gbpConnected: boolean;
  unansweredReviews: number;
  pendingApprovals: number;
  openRecommendations: number;
  publishFailures: number;
  publishingReadyOrScheduled: number;
  businessHealth: CommandCenterBusinessHealth;
  weeklyWins: CommandCenterWeeklyWins;
  planSummary: string | null;
  marketingThemes: string[];
  businessGoals: string[];
  seasonalHint: string | null;
  topPriorityTitle: string | null;
  upcomingCalendar: CommandCenterCalendarItem[];
  competitorWatchMessage: string | null;
  /** Ranked, active recommendations for this business (already scored upstream) — see
   * lib/marketing-director/types.ts. Defaults to empty when the caller has none loaded. */
  candidateRecommendations?: MarketingDirectorCandidate[];
  /** Existing recommendation-presentation explainability for candidateRecommendations[0],
   * when already fetched by the caller. Never recomputed here. */
  topRecommendationDetail?: MarketingDirectorTopRecommendationDetail | null;
  /** Optional Marketing Memory evidence — null/omitted preserves pre-Phase-4 decisions. */
  memoryEvidence?: MarketingMemoryEvidencePackage | null;
  now?: Date;
};

/** Plain-language Monthly Focus theme reused across the reassurance/opportunity copy
 * both here and in the Marketing Director decision — never a second planning concept. */
function focusTheme(monthlyFocus: MonthlyFocus): string {
  const first = monthlyFocus.priorities[0]?.label?.trim();
  if (!first) return "your marketing";
  return first.charAt(0).toLowerCase() + first.slice(1);
}

const CADENCE: BriefingCadenceSupport = {
  supportedStyles: ["hands_on", "weekly", "monthly", "trusted"],
  activeCadence: "weekly",
  note: "Weekly Briefing is the foundation for future management styles. Cadence and depth will adapt; engines stay shared.",
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

function buildThisWeek(input: WeeklyBriefingInput): string[] {
  const items: string[] = [];
  const wins = input.weeklyWins;

  if (wins.posts > 0) {
    items.push(`Published ${wins.posts} update${wins.posts === 1 ? "" : "s"}.`);
  }
  if (wins.reviews > 0) {
    items.push(`Monitored ${wins.reviews} new review${wins.reviews === 1 ? "" : "s"}.`);
  }
  if (input.unansweredReviews === 0 && wins.reviews > 0) {
    items.push("Replied where customers needed a response — or kept replies ready for you.");
  }
  if (input.publishingReadyOrScheduled > 0) {
    items.push(
      `Prepared ${input.publishingReadyOrScheduled} item${input.publishingReadyOrScheduled === 1 ? "" : "s"} for the week ahead.`,
    );
  }
  if (wins.tasksCompleted > 0) {
    items.push(`Improved momentum with ${wins.tasksCompleted} completed marketing task${wins.tasksCompleted === 1 ? "" : "s"}.`);
  }
  if (wins.views > 0) {
    items.push(`Monitored ${wins.views.toLocaleString()} profile views.`);
  }
  if (input.planSummary) {
    items.push("Kept this month's plan moving quietly in the background.");
  }

  if (items.length === 0) {
    if (input.gbpConnected) {
      items.push("Prepared the foundations for this week's marketing work.");
    } else {
      items.push("Started learning your business so I can take ownership.");
    }
  }

  return items.slice(0, 5);
}

function buildNoticed(input: WeeklyBriefingInput): string[] {
  const noticed: string[] = [];

  if (!input.gbpConnected) {
    noticed.push("Search visibility: connecting Google unlocks local discovery work.");
  } else if (input.weeklyWins.views > 0) {
    noticed.push("Search visibility: customers are finding your profile.");
  }

  if (input.unansweredReviews > 0) {
    noticed.push("Review trends: a customer is waiting on a thoughtful reply.");
  } else if (input.weeklyWins.reviews > 0) {
    noticed.push("Review trends: new feedback arrived — I'm watching reputation closely.");
  }

  if (
    input.competitorWatchMessage &&
    !/not connected yet/i.test(input.competitorWatchMessage)
  ) {
    noticed.push(`Competitor activity: ${input.competitorWatchMessage}`);
  }

  if (input.seasonalHint) {
    noticed.push(`Seasonal opportunities: ${input.seasonalHint}`);
  }

  if (input.pendingApprovals > 0) {
    noticed.push(
      `Community & content: ${input.pendingApprovals} draft${input.pendingApprovals === 1 ? "" : "s"} ready for your opinion.`,
    );
  }

  if (noticed.length === 0) {
    noticed.push("Nothing urgent — momentum looks steady across the week.");
  }

  return noticed.slice(0, 5);
}

function buildRecommendation(input: WeeklyBriefingInput): WeeklyBriefingRecommendation | null {
  if (!input.gbpConnected) {
    return {
      title: "Finish connecting Google",
      why: "That lets me keep your local presence accurate without you chasing it.",
      expectedBenefit: "I can prepare posts and review replies on your behalf.",
    };
  }
  if (input.pendingApprovals > 0) {
    return {
      title: "Review this week's drafts",
      why: "A few minutes from you keeps everything moving — I'll handle the rest.",
      expectedBenefit: "Approved work can move into publishing without further setup from you.",
    };
  }
  if (input.topPriorityTitle) {
    return {
      title: input.topPriorityTitle,
      why: "Here's what I'd recommend next so we keep showing up consistently.",
      expectedBenefit: "Steady presence compounds trust with the customers you want.",
    };
  }
  if (input.openRecommendations > 0) {
    return {
      title: "Look at what I'd recommend next",
      why: "I spotted something that can help customers find and trust you.",
      expectedBenefit: "One focused action beats a long list of options.",
    };
  }
  if (input.planSummary) {
    return {
      title: "Stay the course on this month's plan",
      why: input.planSummary,
      expectedBenefit: "Consistency this month makes next month easier.",
    };
  }
  return null;
}

function buildNextWeek(input: WeeklyBriefingInput): string[] {
  const items: string[] = [];

  for (const day of input.upcomingCalendar.slice(0, 3)) {
    items.push(`${day.dateLabel}: ${day.title}`);
  }

  if (input.publishingReadyOrScheduled > 0) {
    items.push("I'll keep preparing and sequencing what's already in motion.");
  }

  if (input.planSummary) {
    items.push("I'll continue the monthly plan unless something more urgent appears.");
  }

  if (!input.gbpConnected) {
    items.push("Once Google is connected, I'll expand local posts and review support.");
  }

  if (items.length === 0) {
    items.push("I've already started preparing next week — quietly, in the background.");
  }

  return items.slice(0, 4);
}

function buildRelationshipMemory(
  profileCreatedAt: string | null,
  now = new Date(),
): string | null {
  if (!profileCreatedAt) return null;
  const created = new Date(profileCreatedAt);
  if (Number.isNaN(created.getTime())) return null;

  const days = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 7) {
    return "This is our first week working together — I'll keep things simple.";
  }
  if (days < 45) {
    return "Since we started earlier this month, I've been learning how you like to show up.";
  }

  const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(
    created,
  );
  return `Since we began working together in ${monthLabel}, I've been building on what we already know.`;
}

function estimateReviewMinutes(input: WeeklyBriefingInput): number {
  if (!input.gbpConnected) return 2;
  const items = input.pendingApprovals + Math.min(input.unansweredReviews, 2);
  if (items <= 0 && input.openRecommendations > 0) return 3;
  if (items <= 0) return 0;
  if (items === 1) return 2;
  if (items === 2) return 3;
  return Math.min(8, 2 + items);
}

function timeRespectLabel(minutes: number, actionKind: HeadOfMarketingPrimaryAction["kind"]): string {
  if (actionKind === "none" || minutes <= 0) return "Nothing to review";
  if (minutes === 1) return "1 minute";
  return `${minutes} minutes`;
}

function buildMagicMoment(
  actionKind: HeadOfMarketingPrimaryAction["kind"],
  healthState: string,
): string | null {
  if (actionKind === "none") {
    if (healthState === "excellent") {
      return "Everything is under control. Go enjoy your week.";
    }
    return "Nothing urgent today. I'll let you know if anything changes.";
  }
  if (healthState === "healthy" || healthState === "excellent") {
    return "I've already started preparing next week.";
  }
  return null;
}

/**
 * Pure Weekly Briefing orchestrator.
 * Summarizes existing signals — does not replace recommendation, analytics, publishing, or planning engines.
 */
export function buildWeeklyBriefing(input: WeeklyBriefingInput): HeadOfMarketingBriefing {
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

  const estimatedReviewMinutes = estimateReviewMinutes(input);
  const name = firstNameFrom(input.userName);
  const greeting = `${timeOfDayGreeting(input.now)}, ${name}.`;

  const journal = buildHeadOfMarketingJournal({
    gbpConnected: input.gbpConnected,
    unansweredReviews: input.unansweredReviews,
    pendingApprovals: input.pendingApprovals,
    openRecommendations: input.openRecommendations,
    publishFailures: input.publishFailures,
    publishingReadyOrScheduled: input.publishingReadyOrScheduled,
    businessHealth: input.businessHealth,
    healthState: health.state,
    weeklyWins: input.weeklyWins,
    planSummary: input.planSummary,
    seasonalHint: input.seasonalHint,
    topPriorityTitle: input.topPriorityTitle,
    profileCreatedAt: input.profileCreatedAt,
    websiteUrl: input.websiteUrl,
    estimatedReviewMinutes,
    isEarlyCustomer,
    now: input.now,
  });

  const monthlyFocus = buildMonthlyFocus({
    gbpConnected: input.gbpConnected,
    unansweredReviews: input.unansweredReviews,
    openRecommendations: input.openRecommendations,
    healthState: health.state,
    planSummary: input.planSummary,
    marketingThemes: input.marketingThemes,
    businessGoals: input.businessGoals,
    seasonalHint: input.seasonalHint,
    isEarlyCustomer,
    now: input.now,
  });

  const healthWithFocus = {
    ...health,
    reason: `${monthlyFocus.progressLine} ${health.reason}`,
  };

  // Single shared decision — buildPrimaryAction's CTA and the proactive presence's
  // primary moment are both thin consumers of this one value from here on. Neither
  // independently decides what matters most anymore. See
  // lib/marketing-director/resolveDecision.ts and docs/MARKETING_DIRECTOR_FOUNDATION.md.
  const decision = resolveMarketingDirectorDecision(
    {
      gbpConnected: input.gbpConnected,
      pendingApprovals: input.pendingApprovals,
      unansweredReviews: input.unansweredReviews,
      openRecommendations: input.openRecommendations,
      publishingReadyOrScheduled: input.publishingReadyOrScheduled,
      healthState: health.state,
      weeklyWins: input.weeklyWins,
      seasonalHint: input.seasonalHint,
      focusTheme: focusTheme(monthlyFocus),
      isEarlyCustomer,
      candidateRecommendations: input.candidateRecommendations ?? [],
      topRecommendationDetail: input.topRecommendationDetail ?? null,
      memoryEvidence: input.memoryEvidence ?? null,
    },
    input.now,
  );

  const primaryAction: HeadOfMarketingPrimaryAction = decision.primaryAction;

  const proactive = buildProactivePresence({
    healthState: health.state,
    gbpConnected: input.gbpConnected,
    unansweredReviews: input.unansweredReviews,
    pendingApprovals: input.pendingApprovals,
    openRecommendations: input.openRecommendations,
    publishingReadyOrScheduled: input.publishingReadyOrScheduled,
    weeklyWins: input.weeklyWins,
    seasonalHint: input.seasonalHint,
    monthlyFocus,
    isEarlyCustomer,
    decision,
    now: input.now,
  });

  const thisWeek = buildThisWeek(input);
  const noticed = buildNoticed(input);

  // Executive Briefs summarize the same MD decision + signals — never a second
  // prioritization pass. All three types are built; only Morning is surfaced.
  // See docs/EXECUTIVE_BRIEFING_ENGINE.md.
  const briefInput = {
    decision,
    healthState: health.state,
    weeklyWins: input.weeklyWins,
    pendingApprovals: input.pendingApprovals,
    unansweredReviews: input.unansweredReviews,
    openRecommendations: input.openRecommendations,
    publishingReadyOrScheduled: input.publishingReadyOrScheduled,
    seasonalHint: input.seasonalHint,
    gbpConnected: input.gbpConnected,
    focusTheme: focusTheme(monthlyFocus),
    businessName: input.businessName || "your business",
    candidateRecommendations: input.candidateRecommendations ?? [],
    memoryEvidence: input.memoryEvidence ?? null,
    thisWeekHandled: thisWeek,
    noticed,
    now: input.now,
  };
  const executiveBriefs = {
    morning: buildMorningBrief(briefInput),
    weeklyStrategy: buildWeeklyStrategyBrief(briefInput),
    monthlyExecutive: buildMonthlyExecutiveReport(briefInput),
  };

  return {
    experienceTitle: "Weekly Briefing",
    greeting,
    lead: proactive.primary.message,
    health: healthWithFocus,
    thisWeek,
    noticed,
    recommendation: buildRecommendation(input),
    nextWeek: buildNextWeek(input),
    relationshipMemory: buildRelationshipMemory(input.profileCreatedAt, input.now),
    primaryAction,
    estimatedReviewMinutes,
    timeRespectLabel: timeRespectLabel(estimatedReviewMinutes, primaryAction.kind),
    magicMoment: buildMagicMoment(primaryAction.kind, health.state),
    isEarlyCustomer,
    businessName: input.businessName || "your business",
    cadence: CADENCE,
    journal,
    monthlyFocus,
    proactive,
    executiveBrief: executiveBriefs.morning,
    executiveBriefs,
    /** Filled by the HoM service from Campaign Intelligence — empty in pure composition. */
    campaigns: [],
    /** Filled by the HoM service from Experimentation Engine — empty in pure composition. */
    experiments: { pendingProposals: [], active: [], completed: [] },
    /** Filled by the HoM service from Strategic Marketing Calendar aggregation. */
    calendarPreview: null,
    /** Filled by the HoM service from Decision Intelligence. */
    whyPlanChanged: null,
    confidence: {
      pendingApprovals: input.pendingApprovals,
      publishFailures: input.publishFailures,
      openRecommendations: input.openRecommendations,
      publishingReadyOrScheduled: input.publishingReadyOrScheduled,
      weeklyPublishedPosts: input.weeklyWins.posts,
      weeklyNewReviews: input.weeklyWins.reviews,
      gbpConnected: input.gbpConnected,
      hasMarketingPlan: Boolean(input.planSummary?.trim()),
      profileCreatedAt: input.profileCreatedAt,
    },
    internalDecision: decision,
  };
}

/** @deprecated Prefer buildWeeklyBriefing — kept as a thin alias for existing imports/tests. */
export function buildHeadOfMarketingBriefing(
  input: WeeklyBriefingInput,
): HeadOfMarketingBriefing {
  return buildWeeklyBriefing(input);
}

/** Back-compat export name used by older tests. */
export type HeadOfMarketingBriefingInput = WeeklyBriefingInput;

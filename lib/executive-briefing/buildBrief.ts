/**
 * Pure Executive Brief builders. Summarize existing signals + Marketing Director
 * decision — never re-prioritize, never invent recommendations.
 */

import type { CommandCenterWeeklyWins } from "@/lib/command-center/types";
import type { MarketingHealthState } from "@/lib/head-of-marketing/types";
import type { MarketingDirectorCandidate, MarketingDirectorDecision } from "@/lib/marketing-director/types";
import type { MarketingMemoryEvidencePackage } from "@/lib/marketing-memory/evidenceTypes";
import { buildExecutiveHeadline } from "@/lib/executive-briefing/headlines";
import {
  ExecutiveBriefTypes,
  ExecutiveEvidenceKinds,
  type ExecutiveBrief,
  type ExecutiveBriefItem,
  type ExecutiveBriefType,
  type ExecutiveSupportingEvidence,
} from "@/lib/executive-briefing/types";

export type BuildExecutiveBriefInput = {
  briefType: ExecutiveBriefType;
  decision: MarketingDirectorDecision;
  healthState: MarketingHealthState;
  weeklyWins: CommandCenterWeeklyWins;
  pendingApprovals: number;
  unansweredReviews: number;
  openRecommendations: number;
  publishingReadyOrScheduled: number;
  seasonalHint: string | null;
  gbpConnected: boolean;
  focusTheme: string;
  businessName: string;
  candidateRecommendations: MarketingDirectorCandidate[];
  memoryEvidence: MarketingMemoryEvidencePackage | null;
  thisWeekHandled: string[];
  noticed: string[];
  now?: Date;
};

function item(text: string): ExecutiveBriefItem {
  return { text };
}

function buildSummary(input: BuildExecutiveBriefInput): string {
  const sentences: string[] = [];
  const name = input.businessName.trim() || "your business";

  if (!input.gbpConnected) {
    sentences.push(
      `For ${name}, connecting Google is still the foundation everything else builds on.`,
    );
  } else if (input.pendingApprovals > 0) {
    sentences.push(
      `Overnight, ${input.pendingApprovals} draft${input.pendingApprovals === 1 ? "" : "s"} stayed ready for your opinion.`,
    );
  } else if (input.unansweredReviews > 0) {
    sentences.push(
      `Customer reviews need a reply — ${input.unansweredReviews} still waiting.`,
    );
  } else if (input.weeklyWins.reviews > 0 || input.weeklyWins.views > 0) {
    const bits: string[] = [];
    if (input.weeklyWins.reviews > 0) {
      bits.push(
        `${input.weeklyWins.reviews} new review${input.weeklyWins.reviews === 1 ? "" : "s"}`,
      );
    }
    if (input.weeklyWins.views > 0) {
      bits.push(`${input.weeklyWins.views.toLocaleString()} profile views`);
    }
    sentences.push(`Recent momentum includes ${bits.join(" and ")}.`);
  } else {
    sentences.push(`Here's a quick read on where ${name} stands right now.`);
  }

  sentences.push(
    `What matters most: ${input.decision.summary.replace(/\.$/, "")}.`,
  );

  const memory = input.memoryEvidence;
  if (memory && !memory.isColdStart) {
    const preferenceCount = memory.preferences.length;
    const learningCount = memory.learnings.length;
    if (preferenceCount > 0 || learningCount > 0) {
      sentences.push(
        "Marketing Director is also weighing your standing preferences and what we've learned from past outcomes.",
      );
    }
  } else {
    sentences.push(
      `I'm staying focused on ${input.focusTheme} with the signals we already have.`,
    );
  }

  if (input.briefType === ExecutiveBriefTypes.WEEKLY_STRATEGY) {
    sentences.push("This weekly view highlights strategy priorities for the days ahead.");
  } else if (input.briefType === ExecutiveBriefTypes.MONTHLY_EXECUTIVE) {
    sentences.push("This monthly view zooms out to progress, risks, and focus for the month.");
  }

  return sentences.slice(0, 4).join(" ");
}

function buildTopPriorities(input: BuildExecutiveBriefInput): ExecutiveBriefItem[] {
  // Priorities come from Marketing Director — we only explain them.
  const priorities: ExecutiveBriefItem[] = [
    item(input.decision.primaryAction.label),
  ];

  if (
    input.decision.requiresCustomerAction &&
    input.decision.summary &&
    input.decision.summary !== input.decision.primaryAction.label
  ) {
    priorities.push(item(input.decision.summary));
  }

  for (const deferred of input.decision.deferred.slice(0, 2)) {
    priorities.push(item(`Also on deck: ${deferred.title}`));
  }

  return priorities.slice(0, 4);
}

function buildWins(input: BuildExecutiveBriefInput): ExecutiveBriefItem[] {
  const wins: ExecutiveBriefItem[] = [];
  const w = input.weeklyWins;

  if (w.reviews > 0) {
    wins.push(
      item(
        `Received ${w.reviews} new review${w.reviews === 1 ? "" : "s"}.`,
      ),
    );
  }
  if (w.views > 0) {
    wins.push(item(`Monitored ${w.views.toLocaleString()} profile views.`));
  }
  if (w.posts > 0) {
    wins.push(item(`Published ${w.posts} update${w.posts === 1 ? "" : "s"}.`));
  }
  if (w.tasksCompleted > 0) {
    wins.push(
      item(
        `Completed ${w.tasksCompleted} marketing task${w.tasksCompleted === 1 ? "" : "s"}.`,
      ),
    );
  }
  for (const handled of input.thisWeekHandled.slice(0, 2)) {
    if (!wins.some((entry) => entry.text === handled)) {
      wins.push(item(handled));
    }
  }

  if (wins.length === 0) {
    wins.push(item("No standout wins overnight — foundations are still in place."));
  }

  return wins.slice(0, 5);
}

function buildWatchItems(input: BuildExecutiveBriefInput): ExecutiveBriefItem[] {
  const watch: ExecutiveBriefItem[] = [];

  if (input.unansweredReviews > 0) {
    watch.push(
      item(
        `${input.unansweredReviews} review${input.unansweredReviews === 1 ? "" : "s"} waiting on a reply.`,
      ),
    );
  }
  if (input.pendingApprovals > 0) {
    watch.push(
      item(
        `${input.pendingApprovals} approval${input.pendingApprovals === 1 ? "" : "s"} pending.`,
      ),
    );
  }
  if (!input.gbpConnected) {
    watch.push(item("Google Business Profile is not connected yet."));
  }
  if (input.healthState === "needs_attention" || input.healthState === "at_risk") {
    watch.push(item(`Marketing Health is ${input.healthState.replaceAll("_", " ")}.`));
  }
  if (input.seasonalHint) {
    watch.push(item(`Seasonal window: ${input.seasonalHint}.`));
  }
  for (const noticed of input.noticed.slice(0, 2)) {
    watch.push(item(noticed));
  }

  if (watch.length === 0) {
    watch.push(item("Nothing unusual to watch right now."));
  }

  return watch.slice(0, 6);
}

function buildToday(input: BuildExecutiveBriefInput): ExecutiveBriefItem[] {
  const today: ExecutiveBriefItem[] = [];

  if (input.decision.requiresCustomerAction) {
    today.push(item(input.decision.primaryAction.label));
  }
  if (input.publishingReadyOrScheduled > 0) {
    today.push(
      item(
        `${input.publishingReadyOrScheduled} item${input.publishingReadyOrScheduled === 1 ? "" : "s"} ready or scheduled to publish.`,
      ),
    );
  }
  if (input.openRecommendations > 0) {
    today.push(
      item(
        `${input.openRecommendations} open recommendation${input.openRecommendations === 1 ? "" : "s"} in the package.`,
      ),
    );
  }
  if (today.length === 0) {
    today.push(item("No customer action required — I'll keep working in the background."));
  }

  return today.slice(0, 5);
}

function buildRecentChanges(input: BuildExecutiveBriefInput): ExecutiveBriefItem[] {
  const changes: ExecutiveBriefItem[] = [];

  for (const handled of input.thisWeekHandled.slice(0, 3)) {
    changes.push(item(handled));
  }
  if (input.weeklyWins.reviews > 0) {
    changes.push(item("Review activity updated overnight."));
  }
  if (input.memoryEvidence?.marketContextSignals.length) {
    const first = input.memoryEvidence.marketContextSignals[0]!;
    changes.push(item(`Market context refresh: ${first.title}.`));
  }
  if (input.candidateRecommendations.length > 0) {
    changes.push(
      item(
        `Recommendation package has ${input.candidateRecommendations.length} active item${input.candidateRecommendations.length === 1 ? "" : "s"}.`,
      ),
    );
  }

  if (changes.length === 0) {
    changes.push(item("No major overnight changes recorded."));
  }

  return changes.slice(0, 6);
}

function buildSupportingEvidence(input: BuildExecutiveBriefInput): ExecutiveSupportingEvidence[] {
  const evidence: ExecutiveSupportingEvidence[] = [
    {
      kind: ExecutiveEvidenceKinds.MARKETING_DIRECTOR_DECISION,
      label: "Marketing Director focus",
      detail: input.decision.title,
    },
    {
      kind: ExecutiveEvidenceKinds.HEALTH_SIGNAL,
      label: "Marketing Health",
      detail: input.healthState.replaceAll("_", " "),
    },
  ];

  if (input.pendingApprovals > 0) {
    evidence.push({
      kind: ExecutiveEvidenceKinds.PENDING_APPROVAL,
      label: "Pending approvals",
      detail: `${input.pendingApprovals} waiting`,
    });
  }
  if (input.unansweredReviews > 0) {
    evidence.push({
      kind: ExecutiveEvidenceKinds.REVIEW_TREND,
      label: "Review activity",
      detail: `${input.unansweredReviews} unanswered`,
    });
  }
  if (input.publishingReadyOrScheduled > 0) {
    evidence.push({
      kind: ExecutiveEvidenceKinds.PUBLISHING_SCHEDULE,
      label: "Publishing queue",
      detail: `${input.publishingReadyOrScheduled} ready or scheduled`,
    });
  }
  if (input.openRecommendations > 0) {
    evidence.push({
      kind: ExecutiveEvidenceKinds.PENDING_RECOMMENDATION,
      label: "Open recommendations",
      detail: `${input.openRecommendations} in package`,
    });
  }
  if (input.weeklyWins.views > 0 || input.weeklyWins.clicks > 0) {
    evidence.push({
      kind: ExecutiveEvidenceKinds.ANALYTICS_TREND,
      label: "Analytics trend",
      detail: `${input.weeklyWins.views} views · ${input.weeklyWins.clicks} clicks (recent window)`,
    });
  }

  const memory = input.memoryEvidence;
  if (memory && !memory.isColdStart) {
    for (const preference of memory.preferences.slice(0, 2)) {
      evidence.push({
        kind: ExecutiveEvidenceKinds.ACTIVE_PREFERENCE,
        label: "Standing preference",
        detail: preference.instructionText,
      });
    }
    for (const learning of memory.learnings.slice(0, 2)) {
      evidence.push({
        kind: ExecutiveEvidenceKinds.HISTORICAL_LEARNING,
        label: "Historical pattern",
        detail: learning.summary,
      });
    }
    for (const signal of memory.marketContextSignals.slice(0, 2)) {
      evidence.push({
        kind: ExecutiveEvidenceKinds.MARKET_CONTEXT,
        label: "Market context",
        detail: signal.title,
      });
    }
  }

  return evidence.slice(0, 12);
}

/**
 * Build any supported brief type from the same input. Morning is the surfaced default;
 * weekly/monthly adjust summary framing only — priorities still come from MD.
 */
export function buildExecutiveBrief(input: BuildExecutiveBriefInput): ExecutiveBrief {
  const now = input.now ?? new Date();
  const headline = buildExecutiveHeadline({
    decision: input.decision,
    healthState: input.healthState,
    weeklyWins: input.weeklyWins,
    pendingApprovals: input.pendingApprovals,
    unansweredReviews: input.unansweredReviews,
    openRecommendations: input.openRecommendations,
    seasonalHint: input.seasonalHint,
    gbpConnected: input.gbpConnected,
  });

  return {
    briefType: input.briefType,
    headline,
    summary: buildSummary(input),
    topPriorities: buildTopPriorities(input),
    wins: buildWins(input),
    watchItems: buildWatchItems(input),
    today: buildToday(input),
    recentChanges: buildRecentChanges(input),
    supportingEvidence: buildSupportingEvidence(input),
    generatedAt: now.toISOString(),
  };
}

export function buildMorningBrief(
  input: Omit<BuildExecutiveBriefInput, "briefType">,
): ExecutiveBrief {
  return buildExecutiveBrief({ ...input, briefType: ExecutiveBriefTypes.MORNING });
}

export function buildWeeklyStrategyBrief(
  input: Omit<BuildExecutiveBriefInput, "briefType">,
): ExecutiveBrief {
  return buildExecutiveBrief({
    ...input,
    briefType: ExecutiveBriefTypes.WEEKLY_STRATEGY,
  });
}

export function buildMonthlyExecutiveReport(
  input: Omit<BuildExecutiveBriefInput, "briefType">,
): ExecutiveBrief {
  return buildExecutiveBrief({
    ...input,
    briefType: ExecutiveBriefTypes.MONTHLY_EXECUTIVE,
  });
}

import "server-only";

import { getHeadOfMarketingBriefingForCurrentUser } from "@/lib/head-of-marketing/service";
import {
  ExecutiveBriefTypes,
  type ExecutiveBrief,
  type ExecutiveBriefType,
} from "@/lib/executive-briefing/types";
import {
  buildMonthlyExecutiveReport,
  buildMorningBrief,
  buildWeeklyStrategyBrief,
} from "@/lib/executive-briefing/buildBrief";

/**
 * Manual refresh / future delivery entrypoint. Reuses the Head of Marketing load path
 * so we never duplicate Marketing Director, memory, or recommendation queries.
 */
export async function getExecutiveBriefForCurrentUser(
  briefType: ExecutiveBriefType = ExecutiveBriefTypes.MORNING,
): Promise<ExecutiveBrief | null> {
  const briefing = await getHeadOfMarketingBriefingForCurrentUser();
  if (!briefing) return null;

  switch (briefType) {
    case ExecutiveBriefTypes.WEEKLY_STRATEGY:
      return briefing.executiveBriefs.weeklyStrategy;
    case ExecutiveBriefTypes.MONTHLY_EXECUTIVE:
      return briefing.executiveBriefs.monthlyExecutive;
    case ExecutiveBriefTypes.MORNING:
    default:
      return briefing.executiveBriefs.morning;
  }
}

/** Pure helper for tests and future delivery adapters. */
export function selectBriefBuilder(briefType: ExecutiveBriefType) {
  switch (briefType) {
    case ExecutiveBriefTypes.WEEKLY_STRATEGY:
      return buildWeeklyStrategyBrief;
    case ExecutiveBriefTypes.MONTHLY_EXECUTIVE:
      return buildMonthlyExecutiveReport;
    case ExecutiveBriefTypes.MORNING:
    default:
      return buildMorningBrief;
  }
}

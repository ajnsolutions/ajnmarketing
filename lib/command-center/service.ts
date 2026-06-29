import "server-only";

import { loadCommandCenterContextForCurrentUser } from "@/lib/command-center/context";
import { generateCommandCenterInsights } from "@/lib/command-center/planner";
import {
  buildTaskPriorities,
  buildUpcomingCalendar,
  computeBusinessHealthScores,
  computeWeeklyWins,
} from "@/lib/command-center/scoring";
import type { CommandCenterPageData } from "@/lib/command-center/types";
import { getBackgroundJobDashboardDataForCurrentUser } from "@/lib/background-jobs/server";

const EMPTY_DATA: CommandCenterPageData = {
  businessName: "Business",
  aiInsights: {
    executiveSummary: "Sign in and complete onboarding to activate your AI Marketing Command Center.",
    businessHealthExplanation: "Business health scores will appear once your profile, website analysis, and marketing systems are connected.",
    momentum: { trend: "stable", reasons: [] },
    recommendations: [],
    generatedByAi: false,
  },
  businessHealth: {
    overall: 0,
    seo: 0,
    google: 0,
    reviews: 0,
    content: 0,
    consistency: 0,
  },
  priorities: { high: [], medium: [], low: [] },
  calendar: [],
  weeklyWins: {
    reviews: 0,
    views: 0,
    calls: 0,
    clicks: 0,
    posts: 0,
    tasksCompleted: 0,
  },
  competitorWatchMessage:
    "Live competitor monitoring is not connected yet. This section will surface competitor activity once monitoring is enabled.",
  backgroundJobs: {
    recent: [],
    counts: { queued: 0, running: 0, failed: 0, completed: 0 },
  },
};

export async function getCommandCenterPageDataForCurrentUser(): Promise<CommandCenterPageData> {
  const context = await loadCommandCenterContextForCurrentUser();
  if (!context) return EMPTY_DATA;

  const businessHealth = computeBusinessHealthScores(context);
  const [generated, backgroundJobs] = await Promise.all([
    generateCommandCenterInsights({ context, businessHealth }),
    getBackgroundJobDashboardDataForCurrentUser(),
  ]);

  return {
    businessName: context.generationContext?.businessProfile.business_name ?? "Business",
    aiInsights: {
      ...generated,
      generatedByAi: Boolean(process.env.OPENAI_API_KEY?.trim()),
    },
    businessHealth,
    priorities: buildTaskPriorities(context),
    calendar: buildUpcomingCalendar(context.planData.plan?.plan_json?.thirtyDayCalendar),
    weeklyWins: computeWeeklyWins(context),
    competitorWatchMessage:
      "Live competitor monitoring is not connected yet. This section will surface competitor activity once monitoring is enabled.",
    backgroundJobs,
  };
}

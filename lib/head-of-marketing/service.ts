import "server-only";

import { loadCommandCenterContextForCurrentUser } from "@/lib/command-center/context";
import {
  buildTaskPriorities,
  buildUpcomingCalendar,
  computeBusinessHealthScores,
  computeWeeklyWins,
} from "@/lib/command-center/scoring";
import { getDashboardSessionContext } from "@/lib/dashboard/session-context";
import { getBusinessProfileForUser } from "@/lib/business-profile-server";
import { createClient } from "@/lib/supabase/server";
import { buildWeeklyBriefing } from "@/lib/head-of-marketing/weeklyBriefing";
import type { HeadOfMarketingBriefing } from "@/lib/head-of-marketing/types";

async function countOpenRecommendations(businessProfileId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("marketing_recommendations")
    .select("id", { count: "exact", head: true })
    .eq("business_profile_id", businessProfileId)
    .in("status", ["open", "in_progress"]);

  if (error) return 0;
  return count ?? 0;
}

/**
 * Weekly Briefing / Head of Marketing presentation entrypoint.
 * Reuses command-center context + scoring — does not rewrite engines.
 */
export async function getHeadOfMarketingBriefingForCurrentUser(): Promise<HeadOfMarketingBriefing | null> {
  const [session, profile, context] = await Promise.all([
    getDashboardSessionContext(),
    getBusinessProfileForUser(),
    loadCommandCenterContextForCurrentUser(),
  ]);

  if (!profile?.onboarding_completed || !context) return null;

  const businessHealth = computeBusinessHealthScores(context);
  const weeklyWins = computeWeeklyWins(context);
  const priorities = buildTaskPriorities(context);
  const upcomingCalendar = buildUpcomingCalendar(
    context.planData.plan?.plan_json?.thirtyDayCalendar,
  );
  const openRecommendations = await countOpenRecommendations(profile.id);

  const planJson = context.planData.plan?.plan_json;
  const planSummary =
    planJson?.executiveSummary?.trim() ||
    planJson?.marketingThemes?.[0]?.trim() ||
    null;

  const seasonalCampaign = planJson?.seasonalCampaigns?.[0];
  const seasonalHint = seasonalCampaign
    ? `${seasonalCampaign.title}${seasonalCampaign.timing ? ` (${seasonalCampaign.timing})` : ""}`
    : null;

  const topPriorityTitle =
    priorities.high[0]?.title ?? priorities.medium[0]?.title ?? null;

  return buildWeeklyBriefing({
    userName: session.userName,
    businessName: session.businessName,
    websiteUrl: profile.website,
    voiceNotes: profile.voice_notes,
    profileCreatedAt: profile.created_at ?? null,
    gbpConnected: Boolean(context.gbpData.connected),
    unansweredReviews: context.gbpData.reviewSummary.unansweredCount ?? 0,
    pendingApprovals: context.approvalStats.pending ?? 0,
    openRecommendations,
    publishFailures: context.publishingStats.failed ?? 0,
    publishingReadyOrScheduled:
      (context.publishingStats.scheduled ?? 0) + (context.publishingStats.ready ?? 0),
    businessHealth,
    weeklyWins,
    planSummary,
    seasonalHint,
    topPriorityTitle,
    upcomingCalendar,
    competitorWatchMessage: null,
  });
}

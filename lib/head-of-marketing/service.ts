import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
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
import { orderCandidatesWithMemory } from "@/lib/marketing-director/memoryComposition";
import type {
  MarketingDirectorCandidate,
  MarketingDirectorTopRecommendationDetail,
} from "@/lib/marketing-director/types";
import { getActiveMarketingRecommendationsForUser } from "@/lib/marketing-decisions/persistence";
import { formatRecommendedActionType } from "@/lib/marketing-decisions/ui";
import { buildMarketingMemoryEvidencePackage } from "@/lib/marketing-memory/evidencePackage";
import type { MarketingMemoryEvidencePackage } from "@/lib/marketing-memory/evidenceTypes";
import { getRecommendationDecisionPackageForUser } from "@/lib/recommendation-presentation/service";
import { getCampaignDashboardForBusiness } from "@/lib/campaign-intelligence/campaign-service";
import { getContentApprovalsForUser } from "@/lib/content-approval/persistence";
import { getLatestMarketContextBriefWithItemsForUser } from "@/lib/market-context/persistence";
import { getPublishingQueueForUser } from "@/lib/publishing-queue/persistence";
import { aggregateStrategicMarketingCalendar } from "@/lib/strategic-marketing-calendar/calendar-aggregator";
import { buildCalendarPreview } from "@/lib/strategic-marketing-calendar/calendar-presentation";
import { resolveCalendarRange } from "@/lib/strategic-marketing-calendar/calendar-range";
import { zonedDateKey } from "@/lib/strategic-marketing-calendar/calendar-timezone";
import type { CalendarSourceBundle } from "@/lib/strategic-marketing-calendar/calendar-dependencies";

async function countOpenRecommendations(
  supabase: SupabaseClient,
  businessProfileId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("marketing_recommendations")
    .select("id", { count: "exact", head: true })
    .eq("business_profile_id", businessProfileId)
    .in("status", ["open", "in_progress"]);

  if (error) return 0;
  return count ?? 0;
}

/**
 * Loads the active (open/in_progress) recommendation set for one business — already
 * ranked by the existing marketing-decisions + recommendation-learning engines, never
 * rescored here — plus the existing recommendation-presentation explainability package
 * (the same one the Approval Center already shows) for the top-ranked one only. Skipped
 * entirely when there is nothing open, so the common "nothing pending" path stays cheap.
 * See lib/marketing-director/resolveDecision.ts, which consumes this output.
 */
async function loadMarketingDirectorCandidates(
  userId: string,
  businessProfileId: string,
  supabase: SupabaseClient,
  memoryEvidence: MarketingMemoryEvidencePackage | null,
): Promise<{
  candidates: MarketingDirectorCandidate[];
  topDetail: MarketingDirectorTopRecommendationDetail | null;
}> {
  const active = (await getActiveMarketingRecommendationsForUser(supabase, userId)).filter(
    (recommendation) => recommendation.business_profile_id === businessProfileId,
  );

  if (active.length === 0) {
    return { candidates: [], topDetail: null };
  }

  const mapped: MarketingDirectorCandidate[] = active.map((recommendation) => ({
    id: recommendation.id,
    actionTypeLabel: formatRecommendedActionType(recommendation.recommended_action_type),
    actionType: recommendation.recommended_action_type,
    status: recommendation.status,
    urgency: recommendation.urgency,
  }));

  // Same pure reorder the resolver applies — so topDetail matches the memory-aware primary.
  const { ordered: candidates } = orderCandidatesWithMemory(mapped, memoryEvidence);
  const top = candidates[0]!;
  const decisionPackage = await getRecommendationDecisionPackageForUser(userId, top.id, supabase);

  const topDetail: MarketingDirectorTopRecommendationDetail | null = decisionPackage
    ? {
        recommendationId: decisionPackage.recommendationId,
        title: decisionPackage.title,
        whyNow: decisionPackage.whyNow,
        expectedBenefit: decisionPackage.expectedBenefit,
        confidenceLabel: decisionPackage.confidenceLabel,
      }
    : null;

  console.info("[MarketingDirector]", {
    scope: "marketing-director",
    businessProfileId,
    candidateCount: candidates.length,
    topRecommendationId: top.id,
    hasExplainability: Boolean(topDetail),
    memoryColdStart: memoryEvidence?.isColdStart ?? true,
  });

  return { candidates, topDetail };
}

/**
 * Weekly Briefing / Head of Marketing presentation entrypoint.
 * Reuses command-center context + scoring — does not rewrite engines.
 */
export async function getHeadOfMarketingBriefingForCurrentUser(): Promise<HeadOfMarketingBriefing | null> {
  const supabase = await createClient();
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
  const planJson = context.planData.plan?.plan_json;
  const planSummary =
    planJson?.executiveSummary?.trim() ||
    planJson?.marketingThemes?.[0]?.trim() ||
    null;
  const marketingThemes = (planJson?.marketingThemes ?? [])
    .map((theme) => theme.trim())
    .filter(Boolean);
  const businessGoals = (planJson?.businessGoals ?? [])
    .map((goal) => goal.trim())
    .filter(Boolean);
  const profileGoals = (profile.marketing_goals ?? [])
    .map((goal) => goal.trim())
    .filter(Boolean);
  const activeGoals = [...new Set([...businessGoals, ...profileGoals])];

  const seasonalCampaign = planJson?.seasonalCampaigns?.[0];
  const seasonalHint = seasonalCampaign
    ? `${seasonalCampaign.title}${seasonalCampaign.timing ? ` (${seasonalCampaign.timing})` : ""}`
    : null;

  const topPriorityTitle =
    priorities.high[0]?.title ?? priorities.medium[0]?.title ?? null;

  // Batch: open-count + memory + campaigns + calendar sources (no N+1 / no second MD resolve).
  const [
    openRecommendations,
    memoryEvidence,
    campaigns,
    publishing,
    approvals,
    marketBrief,
  ] = await Promise.all([
    countOpenRecommendations(supabase, profile.id),
    buildMarketingMemoryEvidencePackage(supabase, profile.user_id, profile.id, {
      activeGoals,
    }),
    getCampaignDashboardForBusiness(profile.user_id, profile.id, {
      supabaseClient: supabase,
    }),
    getPublishingQueueForUser(supabase, profile.user_id),
    getContentApprovalsForUser(supabase, profile.user_id),
    getLatestMarketContextBriefWithItemsForUser(supabase, profile.user_id),
  ]);

  const { candidates: candidateRecommendations, topDetail: topRecommendationDetail } =
    openRecommendations > 0
      ? await loadMarketingDirectorCandidates(
          profile.user_id,
          profile.id,
          supabase,
          memoryEvidence,
        )
      : { candidates: [], topDetail: null };

  const briefing = buildWeeklyBriefing({
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
    marketingThemes,
    businessGoals,
    seasonalHint,
    topPriorityTitle,
    upcomingCalendar,
    competitorWatchMessage: null,
    candidateRecommendations,
    topRecommendationDetail,
    memoryEvidence,
  });

  const withCampaigns = { ...briefing, campaigns };
  const range = resolveCalendarRange({ view: "week", configuredTimezone: null });
  let calendarPreview = null;
  if (range.ok) {
    const sources: CalendarSourceBundle = {
      briefing: withCampaigns,
      campaigns,
      publishing: publishing.filter((item) => item.business_profile_id === profile.id),
      approvals: approvals.filter((item) => item.business_profile_id === profile.id),
      marketContextItems: (marketBrief?.items ?? []).filter(
        (item) => item.business_profile_id === profile.id,
      ),
      pendingApprovalCount: context.approvalStats.pending ?? 0,
      warnings: [],
    };
    const todayKey = zonedDateKey(new Date(), range.timezone);
    const calendar = aggregateStrategicMarketingCalendar({
      businessProfileId: profile.id,
      view: range.view,
      timezone: range.timezone,
      rangeStart: range.rangeStart,
      rangeEnd: range.rangeEnd,
      todayKey,
      sources,
    });
    calendarPreview = buildCalendarPreview(calendar, todayKey);
  }

  return { ...withCampaigns, calendarPreview };
}

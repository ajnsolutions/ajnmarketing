/**
 * Batched dependency loaders for Strategic Marketing Calendar aggregation.
 * DI-friendly; no N+1 loops.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getCampaignDashboardForBusiness,
  listCampaignsForBusiness,
} from "@/lib/campaign-intelligence/campaign-service";
import type { CampaignDashboardCard } from "@/lib/campaign-intelligence/campaign-types";
import { toCampaignDashboardCards } from "@/lib/campaign-intelligence/campaign-dashboard";
import { getContentApprovalsForUser } from "@/lib/content-approval/persistence";
import type { ContentApproval } from "@/lib/content-approval/types";
import { getDecisionIntelligenceSummaryForBusiness } from "@/lib/decision-intelligence/service";
import type { DecisionTimelineEvent } from "@/lib/decision-intelligence/types";
import { getHeadOfMarketingBriefingForCurrentUser } from "@/lib/head-of-marketing/service";
import type { HeadOfMarketingBriefing } from "@/lib/head-of-marketing/types";
import { getLatestMarketContextBriefWithItemsForUser } from "@/lib/market-context/persistence";
import type { MarketContextItem } from "@/lib/market-context/types";
import { getPublishingQueueForUser } from "@/lib/publishing-queue/persistence";
import type { PublishingQueueItem } from "@/lib/publishing-queue/types";
import { createClient } from "@/lib/supabase/server";
import type { StrategicCalendarSourceWarning } from "@/lib/strategic-marketing-calendar/calendar-types";
import { StrategicCalendarSourceTypes } from "@/lib/strategic-marketing-calendar/calendar-types";

export type CalendarSourceBundle = {
  briefing: HeadOfMarketingBriefing | null;
  campaigns: CampaignDashboardCard[];
  publishing: PublishingQueueItem[];
  approvals: ContentApproval[];
  marketContextItems: MarketContextItem[];
  pendingApprovalCount: number;
  warnings: StrategicCalendarSourceWarning[];
  /** Decision Intelligence & Learning Impact (Phase 2F) — informational timeline only. */
  decisionIntelligenceEvents: DecisionTimelineEvent[];
};

export type CalendarDependencies = {
  supabaseClient?: SupabaseClient;
  loadBriefing?: typeof getHeadOfMarketingBriefingForCurrentUser;
  loadPublishing?: typeof getPublishingQueueForUser;
  loadApprovals?: typeof getContentApprovalsForUser;
  loadMarketContext?: typeof getLatestMarketContextBriefWithItemsForUser;
  loadCampaignCards?: (
    userId: string,
    businessProfileId: string,
    supabase: SupabaseClient,
  ) => Promise<CampaignDashboardCard[]>;
  loadDecisionIntelligence?: typeof getDecisionIntelligenceSummaryForBusiness;
};

async function defaultLoadCampaignCards(
  userId: string,
  businessProfileId: string,
  supabase: SupabaseClient,
): Promise<CampaignDashboardCard[]> {
  // Prefer active dashboard cards; fall back to recent list for span visibility.
  const active = await getCampaignDashboardForBusiness(userId, businessProfileId, {
    supabaseClient: supabase,
  });
  if (active.length > 0) return active;
  const all = await listCampaignsForBusiness(userId, businessProfileId, {
    supabaseClient: supabase,
  });
  return toCampaignDashboardCards(all.slice(0, 20));
}

/**
 * Batch-load authoritative sources once per calendar request.
 * Optional source failures become warnings — not a blank calendar.
 */
export async function loadCalendarSources(
  userId: string,
  businessProfileId: string,
  deps?: CalendarDependencies,
): Promise<CalendarSourceBundle> {
  const supabase = deps?.supabaseClient ?? (await createClient());
  const loadBriefing = deps?.loadBriefing ?? getHeadOfMarketingBriefingForCurrentUser;
  const loadPublishing = deps?.loadPublishing ?? getPublishingQueueForUser;
  const loadApprovals = deps?.loadApprovals ?? getContentApprovalsForUser;
  const loadMarketContext =
    deps?.loadMarketContext ?? getLatestMarketContextBriefWithItemsForUser;
  const loadCampaignCards = deps?.loadCampaignCards ?? defaultLoadCampaignCards;
  const loadDecisionIntelligence =
    deps?.loadDecisionIntelligence ?? getDecisionIntelligenceSummaryForBusiness;

  const warnings: StrategicCalendarSourceWarning[] = [];

  const [briefingResult, publishingResult, approvalsResult, marketResult, campaignsResult, decisionIntelligenceResult] =
    await Promise.allSettled([
      loadBriefing(),
      loadPublishing(supabase, userId),
      loadApprovals(supabase, userId),
      loadMarketContext(supabase, userId),
      loadCampaignCards(userId, businessProfileId, supabase),
      loadDecisionIntelligence(supabase, userId, businessProfileId),
    ]);

  const briefing =
    briefingResult.status === "fulfilled" ? briefingResult.value : null;
  if (briefingResult.status === "rejected") {
    warnings.push({
      source: StrategicCalendarSourceTypes.MARKETING_DIRECTOR,
      message: "Could not load Head of Marketing briefing for priorities.",
    });
  }

  let publishing: PublishingQueueItem[] = [];
  if (publishingResult.status === "fulfilled") {
    publishing = publishingResult.value.filter(
      (item) => item.business_profile_id === businessProfileId,
    );
  } else {
    warnings.push({
      source: StrategicCalendarSourceTypes.PUBLISHING_QUEUE,
      message: "Publishing queue unavailable for this range.",
    });
  }

  let approvals: ContentApproval[] = [];
  if (approvalsResult.status === "fulfilled") {
    approvals = approvalsResult.value.filter(
      (item) => item.business_profile_id === businessProfileId,
    );
  } else {
    warnings.push({
      source: StrategicCalendarSourceTypes.CONTENT_APPROVAL,
      message: "Approvals unavailable for this range.",
    });
  }

  let marketContextItems: MarketContextItem[] = [];
  if (marketResult.status === "fulfilled") {
    marketContextItems = (marketResult.value?.items ?? []).filter(
      (item) => item.business_profile_id === businessProfileId,
    );
  } else {
    warnings.push({
      source: StrategicCalendarSourceTypes.MARKET_CONTEXT,
      message: "Market Context unavailable for this range.",
    });
  }

  let campaigns: CampaignDashboardCard[] = [];
  if (campaignsResult.status === "fulfilled") {
    campaigns = campaignsResult.value;
  } else if (briefing?.campaigns) {
    campaigns = briefing.campaigns;
    warnings.push({
      source: StrategicCalendarSourceTypes.CAMPAIGN,
      message: "Using campaign cards from briefing after direct load failed.",
    });
  } else {
    warnings.push({
      source: StrategicCalendarSourceTypes.CAMPAIGN,
      message: "Campaign Intelligence unavailable for this range.",
    });
  }

  // Prefer briefing campaigns when both present (already MD-gated dashboard set).
  if (briefing?.campaigns?.length && campaigns.length === 0) {
    campaigns = briefing.campaigns;
  }

  const pendingApprovalCount = approvals.filter((item) => item.status === "pending").length;

  let decisionIntelligenceEvents: DecisionTimelineEvent[] = [];
  if (decisionIntelligenceResult.status === "fulfilled") {
    decisionIntelligenceEvents = decisionIntelligenceResult.value.timeline;
  } else {
    warnings.push({
      source: StrategicCalendarSourceTypes.DECISION_INTELLIGENCE,
      message: "Decision history unavailable for this range.",
    });
  }

  return {
    briefing,
    campaigns,
    publishing,
    approvals,
    marketContextItems,
    pendingApprovalCount,
    warnings,
    decisionIntelligenceEvents,
  };
}

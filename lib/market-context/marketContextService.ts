import "server-only";

import { getAiMarketingProfileForUser } from "@/lib/ai-marketing-profile/persistence";
import type { BusinessProfile } from "@/lib/business-profile";
import {
  buildContentAngles,
  buildHighOpportunityKeywords,
  buildOverallSummary,
  buildRecommendedTopics,
  scoreAndRankMarketContextItems,
} from "@/lib/market-context/contextScoringService";
import {
  formatMarketContextWeekLabel,
  getLatestMarketContextBriefWithItemsForUser,
  markMarketContextBriefFailed,
  saveMarketContextBriefResult,
  saveMarketContextItems,
  upsertMarketContextBriefGenerating,
} from "@/lib/market-context/persistence";
import { CompetitorProvider } from "@/lib/market-context/providers/competitorProvider";
import { HolidayProvider } from "@/lib/market-context/providers/holidayProvider";
import { LocalEventsProvider } from "@/lib/market-context/providers/localEventsProvider";
import { NewsProvider } from "@/lib/market-context/providers/newsProvider";
import { SchoolCalendarProvider } from "@/lib/market-context/providers/schoolCalendarProvider";
import { TrendsProvider } from "@/lib/market-context/providers/trendsProvider";
import { WeatherProvider } from "@/lib/market-context/providers/weatherProvider";
import { logMarketContextProviderError } from "@/lib/market-context/providers/providerLogger";
import type {
  MarketContextBriefWithItems,
  MarketContextBusinessContext,
  MarketContextPageData,
  MarketContextProviderContext,
} from "@/lib/market-context/types";
import { AuditActions, auditErrorMetadata, logAuditEvent } from "@/lib/audit-log-server";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

const MARKET_CONTEXT_PROVIDERS = [
  new WeatherProvider(),
  new HolidayProvider(),
  new LocalEventsProvider(),
  new SchoolCalendarProvider(),
  new CompetitorProvider(),
  new NewsProvider(),
  new TrendsProvider(),
];

const TOP_ITEM_LIMIT = 12;

function getWeekBounds(referenceDate = new Date()): { start: string; end: string; weekLabel: string } {
  const date = new Date(referenceDate);
  const day = date.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const startDate = new Date(date);
  startDate.setDate(date.getDate() + diffToMonday);

  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);

  const start = startDate.toISOString().slice(0, 10);
  const end = endDate.toISOString().slice(0, 10);

  return {
    start,
    end,
    weekLabel: formatMarketContextWeekLabel(start, end),
  };
}

function splitList(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  return [...new Set(raw.split(/[\n,;|•]/).map((item) => item.trim()).filter(Boolean))];
}

function buildBusinessContext(
  businessProfile: BusinessProfile,
  aiMarketingProfile: Awaited<ReturnType<typeof getAiMarketingProfileForUser>>
): MarketContextBusinessContext {
  return {
    businessProfile,
    aiMarketingProfile,
    industry:
      aiMarketingProfile?.industry?.trim() ||
      businessProfile.industry?.trim() ||
      "local business",
    city: businessProfile.city?.trim() || "Local",
    state: businessProfile.state?.trim() || "",
    serviceAreas: [
      businessProfile.primary_service_area,
      businessProfile.city,
      businessProfile.state,
      ...splitList(businessProfile.nearby_cities),
    ].filter(Boolean) as string[],
    services: [
      ...(aiMarketingProfile?.services ?? []),
      ...splitList(businessProfile.primary_services),
      ...splitList(businessProfile.seasonal_services),
    ],
    competitors: splitList(businessProfile.competitors),
  };
}

async function gatherProviderItems(
  providerContext: MarketContextProviderContext
): Promise<Awaited<ReturnType<typeof MARKET_CONTEXT_PROVIDERS[number]["fetchItems"]>>> {
  const results = await Promise.all(
    MARKET_CONTEXT_PROVIDERS.map(async (provider) => {
      try {
        return await provider.fetchItems(providerContext);
      } catch (error) {
        logMarketContextProviderError(provider.category, "Provider fetch failed", error);
        return [];
      }
    })
  );

  return results.flat();
}

export async function generateWeeklyMarketContextBrief(input: {
  userId: string;
  businessProfileId: string;
  referenceDate?: Date;
  /**
   * Optional injected Supabase client. Defaults to the request-scoped cookie client
   * (`lib/supabase/server.ts`), preserving today's behavior for every existing caller
   * (the current-user API route and `refreshMarketContextBriefForCurrentUser`).
   * Pass a privileged client (`lib/supabase/service.ts`) here to run this for a business
   * that isn't the current request's signed-in user — e.g. from scheduled/background
   * execution. See the trust-boundary note on `createServiceRoleClient`.
   */
  supabaseClient?: SupabaseClient;
}): Promise<{ briefWithItems: MarketContextBriefWithItems | null; error?: string }> {
  const supabase = input.supabaseClient ?? (await createClient());
  const referenceDate = input.referenceDate ?? new Date();
  const { start, end, weekLabel } = getWeekBounds(referenceDate);

  const { data: profile, error: profileError } = await supabase
    .from("business_profiles")
    .select("*")
    .eq("user_id", input.userId)
    .maybeSingle();

  if (profileError || !profile) {
    return { briefWithItems: null, error: "Business profile not found. Complete onboarding first." };
  }

  const aiMarketingProfile = await getAiMarketingProfileForUser(supabase, input.userId);
  const businessContext = buildBusinessContext(profile as BusinessProfile, aiMarketingProfile);

  const claim = await upsertMarketContextBriefGenerating(supabase, {
    userId: input.userId,
    businessProfileId: input.businessProfileId,
    briefStartDate: start,
    briefEndDate: end,
  });

  if (claim.alreadyGenerating) {
    return {
      briefWithItems: null,
      error: "Market context brief generation is already in progress.",
    };
  }

  const generatingBrief = claim.brief;
  if (!generatingBrief) {
    return { briefWithItems: null, error: "Unable to start market context brief generation." };
  }

  try {
    const providerContext: MarketContextProviderContext = {
      businessProfile: profile as BusinessProfile,
      aiMarketingProfile,
      referenceDate,
    };

    const rawItems = await gatherProviderItems(providerContext);
    const rankedItems = scoreAndRankMarketContextItems(rawItems, businessContext, referenceDate);
    const topItems = rankedItems.slice(0, TOP_ITEM_LIMIT);

    const savedItems = await saveMarketContextItems(supabase, {
      userId: input.userId,
      businessProfileId: input.businessProfileId,
      items: topItems,
    });

    const overallSummary = buildOverallSummary(topItems, businessContext, weekLabel);
    const recommendedTopics = buildRecommendedTopics(topItems);
    const highOpportunityKeywords = buildHighOpportunityKeywords(topItems, businessContext);
    const contentAngles = buildContentAngles(topItems);

    const brief = await saveMarketContextBriefResult(supabase, {
      briefId: generatingBrief.id,
      userId: input.userId,
      overallSummary,
      recommendedTopics,
      highOpportunityKeywords,
      contentAngles,
      selectedContextItemIds: savedItems.map((item) => item.id),
    });

    if (!brief) {
      await markMarketContextBriefFailed(supabase, generatingBrief.id, input.userId);
      return { briefWithItems: null, error: "Unable to save market context brief." };
    }

    await logAuditEvent(supabase, {
      userId: input.userId,
      businessProfileId: input.businessProfileId,
      action: AuditActions.MARKET_CONTEXT_BRIEF_GENERATED,
      entityType: "market_context_brief",
      entityId: brief.id,
      status: "success",
      metadata: {
        weekLabel,
        itemCount: savedItems.length,
      },
    });

    return {
      briefWithItems: {
        brief,
        items: savedItems,
      },
    };
  } catch (error) {
    await markMarketContextBriefFailed(supabase, generatingBrief.id, input.userId);

    await logAuditEvent(supabase, {
      userId: input.userId,
      businessProfileId: input.businessProfileId,
      action: AuditActions.MARKET_CONTEXT_BRIEF_GENERATED,
      entityType: "market_context_brief",
      entityId: generatingBrief.id,
      status: "failure",
      metadata: auditErrorMetadata(error, "Market context brief generation failed"),
    });

    return {
      briefWithItems: null,
      error: error instanceof Error ? error.message : "Market context brief generation failed.",
    };
  }
}

export async function getMarketContextPageDataForCurrentUser(): Promise<MarketContextPageData> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { weekLabel } = getWeekBounds();

  if (!user) {
    return { briefWithItems: null, weekLabel };
  }

  const briefWithItems = await getLatestMarketContextBriefWithItemsForUser(supabase, user.id);
  return { briefWithItems, weekLabel };
}

export async function getLatestMarketContextBriefForCurrentUser(): Promise<MarketContextBriefWithItems | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return getLatestMarketContextBriefWithItemsForUser(supabase, user.id);
}

export async function refreshMarketContextBriefForCurrentUser(): Promise<{
  briefWithItems: MarketContextBriefWithItems | null;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { briefWithItems: null, error: "Unauthorized" };
  }

  const { data: profile, error } = await supabase
    .from("business_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !profile) {
    return { briefWithItems: null, error: "Business profile not found. Complete onboarding first." };
  }

  return generateWeeklyMarketContextBrief({
    userId: user.id,
    businessProfileId: profile.id,
  });
}

export async function getLatestMarketContextBriefForUser(userId: string): Promise<MarketContextBriefWithItems | null> {
  const supabase = await createClient();
  return getLatestMarketContextBriefWithItemsForUser(supabase, userId);
}

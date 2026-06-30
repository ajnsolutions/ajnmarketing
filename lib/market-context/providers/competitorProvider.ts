import "server-only";

import {
  addDays,
  BaseMarketContextProvider,
  resolveIndustry,
  resolveLocationLabel,
  toIsoDate,
} from "@/lib/market-context/providers/baseMarketContextProvider";
import {
  buildCompetitorSignalSummary,
  collectCompetitorProfiles,
  resolveCompetitorSourceUrl,
} from "@/lib/market-context/providers/competitorProfile";
import { logMarketContextProviderError } from "@/lib/market-context/providers/providerLogger";
import type { MarketContextItemInput, MarketContextProviderContext } from "@/lib/market-context/types";

function buildFallbackCompetitorItems(context: MarketContextProviderContext): MarketContextItemInput[] {
  const location = resolveLocationLabel(context);
  const industry = resolveIndustry(context);
  const referenceDate = context.referenceDate;

  return [
    {
      category: "competitor",
      title: `Competitor monitoring not configured in ${location}`,
      summary: `Add competitors in your business profile to unlock profile-based competitor signals. Fallback baseline: local ${industry} providers may increase Google post frequency this month.`,
      sourceName: "AJN Market Context (fallback competitor watch)",
      sourceUrl: null,
      confidenceScore: 35,
      contextDate: toIsoDate(referenceDate),
      expiresAt: addDays(referenceDate, 7).toISOString(),
      metadata: {
        provider: "mock",
        isFallback: true,
        configured: false,
      },
    },
  ];
}

function buildProfileCompetitorItems(context: MarketContextProviderContext): MarketContextItemInput[] {
  const location = resolveLocationLabel(context);
  const industry = resolveIndustry(context);
  const referenceDate = context.referenceDate;
  const competitors = collectCompetitorProfiles(context);

  if (competitors.length === 0) {
    return [];
  }

  return competitors.map((competitor, index) => ({
    category: "competitor" as const,
    title: `Competitive focus: ${competitor.name} in ${location}`,
    summary: buildCompetitorSignalSummary(competitor, industry, location),
    sourceName: `${competitor.name} (${competitor.source === "ai_marketing_profile" ? "AI profile" : "business profile"})`,
    sourceUrl: resolveCompetitorSourceUrl(competitor),
    confidenceScore: 68,
    contextDate: toIsoDate(addDays(referenceDate, index)),
    expiresAt: addDays(referenceDate, 14).toISOString(),
    metadata: {
      provider: "profile.competitors",
      isFallback: false,
      isProfileBased: true,
      configured: true,
      competitorName: competitor.name,
      competitorSource: competitor.source,
      hasWebsite: Boolean(competitor.websiteUrl),
      hasGoogleBusinessProfile: Boolean(competitor.googleBusinessUrl),
      socialProfileCount: competitor.socialUrls.length,
    },
  }));
}

export class CompetitorProvider extends BaseMarketContextProvider {
  readonly category = "competitor" as const;

  async fetchItems(context: MarketContextProviderContext): Promise<MarketContextItemInput[]> {
    try {
      const profileItems = buildProfileCompetitorItems(context);
      if (profileItems.length > 0) {
        return profileItems;
      }
    } catch (error) {
      logMarketContextProviderError("competitor", "Profile competitor parsing failed", error);
    }

    return buildFallbackCompetitorItems(context);
  }
}

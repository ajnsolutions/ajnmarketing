import "server-only";

import type { MarketContextProviderContext } from "@/lib/market-context/types";
import {
  extractUrls,
  isLikelyEventFeedUrl,
  normalizeWebsiteOrigin,
} from "@/lib/market-context/providers/urlUtils";

export type LocalEventsFeedSource = {
  url: string;
  label: string;
  origin: "profile_url" | "website_guess" | "metadata";
};

function uniqueSources(sources: LocalEventsFeedSource[]): LocalEventsFeedSource[] {
  const seen = new Set<string>();
  return sources.filter((source) => {
    if (seen.has(source.url)) return false;
    seen.add(source.url);
    return true;
  });
}

function buildWebsiteFeedGuesses(website: string | null | undefined): LocalEventsFeedSource[] {
  const origin = normalizeWebsiteOrigin(website);
  if (!origin) return [];

  const paths = ["/events/feed", "/calendar/feed", "/events/feed/", "/feed", "/events.rss", "/rss.xml"];

  return paths.map((path) => ({
    url: `${origin}${path}`,
    label: "Business website events feed",
    origin: "website_guess" as const,
  }));
}

/**
 * Discover RSS/calendar URLs from business profile text fields.
 * TODO: Persist dedicated chamber/community calendar URLs on business_profiles.
 * TODO: Eventbrite Discovery API and PredictHQ when API keys are available.
 */
export function discoverLocalEventFeedSources(
  context: MarketContextProviderContext
): LocalEventsFeedSource[] {
  const { businessProfile, aiMarketingProfile } = context;
  const sources: LocalEventsFeedSource[] = [];

  const profileTextFields = [
    businessProfile.website,
    businessProfile.primary_service_area,
    businessProfile.nearby_cities,
    businessProfile.competitors,
    businessProfile.voice_notes,
  ];

  for (const field of profileTextFields) {
    for (const url of extractUrls(field)) {
      if (isLikelyEventFeedUrl(url)) {
        sources.push({
          url,
          label: "Profile event feed URL",
          origin: "profile_url",
        });
      }
    }
  }

  const aiTextFields = [
    aiMarketingProfile?.marketing_strategy,
    aiMarketingProfile?.content_strategy,
    aiMarketingProfile?.business_summary,
  ];

  for (const field of aiTextFields) {
    for (const url of extractUrls(field)) {
      if (isLikelyEventFeedUrl(url)) {
        sources.push({
          url,
          label: "Marketing profile event feed URL",
          origin: "metadata",
        });
      }
    }
  }

  sources.push(...buildWebsiteFeedGuesses(businessProfile.website));

  return uniqueSources(sources).slice(0, 8);
}

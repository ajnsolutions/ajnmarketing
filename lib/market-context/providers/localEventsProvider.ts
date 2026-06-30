import "server-only";

import {
  addDays,
  BaseMarketContextProvider,
  resolveIndustry,
  resolveLocationLabel,
  toIsoDate,
} from "@/lib/market-context/providers/baseMarketContextProvider";
import { discoverLocalEventFeedSources } from "@/lib/market-context/providers/localEventsSources";
import { logMarketContextProviderError } from "@/lib/market-context/providers/providerLogger";
import {
  fetchRssFeedItems,
  filterUpcomingFeedItems,
} from "@/lib/market-context/providers/rssFeedClient";
import type { MarketContextItemInput, MarketContextProviderContext } from "@/lib/market-context/types";

function buildFallbackLocalEventItems(context: MarketContextProviderContext): MarketContextItemInput[] {
  const location = resolveLocationLabel(context);
  const industry = resolveIndustry(context);
  const referenceDate = context.referenceDate;

  return [
    {
      category: "local_event",
      title: `Downtown ${location} weekend market`,
      summary: `Fallback local event signal: a community market this weekend may increase nearby visibility for ${industry} businesses. Consider a presence post, sponsorship mention, or same-day offer.`,
      sourceName: "AJN Market Context (fallback events)",
      sourceUrl: null,
      confidenceScore: 40,
      contextDate: toIsoDate(addDays(referenceDate, 6)),
      expiresAt: addDays(referenceDate, 8).toISOString(),
      metadata: {
        provider: "mock",
        isFallback: true,
        eventType: "community_market",
      },
    },
    {
      category: "local_event",
      title: `Neighborhood business mixer near ${location}`,
      summary: `Fallback networking signal in the next two weeks creates a B2B and referral opportunity. Share attendance or partnership content if relevant to your audience.`,
      sourceName: "AJN Market Context (fallback events)",
      sourceUrl: null,
      confidenceScore: 38,
      contextDate: toIsoDate(addDays(referenceDate, 12)),
      expiresAt: addDays(referenceDate, 14).toISOString(),
      metadata: {
        provider: "mock",
        isFallback: true,
        eventType: "networking",
      },
    },
  ];
}

async function buildRssLocalEventItems(
  context: MarketContextProviderContext
): Promise<MarketContextItemInput[]> {
  const location = resolveLocationLabel(context);
  const industry = resolveIndustry(context);
  const referenceDate = context.referenceDate;
  const feedSources = discoverLocalEventFeedSources(context);

  for (const source of feedSources) {
    const feedItems = await fetchRssFeedItems(source.url, 12);
    const upcoming = filterUpcomingFeedItems(feedItems, referenceDate, 45);

    if (upcoming.length === 0) {
      continue;
    }

    return upcoming.slice(0, 4).map((item) => {
      const eventDate = item.pubDate ?? addDays(referenceDate, 7);
      const description =
        item.description ||
        `Upcoming local event in ${location} that may create content or foot-traffic opportunities for ${industry} businesses.`;

      return {
        category: "local_event" as const,
        title: item.title,
        summary: `${description} Consider timely posts, hours updates, or community engagement around this event.`,
        sourceName: source.label,
        sourceUrl: item.link ?? source.url,
        confidenceScore: 72,
        contextDate: toIsoDate(eventDate),
        expiresAt: addDays(eventDate, 3).toISOString(),
        metadata: {
          provider: "rss",
          isFallback: false,
          feedUrl: source.url,
          feedOrigin: source.origin,
          eventTitle: item.title,
        },
      };
    });
  }

  return [];
}

export class LocalEventsProvider extends BaseMarketContextProvider {
  readonly category = "local_event" as const;

  async fetchItems(context: MarketContextProviderContext): Promise<MarketContextItemInput[]> {
    try {
      const liveItems = await buildRssLocalEventItems(context);
      if (liveItems.length > 0) {
        return liveItems;
      }
    } catch (error) {
      logMarketContextProviderError("local_events", "RSS local events fetch failed", error);
    }

    return buildFallbackLocalEventItems(context);
  }
}

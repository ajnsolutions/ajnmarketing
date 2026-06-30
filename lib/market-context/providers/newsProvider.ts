import {
  addDays,
  BaseMarketContextProvider,
  resolveIndustry,
  resolveLocationLabel,
  resolveServices,
  toIsoDate,
} from "@/lib/market-context/providers/baseMarketContextProvider";
import type { MarketContextItemInput, MarketContextProviderContext } from "@/lib/market-context/types";

export class NewsProvider extends BaseMarketContextProvider {
  readonly category = "news" as const;

  async fetchItems(context: MarketContextProviderContext): Promise<MarketContextItemInput[]> {
    const location = resolveLocationLabel(context);
    const industry = resolveIndustry(context);
    const services = resolveServices(context);
    const primaryService = services[0] ?? industry;
    const referenceDate = context.referenceDate;

    // TODO: Replace with Google News API, NewsAPI.org, or localized RSS ingestion filtered by city/industry.
    return [
      {
        category: this.category,
        title: `Local business spotlight trend in ${location}`,
        summary: `Mock news signal: community publications are featuring small businesses supporting local neighborhoods. A customer story or community involvement post could align with current coverage themes.`,
        sourceName: "AJN Market Context (mock local news)",
        sourceUrl: null,
        confidenceScore: 46,
        contextDate: toIsoDate(referenceDate),
        expiresAt: addDays(referenceDate, 5).toISOString(),
        metadata: {
          provider: "news",
          mock: true,
          topic: "community_business",
        },
      },
      {
        category: this.category,
        title: `${primaryService} demand mentioned in local conversation`,
        summary: `Mock local news/chat signal: residents are discussing ${primaryService} needs in ${location}. Educational content addressing common questions may capture timely interest.`,
        sourceName: "AJN Market Context (mock local news)",
        sourceUrl: null,
        confidenceScore: 44,
        contextDate: toIsoDate(addDays(referenceDate, 2)),
        expiresAt: addDays(referenceDate, 7).toISOString(),
        metadata: {
          provider: "news",
          mock: true,
          topic: "service_demand",
        },
      },
    ];
  }
}

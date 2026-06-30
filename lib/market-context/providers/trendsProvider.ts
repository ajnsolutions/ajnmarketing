import {
  addDays,
  BaseMarketContextProvider,
  resolveIndustry,
  resolveLocationLabel,
  resolveServices,
  toIsoDate,
} from "@/lib/market-context/providers/baseMarketContextProvider";
import type { MarketContextItemInput, MarketContextProviderContext } from "@/lib/market-context/types";

export class TrendsProvider extends BaseMarketContextProvider {
  readonly category = "trend" as const;

  async fetchItems(context: MarketContextProviderContext): Promise<MarketContextItemInput[]> {
    const location = resolveLocationLabel(context);
    const industry = resolveIndustry(context);
    const services = resolveServices(context);
    const referenceDate = context.referenceDate;
    const monthName = referenceDate.toLocaleString("en-US", { month: "long" });

    // TODO: Replace with Google Trends, Semrush, or DataForSEO local keyword trend APIs.
    const keywords = [
      `${services[0] ?? industry} near me`,
      `${industry} ${location.split(",")[0]?.trim() ?? "local"}`,
      `best ${industry} reviews`,
    ].filter(Boolean);

    return [
      {
        category: this.category,
        title: `Rising local search interest for ${industry}`,
        summary: `Mock trend signal: "${keywords[0]}" shows increasing local search momentum in ${monthName}. Pair educational posts with localized keywords and service-area pages.`,
        sourceName: "AJN Market Context (mock trends)",
        sourceUrl: null,
        confidenceScore: 52,
        contextDate: toIsoDate(referenceDate),
        expiresAt: addDays(referenceDate, 14).toISOString(),
        metadata: {
          provider: "trends",
          mock: true,
          keywords,
          location,
        },
      },
      {
        category: this.category,
        title: `Seasonal content angle for ${location}`,
        summary: `Mock trend signal: ${monthName} content combining seasonal hooks with ${industry} expertise is outperforming generic promotional posts in similar markets.`,
        sourceName: "AJN Market Context (mock trends)",
        sourceUrl: null,
        confidenceScore: 50,
        contextDate: toIsoDate(referenceDate),
        expiresAt: addDays(referenceDate, 10).toISOString(),
        metadata: {
          provider: "trends",
          mock: true,
          angle: "seasonal_expertise",
        },
      },
    ];
  }
}

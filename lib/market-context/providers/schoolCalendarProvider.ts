import {
  addDays,
  BaseMarketContextProvider,
  resolveIndustry,
  resolveLocationLabel,
  toIsoDate,
} from "@/lib/market-context/providers/baseMarketContextProvider";
import type { MarketContextItemInput, MarketContextProviderContext } from "@/lib/market-context/types";

export class SchoolCalendarProvider extends BaseMarketContextProvider {
  readonly category = "school_calendar" as const;

  async fetchItems(context: MarketContextProviderContext): Promise<MarketContextItemInput[]> {
    const location = resolveLocationLabel(context);
    const industry = resolveIndustry(context);
    const referenceDate = context.referenceDate;
    const month = referenceDate.getMonth() + 1;

    // TODO: Replace with ICS district calendars or a school-calendar API keyed by ZIP/city.
    const seasonalSignals =
      month >= 8 && month <= 9
        ? {
            title: `Back-to-school season in ${location}`,
            summary: `Families are resetting routines around school start. ${industry} businesses can highlight scheduling flexibility, after-school availability, and family-focused offers.`,
          }
        : month === 3 || month === 4
          ? {
              title: `Spring break window near ${location}`,
              summary: `Mock school calendar signal: spring break may shift local demand and travel patterns. Consider seasonal content and adjusted hours messaging.`,
            }
          : month === 11 || month === 12
            ? {
                title: `Holiday school breaks approaching in ${location}`,
                summary: `Upcoming school breaks often increase daytime appointments and family decision-making. Plan content around convenience and holiday prep.`,
              }
            : {
                title: `Standard school-week rhythm in ${location}`,
                summary: `Mock calendar baseline: weekday mornings and after-school windows remain high-intent periods for local service discovery.`,
              };

    return [
      {
        category: this.category,
        title: seasonalSignals.title,
        summary: seasonalSignals.summary,
        sourceName: "AJN Market Context (mock school calendar)",
        sourceUrl: null,
        confidenceScore: 58,
        contextDate: toIsoDate(referenceDate),
        expiresAt: addDays(referenceDate, 14).toISOString(),
        metadata: {
          provider: "school_calendar",
          mock: true,
          month,
        },
      },
    ];
  }
}

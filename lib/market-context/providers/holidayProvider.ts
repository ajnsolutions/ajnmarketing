import "server-only";

import {
  addDays,
  BaseMarketContextProvider,
  resolveIndustry,
  resolveLocationLabel,
  toIsoDate,
} from "@/lib/market-context/providers/baseMarketContextProvider";
import { isUsLocation } from "@/lib/market-context/providers/geocoding";
import {
  fetchUpcomingNagerHolidays,
  holidayMarketingAngle,
} from "@/lib/market-context/providers/nagerDateClient";
import type { MarketContextItemInput, MarketContextProviderContext } from "@/lib/market-context/types";

const FALLBACK_HOLIDAYS: Array<{ month: number; day: number; name: string; angle: string }> = [
  { month: 1, day: 1, name: "New Year's Day", angle: "fresh-start promotions and annual planning" },
  { month: 2, day: 14, name: "Valentine's Day", angle: "community appreciation and gift/service bundles" },
  { month: 7, day: 4, name: "Independence Day", angle: "patriotic community posts and holiday hours" },
  { month: 11, day: 28, name: "Thanksgiving", angle: "gratitude messaging and seasonal prep reminders" },
  { month: 12, day: 25, name: "Christmas", angle: "holiday hours, gifting, and year-end thank-you content" },
];

function buildMockHolidayItems(context: MarketContextProviderContext): MarketContextItemInput[] {
  const location = resolveLocationLabel(context);
  const industry = resolveIndustry(context);
  const referenceDate = context.referenceDate;
  const year = referenceDate.getFullYear();

  const upcoming = FALLBACK_HOLIDAYS.map((holiday) => {
    const date = new Date(year, holiday.month - 1, holiday.day);
    if (date < referenceDate) {
      date.setFullYear(year + 1);
    }
    return { ...holiday, date };
  })
    .filter((holiday) => {
      const daysUntil = Math.ceil(
        (holiday.date.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      return daysUntil >= 0 && daysUntil <= 45;
    })
    .slice(0, 3);

  return upcoming.map((holiday) => ({
    category: "holiday",
    title: `${holiday.name} approaching in ${location}`,
    summary: `Upcoming ${holiday.name} is a timely hook for ${industry} content focused on ${holiday.angle}. Plan posts 7–14 days ahead to capture local search interest.`,
    sourceName: "AJN Market Context (fallback holidays)",
    sourceUrl: null,
    confidenceScore: 55,
    contextDate: toIsoDate(holiday.date),
    expiresAt: addDays(holiday.date, 1).toISOString(),
    metadata: {
      provider: "mock",
      isFallback: true,
      holidayName: holiday.name,
      daysUntil: Math.ceil(
        (holiday.date.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24)
      ),
    },
  }));
}

async function buildNagerHolidayItems(
  context: MarketContextProviderContext
): Promise<MarketContextItemInput[]> {
  const location = resolveLocationLabel(context);
  const industry = resolveIndustry(context);
  const referenceDate = context.referenceDate;

  if (!isUsLocation(context.businessProfile.state)) {
    return [];
  }

  const holidays = await fetchUpcomingNagerHolidays({
    countryCode: "US",
    referenceDate,
    maxDaysAhead: 45,
    limit: 5,
  });

  if (holidays.length === 0) {
    return [];
  }

  return holidays.map((holiday) => {
    const holidayDate = new Date(`${holiday.date}T12:00:00`);
    const displayName = holiday.localName || holiday.name;
    const angle = holidayMarketingAngle(displayName);

    return {
      category: "holiday" as const,
      title: `${displayName} approaching in ${location}`,
      summary: `Public holiday ${displayName} on ${holiday.date} is a timely hook for ${industry} content focused on ${angle}. Plan posts 7–14 days ahead to capture local search interest.`,
      sourceName: "Nager.Date Public Holidays",
      sourceUrl: `https://date.nager.at/Holiday/${holiday.countryCode}/${holiday.date}`,
      confidenceScore: 85,
      contextDate: toIsoDate(holidayDate),
      expiresAt: addDays(holidayDate, 1).toISOString(),
      metadata: {
        provider: "nager.date",
        isFallback: false,
        holidayName: displayName,
        globalHoliday: holiday.global,
        holidayTypes: holiday.types,
        daysUntil: Math.ceil(
          (holidayDate.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24)
        ),
      },
    };
  });
}

export class HolidayProvider extends BaseMarketContextProvider {
  readonly category = "holiday" as const;

  async fetchItems(context: MarketContextProviderContext): Promise<MarketContextItemInput[]> {
    try {
      const liveItems = await buildNagerHolidayItems(context);
      if (liveItems.length > 0) {
        return liveItems;
      }
    } catch {
      // Provider failure should not break the brief; fall back below.
    }

    return buildMockHolidayItems(context);
  }
}

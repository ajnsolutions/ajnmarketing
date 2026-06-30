import "server-only";

import {
  addDays,
  BaseMarketContextProvider,
  resolveIndustry,
  resolveLocationLabel,
  resolveServices,
  toIsoDate,
} from "@/lib/market-context/providers/baseMarketContextProvider";
import { isUsLocation, resolveUsCoordinates } from "@/lib/market-context/providers/geocoding";
import {
  fetchWeatherGovForecast,
  findWeekendPeriods,
  summarizeWeatherOutlook,
} from "@/lib/market-context/providers/weatherGovClient";
import type { MarketContextItemInput, MarketContextProviderContext } from "@/lib/market-context/types";

function buildMockWeatherItems(context: MarketContextProviderContext): MarketContextItemInput[] {
  const location = resolveLocationLabel(context);
  const industry = resolveIndustry(context);
  const services = resolveServices(context);
  const primaryService = services[0] ?? industry;
  const referenceDate = context.referenceDate;

  const seasonalOutlook =
    referenceDate.getMonth() >= 5 && referenceDate.getMonth() <= 8
      ? "warmer-than-average temperatures with afternoon storms"
      : referenceDate.getMonth() >= 11 || referenceDate.getMonth() <= 1
        ? "colder conditions with potential freeze/thaw cycles"
        : "mild swings between warm days and cooler nights";

  return [
    {
      category: "weather",
      title: `7-day weather outlook for ${location}`,
      summary: `Fallback forecast indicates ${seasonalOutlook}. For ${primaryService} businesses, highlight preparedness messaging and timely service reminders tied to changing conditions.`,
      sourceName: "AJN Market Context (fallback weather)",
      sourceUrl: null,
      confidenceScore: 45,
      contextDate: toIsoDate(referenceDate),
      expiresAt: addDays(referenceDate, 7).toISOString(),
      metadata: {
        provider: "mock",
        isFallback: true,
        location,
        outlook: seasonalOutlook,
      },
    },
    {
      category: "weather",
      title: `Weekend weather window in ${location}`,
      summary: `Fallback data suggests reviewing weekend demand patterns for ${industry} providers and preparing timely local content.`,
      sourceName: "AJN Market Context (fallback weather)",
      sourceUrl: null,
      confidenceScore: 40,
      contextDate: toIsoDate(addDays(referenceDate, 5)),
      expiresAt: addDays(referenceDate, 8).toISOString(),
      metadata: {
        provider: "mock",
        isFallback: true,
        signalType: "weekend_traffic",
      },
    },
  ];
}

async function buildWeatherGovItems(
  context: MarketContextProviderContext
): Promise<MarketContextItemInput[]> {
  const { businessProfile } = context;
  const location = resolveLocationLabel(context);
  const industry = resolveIndustry(context);
  const services = resolveServices(context);
  const primaryService = services[0] ?? industry;
  const referenceDate = context.referenceDate;

  if (!isUsLocation(businessProfile.state)) {
    return [];
  }

  const coordinates = await resolveUsCoordinates({
    city: businessProfile.city,
    state: businessProfile.state,
  });

  if (!coordinates) {
    return [];
  }

  const forecast = await fetchWeatherGovForecast(coordinates.latitude, coordinates.longitude);
  if (!forecast || forecast.periods.length === 0) {
    return [];
  }

  const outlook = summarizeWeatherOutlook(forecast.periods);
  const items: MarketContextItemInput[] = [
    {
      category: "weather",
      title: `7-day weather outlook for ${location}`,
      summary: `National Weather Service forecast for ${coordinates.label}: ${outlook}. For ${primaryService} businesses, align preparedness and service reminders with these conditions.`,
      sourceName: "National Weather Service",
      sourceUrl: forecast.forecastUrl,
      confidenceScore: 82,
      contextDate: toIsoDate(referenceDate),
      expiresAt: addDays(referenceDate, 7).toISOString(),
      metadata: {
        provider: "weather.gov",
        isFallback: false,
        location: coordinates.label,
        geocodeSource: coordinates.source,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        outlook,
      },
    },
  ];

  const weekendPeriods = findWeekendPeriods(forecast.periods, referenceDate);
  if (weekendPeriods.length > 0) {
    const weekendSummary = weekendPeriods
      .slice(0, 2)
      .map((period) => `${period.name}: ${period.shortForecast}`)
      .join("; ");

    items.push({
      category: "weather",
      title: `Weekend weather window in ${location}`,
      summary: `NWS weekend outlook: ${weekendSummary}. Use this timing for local ${industry} content, hours messaging, or same-day service reminders.`,
      sourceName: "National Weather Service",
      sourceUrl: forecast.forecastUrl,
      confidenceScore: 78,
      contextDate: toIsoDate(new Date(weekendPeriods[0].startTime)),
      expiresAt: addDays(referenceDate, 8).toISOString(),
      metadata: {
        provider: "weather.gov",
        isFallback: false,
        signalType: "weekend_traffic",
        geocodeSource: coordinates.source,
      },
    });
  }

  return items;
}

export class WeatherProvider extends BaseMarketContextProvider {
  readonly category = "weather" as const;

  async fetchItems(context: MarketContextProviderContext): Promise<MarketContextItemInput[]> {
    try {
      const liveItems = await buildWeatherGovItems(context);
      if (liveItems.length > 0) {
        return liveItems;
      }
    } catch {
      // Provider failure should not break the brief; fall back below.
    }

    return buildMockWeatherItems(context);
  }
}

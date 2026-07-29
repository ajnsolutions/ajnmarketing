/**
 * Designed-but-unimplemented External Intelligence providers.
 * Interfaces only — fetchSignals returns empty arrays (never fabricates).
 */

import {
  createUnimplementedProvider,
  type ExternalIntelligenceProvider,
} from "@/lib/external-intelligence/provider";
import { ExternalIntelligenceProviderIds } from "@/lib/external-intelligence/types";

export function createGoogleTrendsProvider(): ExternalIntelligenceProvider {
  return createUnimplementedProvider(
    ExternalIntelligenceProviderIds.GOOGLE_TRENDS,
    "Google Trends",
  );
}

export function createWeatherProvider(): ExternalIntelligenceProvider {
  return createUnimplementedProvider(ExternalIntelligenceProviderIds.WEATHER, "Weather");
}

export function createLocalEventsProvider(): ExternalIntelligenceProvider {
  return createUnimplementedProvider(
    ExternalIntelligenceProviderIds.LOCAL_EVENTS,
    "Local Events",
  );
}

export function createIndustryNewsProvider(): ExternalIntelligenceProvider {
  return createUnimplementedProvider(
    ExternalIntelligenceProviderIds.INDUSTRY_NEWS,
    "Industry News",
  );
}

export function createGoogleBusinessInsightsProvider(): ExternalIntelligenceProvider {
  return createUnimplementedProvider(
    ExternalIntelligenceProviderIds.GOOGLE_BUSINESS_INSIGHTS,
    "Google Business Insights",
  );
}

export function createCompetitorMonitoringProvider(): ExternalIntelligenceProvider {
  return createUnimplementedProvider(
    ExternalIntelligenceProviderIds.COMPETITOR_MONITORING,
    "Competitor Monitoring",
  );
}

export function createHolidayCalendarProvider(): ExternalIntelligenceProvider {
  return createUnimplementedProvider(
    ExternalIntelligenceProviderIds.HOLIDAY_CALENDAR,
    "Holiday Calendar",
  );
}

export function createSearchConsoleProvider(): ExternalIntelligenceProvider {
  return createUnimplementedProvider(
    ExternalIntelligenceProviderIds.SEARCH_CONSOLE,
    "Search Console",
  );
}

/** All designed providers — empty by default for foundation registry smoke tests. */
export function createDesignedExternalProviders(): ExternalIntelligenceProvider[] {
  return [
    createGoogleTrendsProvider(),
    createWeatherProvider(),
    createLocalEventsProvider(),
    createIndustryNewsProvider(),
    createGoogleBusinessInsightsProvider(),
    createCompetitorMonitoringProvider(),
    createHolidayCalendarProvider(),
    createSearchConsoleProvider(),
  ];
}

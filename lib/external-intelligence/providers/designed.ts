/**
 * Designed-but-unimplemented External Intelligence providers.
 * Interfaces only — fetchSignals returns empty arrays (never fabricates).
 */

import {
  createUnimplementedProvider,
  type ExternalIntelligenceProvider,
  type ExternalIntelligenceProviderResult,
} from "@/lib/external-intelligence/provider";
import {
  ExternalIntelligenceProviderIds,
  type ExternalIntelligenceProviderContext,
} from "@/lib/external-intelligence/types";
import { getGoogleSearchConsoleConnectionStatusForUser } from "@/lib/google-search-console/service";
import { getSearchConsoleMetricsForBusiness } from "@/lib/google-search-console/persistence";
import { buildSearchConsoleSignals } from "@/lib/google-search-console/normalize";
import { createClient } from "@/lib/supabase/server";

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

/**
 * Search Console — first live External Intelligence source. Reads the caller's own
 * stored connection + normalized metric snapshots (lib/google-search-console) and
 * turns them into rising/declining query, page visibility, and opportunity signals.
 * Returns empty signals (never fabricated) when not connected, no property selected,
 * or no synced data yet — normalize.ts never invents a trend from absent evidence.
 */
export function createSearchConsoleProvider(): ExternalIntelligenceProvider {
  const id = ExternalIntelligenceProviderIds.SEARCH_CONSOLE;
  const label = "Search Console";

  return {
    id,
    label,
    async fetchSignals(
      context: ExternalIntelligenceProviderContext,
    ): Promise<ExternalIntelligenceProviderResult> {
      const fetchedAt = new Date().toISOString();

      try {
        const supabase = await createClient();
        const status = await getGoogleSearchConsoleConnectionStatusForUser(context.userId, supabase);

        if (!status.connected || !status.connection?.selected_site_url) {
          return {
            providerId: id,
            sourceLabel: label,
            fetchedAt,
            signals: [],
            notes: [
              status.connected
                ? "Search Console is connected but no property is selected yet."
                : "Search Console is not connected.",
            ],
          };
        }

        const [queries, pages] = await Promise.all([
          getSearchConsoleMetricsForBusiness(supabase, context.businessProfileId, "query"),
          getSearchConsoleMetricsForBusiness(supabase, context.businessProfileId, "page"),
        ]);

        if (queries.current.length === 0 && pages.current.length === 0) {
          return {
            providerId: id,
            sourceLabel: label,
            fetchedAt,
            signals: [],
            notes: ["Search Console is connected but has not synced data yet."],
          };
        }

        const signals = buildSearchConsoleSignals({
          currentQueries: queries.current,
          previousQueries: queries.previous,
          currentPages: pages.current,
          previousPages: pages.previous,
        });

        return { providerId: id, sourceLabel: label, fetchedAt, signals };
      } catch {
        // Never let a Search Console read failure break the rest of External
        // Intelligence composition — fail closed to empty signals for this source.
        return {
          providerId: id,
          sourceLabel: label,
          fetchedAt,
          signals: [],
          notes: ["Search Console signals were unavailable this run."],
        };
      }
    },
  };
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

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveGoogleLocationIds } from "@/lib/google-business/auth";
import { GOOGLE_BUSINESS_PERFORMANCE_BASE, googleApiFetch } from "@/lib/google-business/google-api";
import { upsertGoogleBusinessInsightDay } from "@/lib/google-business/persistence";
import type { GoogleBusinessLocation } from "@/lib/google-business/types";

type DailyMetric =
  | "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH"
  | "BUSINESS_IMPRESSIONS_MOBILE_SEARCH"
  | "BUSINESS_IMPRESSIONS_DESKTOP_MAPS"
  | "BUSINESS_IMPRESSIONS_MOBILE_MAPS"
  | "CALL_CLICKS"
  | "WEBSITE_CLICKS"
  | "BUSINESS_DIRECTION_REQUESTS";

const METRICS: DailyMetric[] = [
  "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
  "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
  "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
  "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
  "CALL_CLICKS",
  "WEBSITE_CLICKS",
  "BUSINESS_DIRECTION_REQUESTS",
];

function formatDateParts(date: Date) {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function periodMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export async function syncGoogleBusinessInsights(
  supabase: SupabaseClient,
  input: {
    userId: string;
    businessProfileId: string;
    accessToken: string;
    location: GoogleBusinessLocation;
  }
): Promise<number> {
  const { locationId } = resolveGoogleLocationIds(input.location);

  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setUTCDate(startDate.getUTCDate() - 89);

  const response = await googleApiFetch<{
    multiDailyMetricTimeSeries?: Array<{
      dailyMetricTimeSeries?: Array<{
        dailyMetric?: DailyMetric;
        timeSeries?: {
          datedValues?: Array<{
            date?: { year?: number; month?: number; day?: number };
            value?: string;
          }>;
        };
      }>;
    }>;
  }>(
    `${GOOGLE_BUSINESS_PERFORMANCE_BASE}/locations/${locationId}:fetchMultiDailyMetricsTimeSeries`,
    input.accessToken,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dailyMetrics: METRICS,
        dailyRange: {
          startDate: formatDateParts(startDate),
          endDate: formatDateParts(endDate),
        },
      }),
    }
  );

  const dailyTotals = new Map<
    string,
    {
      searchViews: number;
      mapsViews: number;
      websiteClicks: number;
      phoneCalls: number;
      directionRequests: number;
    }
  >();

  for (const group of response.multiDailyMetricTimeSeries ?? []) {
    for (const series of group.dailyMetricTimeSeries ?? []) {
      const metric = series.dailyMetric;
      if (!metric) continue;

      for (const entry of series.timeSeries?.datedValues ?? []) {
        const year = entry.date?.year;
        const month = entry.date?.month;
        const day = entry.date?.day;
        if (!year || !month || !day) continue;

        const key = isoDate(year, month, day);
        const current = dailyTotals.get(key) ?? {
          searchViews: 0,
          mapsViews: 0,
          websiteClicks: 0,
          phoneCalls: 0,
          directionRequests: 0,
        };

        const value = Number(entry.value ?? 0);

        switch (metric) {
          case "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH":
          case "BUSINESS_IMPRESSIONS_MOBILE_SEARCH":
            current.searchViews += value;
            break;
          case "BUSINESS_IMPRESSIONS_DESKTOP_MAPS":
          case "BUSINESS_IMPRESSIONS_MOBILE_MAPS":
            current.mapsViews += value;
            break;
          case "WEBSITE_CLICKS":
            current.websiteClicks += value;
            break;
          case "CALL_CLICKS":
            current.phoneCalls += value;
            break;
          case "BUSINESS_DIRECTION_REQUESTS":
            current.directionRequests += value;
            break;
        }

        dailyTotals.set(key, current);
      }
    }
  }

  let insightsSynced = 0;

  for (const [dateKey, totals] of [...dailyTotals.entries()].sort()) {
    const [year, month] = dateKey.split("-").map(Number);

    const saved = await upsertGoogleBusinessInsightDay(supabase, {
      userId: input.userId,
      businessProfileId: input.businessProfileId,
      locationId: input.location.id,
      metricDate: dateKey,
      periodMonth: periodMonth(year, month),
      searchViews: totals.searchViews,
      mapsViews: totals.mapsViews,
      websiteClicks: totals.websiteClicks,
      phoneCalls: totals.phoneCalls,
      directionRequests: totals.directionRequests,
      rawMetricsJson: totals,
    });

    if (saved) insightsSynced += 1;
  }

  return insightsSynced;
}

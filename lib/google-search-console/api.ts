import "server-only";

import { googleApiFetch } from "@/lib/google-business/google-api";
import type { SearchAnalyticsApiRow } from "@/lib/google-search-console/types";

export const SEARCH_CONSOLE_API_BASE = "https://www.googleapis.com/webmasters/v3";

type SitesListResponse = {
  siteEntry?: Array<{ siteUrl: string; permissionLevel: string }>;
};

type SearchAnalyticsQueryResponse = {
  rows?: SearchAnalyticsApiRow[];
};

/** Sites the connected Google account can access (property discovery). */
export async function listSearchConsoleSites(
  accessToken: string
): Promise<Array<{ siteUrl: string; permissionLevel: string }>> {
  const response = await googleApiFetch<SitesListResponse>(
    `${SEARCH_CONSOLE_API_BASE}/sites`,
    accessToken
  );

  return (response.siteEntry ?? []).filter(
    (entry) => entry.permissionLevel !== "siteUnverifiedUser"
  );
}

/**
 * Query Search Analytics for one site over one date range, grouped by a single
 * dimension (query or page). Google's API path segment for the site URL must be
 * percent-encoded even though the URL itself contains slashes/colons.
 */
export async function querySearchAnalytics(
  accessToken: string,
  siteUrl: string,
  input: { startDate: string; endDate: string; dimension: "query" | "page"; rowLimit?: number }
): Promise<SearchAnalyticsApiRow[]> {
  const encodedSite = encodeURIComponent(siteUrl);
  const response = await googleApiFetch<SearchAnalyticsQueryResponse>(
    `${SEARCH_CONSOLE_API_BASE}/sites/${encodedSite}/searchAnalytics/query`,
    accessToken,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startDate: input.startDate,
        endDate: input.endDate,
        dimensions: [input.dimension],
        rowLimit: input.rowLimit ?? 250,
      }),
    }
  );

  return response.rows ?? [];
}

import type { AnalyticsPageData } from "@/lib/analytics/analyticsTypes";

export async function fetchAnalyticsPageData(): Promise<{
  pageData: AnalyticsPageData | null;
  error?: string;
}> {
  const response = await fetch("/api/analytics", { method: "GET" });
  const payload = (await response.json()) as {
    pageData?: AnalyticsPageData | null;
    error?: string;
  };

  if (!response.ok) {
    return { pageData: null, error: payload.error ?? "Unable to load analytics intelligence" };
  }

  return { pageData: payload.pageData ?? null };
}

export async function refreshAnalyticsIntelligence(): Promise<{
  pageData: AnalyticsPageData | null;
  error?: string;
}> {
  const response = await fetch("/api/analytics", { method: "POST" });
  const payload = (await response.json()) as {
    pageData?: AnalyticsPageData | null;
    error?: string;
  };

  if (!response.ok) {
    return {
      pageData: null,
      error: payload.error ?? "Unable to refresh analytics intelligence",
    };
  }

  return { pageData: payload.pageData ?? null };
}

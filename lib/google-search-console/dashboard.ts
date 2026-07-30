import "server-only";

/** Manage-page data: connection health + a customer-facing preview of what Search
 * Console is currently contributing to the Business Brain. Reuses the exact same
 * normalization the External Intelligence provider uses — this page never computes
 * its own separate view of the evidence. */
import { getSearchConsoleMetricsForBusiness } from "@/lib/google-search-console/persistence";
import { buildSearchConsoleSignals } from "@/lib/google-search-console/normalize";
import { getGoogleSearchConsoleConnectionStatusForCurrentUser } from "@/lib/google-search-console/service";
import type { GoogleSearchConsoleConnectionStatusResult } from "@/lib/google-search-console/types";
import { createClient } from "@/lib/supabase/server";

export type SearchConsoleBusinessBrainPreview = {
  title: string;
  summary: string;
};

export type SearchConsoleDashboardData = {
  status: GoogleSearchConsoleConnectionStatusResult;
  /** Null until connected + a property is selected + at least one sync has completed. */
  contribution: SearchConsoleBusinessBrainPreview[] | null;
  /** Present only when connected but no evidence is available yet — never an error. */
  emptyReason: string | null;
};

export async function getSearchConsoleDashboardDataForCurrentUser(): Promise<SearchConsoleDashboardData> {
  const status = await getGoogleSearchConsoleConnectionStatusForCurrentUser();

  if (!status.connected) {
    return { status, contribution: null, emptyReason: null };
  }

  if (!status.propertySelected) {
    return {
      status,
      contribution: null,
      emptyReason: "Select a property to start building Business Brain evidence.",
    };
  }

  const supabase = await createClient();
  const businessProfileId = status.connection?.business_profile_id;
  if (!businessProfileId) {
    return { status, contribution: null, emptyReason: null };
  }

  const [queries, pages] = await Promise.all([
    getSearchConsoleMetricsForBusiness(supabase, businessProfileId, "query"),
    getSearchConsoleMetricsForBusiness(supabase, businessProfileId, "page"),
  ]);

  if (queries.current.length === 0 && pages.current.length === 0) {
    return {
      status,
      contribution: null,
      emptyReason:
        "No search performance data yet. Google Search Console usually takes 2-3 days to finalize new data, and this is normal for a newly connected property — sync again in a few days.",
    };
  }

  const signals = buildSearchConsoleSignals({
    currentQueries: queries.current,
    previousQueries: queries.previous,
    currentPages: pages.current,
    previousPages: pages.previous,
  });

  if (signals.length === 0) {
    return {
      status,
      contribution: null,
      emptyReason:
        "Search performance is steady — no notable rising, declining, or opportunity signals this period. That's a fine, calm result, not a problem.",
    };
  }

  return {
    status,
    contribution: signals.slice(0, 8).map((signal) => ({ title: signal.title, summary: signal.summary })),
    emptyReason: null,
  };
}

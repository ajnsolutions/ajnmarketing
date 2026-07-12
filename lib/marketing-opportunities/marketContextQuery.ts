import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { MarketContextCategory, MarketContextItem } from "@/lib/market-context/types";

const RELEVANT_CATEGORIES: MarketContextCategory[] = ["holiday", "weather", "local_event"];

/**
 * Reads existing market_context_items for the holiday/weather/local-event detectors.
 * Deliberately does NOT call the underlying providers (nagerDateClient, weatherProvider,
 * localEventsProvider) itself — those already run as part of the Market Context Agent,
 * and this engine reuses their persisted output instead of duplicating API calls.
 * Bounded to the next `lookAheadDays` days rather than an unbounded scan; the detectors
 * apply the precise expiry check against each item's own expires_at.
 */
export async function getRecentMarketContextItemsForUser(
  supabase: SupabaseClient,
  userId: string,
  lookAheadDays = 30
): Promise<MarketContextItem[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + lookAheadDays);
  const cutoffDate = cutoff.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("market_context_items")
    .select("*")
    .eq("user_id", userId)
    .in("category", RELEVANT_CATEGORIES)
    .lte("context_date", cutoffDate)
    .order("context_date", { ascending: true });

  if (error) {
    throw new Error(
      `getRecentMarketContextItemsForUser: failed to read market_context_items (${error.message})`
    );
  }

  return (data ?? []) as MarketContextItem[];
}

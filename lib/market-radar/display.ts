import { sortMarketRadarEntries } from "@/lib/market-radar/sort";
import { MarketRadarEntryKinds, type MarketRadarEntry } from "@/lib/market-radar/types";

export type MarketRadarDisplayGroups = {
  competitors: MarketRadarEntry[];
  benchmarks: MarketRadarEntry[];
};

/**
 * Splits an already-fetched entry list into the two groups the owner-facing
 * view renders separately (Tracking N competitors / Benchmarking), reusing
 * lib/market-radar/sort.ts's ordering rather than reimplementing it.
 */
export function groupMarketRadarEntriesForDisplay(entries: MarketRadarEntry[]): MarketRadarDisplayGroups {
  const sorted = sortMarketRadarEntries(entries);
  return {
    competitors: sorted.filter((entry) => entry.kind === MarketRadarEntryKinds.COMPETITOR),
    benchmarks: sorted.filter((entry) => entry.kind === MarketRadarEntryKinds.BENCHMARK),
  };
}

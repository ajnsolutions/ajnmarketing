import { MarketRadarEntryKinds, type MarketRadarEntry } from "@/lib/market-radar/types";

function byPriorityThenName(a: MarketRadarEntry, b: MarketRadarEntry): number {
  if (a.priority !== b.priority) {
    if (a.priority === null) return 1;
    if (b.priority === null) return -1;
    return a.priority - b.priority;
  }
  return a.name.localeCompare(b.name);
}

function byName(a: MarketRadarEntry, b: MarketRadarEntry): number {
  return a.name.localeCompare(b.name);
}

/**
 * Competitors first — ordered by priority ascending (nulls last), then name
 * — followed by benchmarks, ordered by name. Pure so it can be unit-tested
 * without a database; lib/market-radar/persistence.ts applies it after
 * fetching a business's entries.
 */
export function sortMarketRadarEntries(entries: MarketRadarEntry[]): MarketRadarEntry[] {
  const competitors = entries
    .filter((entry) => entry.kind === MarketRadarEntryKinds.COMPETITOR)
    .sort(byPriorityThenName);
  const benchmarks = entries
    .filter((entry) => entry.kind === MarketRadarEntryKinds.BENCHMARK)
    .sort(byName);

  return [...competitors, ...benchmarks];
}

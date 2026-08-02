/**
 * Market Radar: owner-managed persistence foundation — the data model
 * behind docs/project-magic/MARKET_RADAR.md's "Owner control" section
 * (add/remove/prioritize a competitor, benchmark an aspirational company).
 * Persistence and types only; see lib/market-radar/persistence.ts for the
 * tenant-scoped read/write functions and lib/market-radar/sort.ts for the
 * pure list-ordering rule. Deliberately separate from lib/market-context/'s
 * existing competitor signal pipeline, which this does not modify.
 */

export const MarketRadarEntryKinds = {
  COMPETITOR: "competitor",
  BENCHMARK: "benchmark",
} as const;

export type MarketRadarEntryKind = (typeof MarketRadarEntryKinds)[keyof typeof MarketRadarEntryKinds];

/** One row of public.market_radar_entries, as read from the database. */
export type MarketRadarEntry = {
  id: string;
  userId: string;
  businessProfileId: string;
  kind: MarketRadarEntryKind;
  name: string;
  /** Meaningful only when kind is "competitor"; null for benchmarks. */
  priority: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

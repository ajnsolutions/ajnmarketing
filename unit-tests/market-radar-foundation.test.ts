import { test } from "node:test";
import assert from "node:assert/strict";

import { sortMarketRadarEntries } from "../lib/market-radar/sort.ts";
import { MarketRadarEntryKinds, type MarketRadarEntry } from "../lib/market-radar/types.ts";

function entry(overrides: Partial<MarketRadarEntry> = {}): MarketRadarEntry {
  return {
    id: "entry-1",
    userId: "user-1",
    businessProfileId: "business-1",
    kind: MarketRadarEntryKinds.COMPETITOR,
    name: "Acme Co",
    priority: null,
    notes: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

test("sortMarketRadarEntries orders competitors by priority ascending", () => {
  const low = entry({ id: "low", name: "Low Priority", priority: 5 });
  const high = entry({ id: "high", name: "High Priority", priority: 1 });
  const mid = entry({ id: "mid", name: "Mid Priority", priority: 3 });

  const sorted = sortMarketRadarEntries([low, high, mid]);

  assert.deepEqual(
    sorted.map((e) => e.id),
    ["high", "mid", "low"],
  );
});

test("sortMarketRadarEntries places competitors with null priority after prioritized ones, ordered by name", () => {
  const unprioritized = entry({ id: "unprioritized", name: "Zeta", priority: null });
  const zPrioritized = entry({ id: "z-prioritized", name: "Zulu", priority: 2 });
  const anotherUnprioritized = entry({ id: "another-unprioritized", name: "Alpha", priority: null });

  const sorted = sortMarketRadarEntries([unprioritized, zPrioritized, anotherUnprioritized]);

  assert.deepEqual(
    sorted.map((e) => e.id),
    ["z-prioritized", "another-unprioritized", "unprioritized"],
  );
});

test("sortMarketRadarEntries places all benchmarks after all competitors, ordered by name", () => {
  const competitor = entry({ id: "competitor", name: "Zzz Competitor", kind: MarketRadarEntryKinds.COMPETITOR, priority: 1 });
  const benchmarkB = entry({ id: "benchmark-b", name: "Bravo Benchmark", kind: MarketRadarEntryKinds.BENCHMARK, priority: null });
  const benchmarkA = entry({ id: "benchmark-a", name: "Alpha Benchmark", kind: MarketRadarEntryKinds.BENCHMARK, priority: null });

  const sorted = sortMarketRadarEntries([benchmarkB, competitor, benchmarkA]);

  assert.deepEqual(
    sorted.map((e) => e.id),
    ["competitor", "benchmark-a", "benchmark-b"],
  );
});

test("sortMarketRadarEntries returns an empty array unchanged", () => {
  assert.deepEqual(sortMarketRadarEntries([]), []);
});

test("sortMarketRadarEntries does not mutate the input array", () => {
  const entries = [entry({ id: "a", name: "B", priority: 2 }), entry({ id: "b", name: "A", priority: 1 })];
  const original = [...entries];

  sortMarketRadarEntries(entries);

  assert.deepEqual(entries, original);
});

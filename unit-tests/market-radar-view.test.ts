import { test } from "node:test";
import assert from "node:assert/strict";

import { groupMarketRadarEntriesForDisplay } from "../lib/market-radar/display.ts";
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

test("groupMarketRadarEntriesForDisplay separates competitors from benchmarks", () => {
  const competitor = entry({ id: "competitor", name: "Rival Co", kind: MarketRadarEntryKinds.COMPETITOR });
  const benchmark = entry({ id: "benchmark", name: "Dream Co", kind: MarketRadarEntryKinds.BENCHMARK });

  const groups = groupMarketRadarEntriesForDisplay([benchmark, competitor]);

  assert.deepEqual(groups.competitors.map((e) => e.id), ["competitor"]);
  assert.deepEqual(groups.benchmarks.map((e) => e.id), ["benchmark"]);
});

test("groupMarketRadarEntriesForDisplay reuses sortMarketRadarEntries ordering within each group", () => {
  const lowPriority = entry({ id: "low", name: "Low Priority", kind: MarketRadarEntryKinds.COMPETITOR, priority: 5 });
  const highPriority = entry({ id: "high", name: "High Priority", kind: MarketRadarEntryKinds.COMPETITOR, priority: 1 });
  const benchmarkZ = entry({ id: "benchmark-z", name: "Zulu Benchmark", kind: MarketRadarEntryKinds.BENCHMARK });
  const benchmarkA = entry({ id: "benchmark-a", name: "Alpha Benchmark", kind: MarketRadarEntryKinds.BENCHMARK });

  const groups = groupMarketRadarEntriesForDisplay([lowPriority, benchmarkZ, highPriority, benchmarkA]);

  assert.deepEqual(groups.competitors.map((e) => e.id), ["high", "low"]);
  assert.deepEqual(groups.benchmarks.map((e) => e.id), ["benchmark-a", "benchmark-z"]);
});

test("groupMarketRadarEntriesForDisplay returns empty groups for an empty list", () => {
  const groups = groupMarketRadarEntriesForDisplay([]);

  assert.deepEqual(groups.competitors, []);
  assert.deepEqual(groups.benchmarks, []);
});

test("groupMarketRadarEntriesForDisplay does not mutate the input array", () => {
  const entries = [
    entry({ id: "a", name: "B", kind: MarketRadarEntryKinds.COMPETITOR, priority: 2 }),
    entry({ id: "b", name: "A", kind: MarketRadarEntryKinds.COMPETITOR, priority: 1 }),
  ];
  const original = [...entries];

  groupMarketRadarEntriesForDisplay(entries);

  assert.deepEqual(entries, original);
});

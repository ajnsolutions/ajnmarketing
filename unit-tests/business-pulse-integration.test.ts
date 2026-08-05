import { test } from "node:test";
import assert from "node:assert/strict";

import { confidenceExplanation, confidenceLabelText } from "../lib/competitor-observations/confidenceLabels.ts";
import {
  ObservationConfidenceFilters,
  buildWhatChangedItems,
  filterObservationsByConfidence,
} from "../lib/competitor-observations/display.ts";
import { CompetitorObservationConfidences, type CompetitorObservation } from "../lib/competitor-observations/types.ts";
import { MarketRadarEntryKinds, type MarketRadarEntry } from "../lib/market-radar/types.ts";

function observation(overrides: Partial<CompetitorObservation> = {}): CompetitorObservation {
  return {
    id: "obs-1",
    userId: "user-1",
    businessProfileId: "business-1",
    marketRadarEntryId: "entry-1",
    summary: "Acme Co launched a new promotion.",
    confidence: CompetitorObservationConfidences.MEDIUM,
    sourceLabel: "Acme Co (business profile)",
    occurredAt: "2026-08-01",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

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

test("buildWhatChangedItems joins an observation to its tracked competitor's name", () => {
  const items = buildWhatChangedItems([observation()], [entry()]);
  assert.equal(items.length, 1);
  assert.equal(items[0].competitorName, "Acme Co");
});

test("buildWhatChangedItems drops an observation whose entry can no longer be found, rather than fabricating a name", () => {
  const items = buildWhatChangedItems([observation({ marketRadarEntryId: "missing-entry" })], [entry()]);
  assert.deepEqual(items, []);
});

test("buildWhatChangedItems preserves input order", () => {
  const first = observation({ id: "obs-1", marketRadarEntryId: "entry-1" });
  const second = observation({ id: "obs-2", marketRadarEntryId: "entry-2" });
  const items = buildWhatChangedItems(
    [first, second],
    [entry({ id: "entry-1", name: "Acme Co" }), entry({ id: "entry-2", name: "Beta Co" })],
  );
  assert.deepEqual(
    items.map((i) => i.id),
    ["obs-1", "obs-2"],
  );
});

test("buildWhatChangedItems does not mutate its inputs", () => {
  const observations = [observation()];
  const entries = [entry()];
  const originalObservations = [...observations];
  const originalEntries = [...entries];

  buildWhatChangedItems(observations, entries);

  assert.deepEqual(observations, originalObservations);
  assert.deepEqual(entries, originalEntries);
});

test("filterObservationsByConfidence 'all' returns every item unchanged", () => {
  const items = [
    observation({ id: "low", confidence: CompetitorObservationConfidences.LOW }),
    observation({ id: "medium", confidence: CompetitorObservationConfidences.MEDIUM }),
    observation({ id: "high", confidence: CompetitorObservationConfidences.HIGH }),
  ];
  const result = filterObservationsByConfidence(items, ObservationConfidenceFilters.ALL);
  assert.deepEqual(
    result.map((i) => i.id),
    ["low", "medium", "high"],
  );
});

test("filterObservationsByConfidence 'medium_and_above' excludes low confidence", () => {
  const items = [
    observation({ id: "low", confidence: CompetitorObservationConfidences.LOW }),
    observation({ id: "medium", confidence: CompetitorObservationConfidences.MEDIUM }),
    observation({ id: "high", confidence: CompetitorObservationConfidences.HIGH }),
  ];
  const result = filterObservationsByConfidence(items, ObservationConfidenceFilters.MEDIUM_AND_ABOVE);
  assert.deepEqual(
    result.map((i) => i.id),
    ["medium", "high"],
  );
});

test("filterObservationsByConfidence 'high_only' keeps only high confidence", () => {
  const items = [
    observation({ id: "low", confidence: CompetitorObservationConfidences.LOW }),
    observation({ id: "medium", confidence: CompetitorObservationConfidences.MEDIUM }),
    observation({ id: "high", confidence: CompetitorObservationConfidences.HIGH }),
  ];
  const result = filterObservationsByConfidence(items, ObservationConfidenceFilters.HIGH_ONLY);
  assert.deepEqual(
    result.map((i) => i.id),
    ["high"],
  );
});

test("filterObservationsByConfidence returns an empty list when nothing clears the bar", () => {
  const items = [observation({ confidence: CompetitorObservationConfidences.LOW })];
  const result = filterObservationsByConfidence(items, ObservationConfidenceFilters.HIGH_ONLY);
  assert.deepEqual(result, []);
});

test("confidenceLabelText returns a distinct plain-language label for every confidence level, never the raw string", () => {
  const low = confidenceLabelText(CompetitorObservationConfidences.LOW);
  const medium = confidenceLabelText(CompetitorObservationConfidences.MEDIUM);
  const high = confidenceLabelText(CompetitorObservationConfidences.HIGH);

  assert.notEqual(low, "low");
  assert.notEqual(medium, "medium");
  assert.notEqual(high, "high");
  assert.notEqual(low, medium);
  assert.notEqual(medium, high);
  assert.notEqual(low, high);
});

test("confidenceExplanation returns a non-empty, distinct explanation for every confidence level", () => {
  const low = confidenceExplanation(CompetitorObservationConfidences.LOW);
  const medium = confidenceExplanation(CompetitorObservationConfidences.MEDIUM);
  const high = confidenceExplanation(CompetitorObservationConfidences.HIGH);

  assert.ok(low.length > 0);
  assert.ok(medium.length > 0);
  assert.ok(high.length > 0);
  assert.notEqual(low, medium);
  assert.notEqual(medium, high);
});

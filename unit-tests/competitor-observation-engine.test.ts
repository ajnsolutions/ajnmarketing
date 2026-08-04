import { test } from "node:test";
import assert from "node:assert/strict";

import { scoreCompetitorSignal } from "../lib/competitor-observations/scoring.ts";
import { CompetitorObservationConfidences } from "../lib/competitor-observations/types.ts";
import { MarketRadarEntryKinds, type MarketRadarEntry } from "../lib/market-radar/types.ts";
import type { MarketContextItemInput } from "../lib/market-context/types.ts";

function trackedCompetitor(overrides: Partial<MarketRadarEntry> = {}): MarketRadarEntry {
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

function competitorSignal(overrides: Partial<MarketContextItemInput> = {}): MarketContextItemInput {
  return {
    category: "competitor",
    title: "Competitive focus: Acme Co in Austin, TX",
    summary: "Profile-based competitor signal for Acme Co in Austin, TX.",
    sourceName: "Acme Co (business profile)",
    sourceUrl: "https://acmeco.example.com",
    confidenceScore: 68,
    contextDate: "2026-08-01",
    expiresAt: "2026-08-15T00:00:00.000Z",
    metadata: {
      provider: "profile.competitors",
      isFallback: false,
      isProfileBased: true,
      configured: true,
      competitorName: "Acme Co",
      competitorSource: "business_profile",
    },
    ...overrides,
  };
}

test("scoreCompetitorSignal never treats a fallback/mock signal as meaningful", () => {
  const fallback = competitorSignal({
    summary: "Add competitors in your business profile to unlock profile-based competitor signals.",
    confidenceScore: 35,
    metadata: {
      provider: "mock",
      isFallback: true,
      configured: false,
    },
  });

  const result = scoreCompetitorSignal(fallback, trackedCompetitor());

  assert.equal(result, null);
});

test("scoreCompetitorSignal is never scored for a competitor the owner has not tracked in Market Radar", () => {
  const signalAboutSomeoneElse = competitorSignal({
    metadata: {
      provider: "profile.competitors",
      isFallback: false,
      competitorName: "Totally Different Business",
    },
  });

  const result = scoreCompetitorSignal(signalAboutSomeoneElse, trackedCompetitor({ name: "Acme Co" }));

  assert.equal(result, null);
});

test("scoreCompetitorSignal never scores a benchmark entry (benchmarks are for inspiration, not observation)", () => {
  const benchmark = trackedCompetitor({ kind: MarketRadarEntryKinds.BENCHMARK, name: "Acme Co" });

  const result = scoreCompetitorSignal(competitorSignal(), benchmark);

  assert.equal(result, null);
});

test("scoreCompetitorSignal never scores a non-competitor-category signal", () => {
  const weatherShapedSignal = competitorSignal({ category: "weather" });

  const result = scoreCompetitorSignal(weatherShapedSignal, trackedCompetitor());

  assert.equal(result, null);
});

test("scoreCompetitorSignal maps a low confidence score (below the medium floor) to low confidence, still meaningful", () => {
  const lowConfidenceSignal = competitorSignal({ confidenceScore: 45 });

  const result = scoreCompetitorSignal(lowConfidenceSignal, trackedCompetitor());

  assert.ok(result);
  assert.equal(result.meaningful, true);
  assert.equal(result.confidence, CompetitorObservationConfidences.LOW);
});

test("scoreCompetitorSignal filters out a signal below the meaningful floor entirely", () => {
  const tooWeakSignal = competitorSignal({ confidenceScore: 20 });

  const result = scoreCompetitorSignal(tooWeakSignal, trackedCompetitor());

  assert.ok(result);
  assert.equal(result.meaningful, false);
});

test("scoreCompetitorSignal maps the real competitorProvider.ts profile-based confidence score (68) to medium", () => {
  const realisticSignal = competitorSignal({ confidenceScore: 68 });

  const result = scoreCompetitorSignal(realisticSignal, trackedCompetitor());

  assert.ok(result);
  assert.equal(result.meaningful, true);
  assert.equal(result.confidence, CompetitorObservationConfidences.MEDIUM);
});

test("scoreCompetitorSignal maps a high confidence score to high confidence for a genuinely tracked competitor", () => {
  const highConfidenceSignal = competitorSignal({ confidenceScore: 90 });

  const result = scoreCompetitorSignal(highConfidenceSignal, trackedCompetitor());

  assert.ok(result);
  assert.equal(result.meaningful, true);
  assert.equal(result.confidence, CompetitorObservationConfidences.HIGH);
});

test("scoreCompetitorSignal matches names case-insensitively and tolerates punctuation/suffix differences", () => {
  const signal = competitorSignal({
    metadata: {
      provider: "profile.competitors",
      isFallback: false,
      competitorName: "acme co.",
    },
  });

  const result = scoreCompetitorSignal(signal, trackedCompetitor({ name: "ACME CO" }));

  assert.ok(result);
  assert.equal(result.meaningful, true);
});

test("scoreCompetitorSignal returns the signal's own summary verbatim, never fabricated text", () => {
  const signal = competitorSignal({ summary: "Exact source summary text." });

  const result = scoreCompetitorSignal(signal, trackedCompetitor());

  assert.ok(result);
  assert.equal(result.summary, "Exact source summary text.");
});

test("scoreCompetitorSignal returns null when the signal carries no competitor name metadata at all", () => {
  const signal = competitorSignal({ metadata: { provider: "profile.competitors", isFallback: false } });

  const result = scoreCompetitorSignal(signal, trackedCompetitor());

  assert.equal(result, null);
});

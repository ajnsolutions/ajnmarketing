import test from "node:test";
import assert from "node:assert/strict";
import { buildCompetitorEvidence, STALE_OBSERVATION_MAX_AGE_DAYS } from "../lib/recommendation-presentation/competitorEvidence.ts";
import type { CompetitorObservation } from "../lib/competitor-observations/types.ts";
import type { MarketRadarEntry } from "../lib/market-radar/types.ts";

/**
 * Task 006 — Market Radar evidence for Marketing Director recommendations.
 * Covers: evidence-present, evidence-absent, stale, duplicate, relevance,
 * provenance, malformed, and tenant-isolation, per the task's own required
 * test coverage.
 */

const NOW = new Date("2026-08-05T12:00:00.000Z");
const BUSINESS_PROFILE_ID = "biz-1";

function observation(overrides: Partial<CompetitorObservation> = {}): CompetitorObservation {
  return {
    id: "obs-1",
    userId: "user-1",
    businessProfileId: BUSINESS_PROFILE_ID,
    marketRadarEntryId: "entry-1",
    summary: "Competitor X launched a spring promotion.",
    confidence: "medium",
    sourceLabel: "AI profile",
    occurredAt: "2026-08-01T00:00:00.000Z",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function entry(overrides: Partial<MarketRadarEntry> = {}): MarketRadarEntry {
  return {
    id: "entry-1",
    userId: "user-1",
    businessProfileId: BUSINESS_PROFILE_ID,
    kind: "competitor",
    name: "Competitor X",
    priority: null,
    notes: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// evidence-present / evidence-absent
// ---------------------------------------------------------------------------

test("evidence-present: a real, current, confident observation about a tracked competitor is surfaced", () => {
  const result = buildCompetitorEvidence([observation()], [entry()], BUSINESS_PROFILE_ID, NOW);
  assert.equal(result.length, 1);
  assert.equal(result[0].observation, "Competitor X launched a spring promotion.");
  assert.equal(result[0].competitorName, "Competitor X");
});

test("evidence-absent: no observations at all returns [], not an error or a fabricated entry", () => {
  const result = buildCompetitorEvidence([], [], BUSINESS_PROFILE_ID, NOW);
  assert.deepEqual(result, []);
});

// ---------------------------------------------------------------------------
// stale
// ---------------------------------------------------------------------------

test("stale: an observation older than STALE_OBSERVATION_MAX_AGE_DAYS is excluded", () => {
  const old = new Date(NOW.getTime() - (STALE_OBSERVATION_MAX_AGE_DAYS + 1) * 24 * 60 * 60 * 1000).toISOString();
  const result = buildCompetitorEvidence([observation({ occurredAt: old, createdAt: old })], [entry()], BUSINESS_PROFILE_ID, NOW);
  assert.deepEqual(result, []);
});

test("stale: an observation just inside the age window is still included", () => {
  const recentEnough = new Date(NOW.getTime() - (STALE_OBSERVATION_MAX_AGE_DAYS - 1) * 24 * 60 * 60 * 1000).toISOString();
  const result = buildCompetitorEvidence([observation({ occurredAt: recentEnough, createdAt: recentEnough })], [entry()], BUSINESS_PROFILE_ID, NOW);
  assert.equal(result.length, 1);
});

test("stale: falls back to createdAt when occurredAt is null (profile-declared signal has no event time)", () => {
  const old = new Date(NOW.getTime() - (STALE_OBSERVATION_MAX_AGE_DAYS + 1) * 24 * 60 * 60 * 1000).toISOString();
  const result = buildCompetitorEvidence([observation({ occurredAt: null, createdAt: old })], [entry()], BUSINESS_PROFILE_ID, NOW);
  assert.deepEqual(result, []);
});

// ---------------------------------------------------------------------------
// duplicate
// ---------------------------------------------------------------------------

test("duplicate: multiple observations about the same competitor collapse to one, keeping the most recent", () => {
  const older = observation({ id: "obs-old", summary: "Old news.", occurredAt: "2026-07-01T00:00:00.000Z", createdAt: "2026-07-01T00:00:00.000Z" });
  const newer = observation({ id: "obs-new", summary: "Fresh news.", occurredAt: "2026-08-01T00:00:00.000Z", createdAt: "2026-08-01T00:00:00.000Z" });
  const result = buildCompetitorEvidence([older, newer], [entry()], BUSINESS_PROFILE_ID, NOW);
  assert.equal(result.length, 1);
  assert.equal(result[0].observation, "Fresh news.");
});

test("duplicate: observations about genuinely different competitors are never collapsed", () => {
  const a = observation({ id: "obs-a", marketRadarEntryId: "entry-a", summary: "A did something." });
  const b = observation({ id: "obs-b", marketRadarEntryId: "entry-b", summary: "B did something." });
  const entryA = entry({ id: "entry-a", name: "Competitor A" });
  const entryB = entry({ id: "entry-b", name: "Competitor B" });
  const result = buildCompetitorEvidence([a, b], [entryA, entryB], BUSINESS_PROFILE_ID, NOW);
  assert.equal(result.length, 2);
});

// ---------------------------------------------------------------------------
// relevance
// ---------------------------------------------------------------------------

test("relevance: an observation whose tracked competitor no longer exists in Market Radar is dropped, not shown with a fabricated name", () => {
  const result = buildCompetitorEvidence([observation({ marketRadarEntryId: "removed-entry" })], [entry()], BUSINESS_PROFILE_ID, NOW);
  assert.deepEqual(result, []);
});

test("relevance: below-medium confidence is excluded (an 'early signal' is real but not confident enough to inform a recommendation)", () => {
  const result = buildCompetitorEvidence([observation({ confidence: "low" })], [entry()], BUSINESS_PROFILE_ID, NOW);
  assert.deepEqual(result, []);
});

test("relevance: high confidence is included alongside medium", () => {
  const result = buildCompetitorEvidence([observation({ confidence: "high" })], [entry()], BUSINESS_PROFILE_ID, NOW);
  assert.equal(result.length, 1);
});

// ---------------------------------------------------------------------------
// provenance
// ---------------------------------------------------------------------------

test("provenance: source label and a plain-language (never raw) confidence label are always included", () => {
  const result = buildCompetitorEvidence([observation({ sourceLabel: "Business profile", confidence: "high" })], [entry()], BUSINESS_PROFILE_ID, NOW);
  assert.equal(result[0].sourceLabel, "Business profile");
  assert.equal(result[0].confidenceLabel, "Strong evidence");
  assert.notEqual(result[0].confidenceLabel, "high");
  assert.ok(result[0].confidenceExplanation.length > 0);
});

// ---------------------------------------------------------------------------
// malformed
// ---------------------------------------------------------------------------

test("malformed: an observation with an empty summary is excluded rather than shown blank", () => {
  const result = buildCompetitorEvidence([observation({ summary: "   " })], [entry()], BUSINESS_PROFILE_ID, NOW);
  assert.deepEqual(result, []);
});

test("malformed: an observation with an empty source label is excluded rather than shown with no provenance", () => {
  const result = buildCompetitorEvidence([observation({ sourceLabel: "" })], [entry()], BUSINESS_PROFILE_ID, NOW);
  assert.deepEqual(result, []);
});

// ---------------------------------------------------------------------------
// tenant-isolation
// ---------------------------------------------------------------------------

test("tenant-isolation: an observation for a different business is never surfaced, even if present in the input list", () => {
  const otherBusiness = observation({ businessProfileId: "some-other-business" });
  const result = buildCompetitorEvidence([otherBusiness], [entry({ businessProfileId: "some-other-business" })], BUSINESS_PROFILE_ID, NOW);
  assert.deepEqual(result, []);
});

// ---------------------------------------------------------------------------
// cap
// ---------------------------------------------------------------------------

test("cap: more qualifying competitors than the display cap still returns only the most recent handful, not every tracked competitor", () => {
  const observations: CompetitorObservation[] = [];
  const entries: MarketRadarEntry[] = [];
  for (let i = 0; i < 5; i++) {
    observations.push(observation({ id: `obs-${i}`, marketRadarEntryId: `entry-${i}`, occurredAt: `2026-0${(i % 8) + 1}-01T00:00:00.000Z`, createdAt: `2026-0${(i % 8) + 1}-01T00:00:00.000Z` }));
    entries.push(entry({ id: `entry-${i}`, name: `Competitor ${i}` }));
  }
  const result = buildCompetitorEvidence(observations, entries, BUSINESS_PROFILE_ID, NOW);
  assert.ok(result.length < 5, "must not simply pass through every qualifying observation unbounded");
  assert.ok(result.length > 0);
});

/**
 * The pure "is this a meaningful observation" judgment for the Competitor
 * Observation Engine. Takes one competitor-category MarketContextItemInput
 * (from lib/market-context/providers/competitorProvider.ts) and the tracked
 * MarketRadarEntry it might be about, and decides whether it clears the bar
 * to become a persisted CompetitorObservation, and at what confidence.
 *
 * No I/O, no randomness, no dates read from the system clock — safe to unit
 * test directly and safe to call repeatedly against the same inputs.
 */

import { MarketRadarEntryKinds, type MarketRadarEntry } from "@/lib/market-radar/types";
import type { MarketContextItemInput } from "@/lib/market-context/types";
import {
  CompetitorObservationConfidences,
  type CompetitorObservationConfidence,
} from "@/lib/competitor-observations/types";

export type CompetitorSignalScoreResult = {
  /** Whether this signal clears the bar to be persisted as a real observation. */
  meaningful: boolean;
  confidence: CompetitorObservationConfidence;
  /** Always the signal's own summary text, verbatim — never fabricated or embellished. */
  summary: string;
};

/**
 * Confidence-score thresholds (0-100, MarketContextItemInput.confidenceScore).
 * These are real, load-bearing decisions, not arbitrary defaults:
 *
 * - Below MEANINGFUL_FLOOR: too weak/generic to persist at all — the signal
 *   is scored but `meaningful` is false, and no observation is recorded.
 *   competitorProvider.ts's fallback/mock signal scores 35, comfortably
 *   below this floor, so it is filtered out on confidence score alone even
 *   before the explicit isFallback guard below runs.
 * - [MEANINGFUL_FLOOR, MEDIUM_FLOOR): meaningful, but only "low" confidence —
 *   worth surfacing, not worth treating as strong evidence.
 * - [MEDIUM_FLOOR, HIGH_FLOOR): "medium" confidence. This is where
 *   competitorProvider.ts's real, non-fallback profile-declared signal
 *   currently lands (confidenceScore 68) — profile-declared information is
 *   real signal, but it is self-reported by the business owner, not
 *   independently confirmed, so it does not earn "high" on its own.
 * - [HIGH_FLOOR, 100]: "high" confidence — reserved for signal this repo
 *   does not yet produce (e.g. independently corroborated data), so this
 *   band is exercised by unit tests with a synthetic high-confidence input
 *   rather than by the current live provider.
 */
const MEANINGFUL_FLOOR = 40;
const MEDIUM_FLOOR = 55;
const HIGH_FLOOR = 75;

function confidenceForScore(confidenceScore: number): CompetitorObservationConfidence {
  if (confidenceScore >= HIGH_FLOOR) return CompetitorObservationConfidences.HIGH;
  if (confidenceScore >= MEDIUM_FLOOR) return CompetitorObservationConfidences.MEDIUM;
  return CompetitorObservationConfidences.LOW;
}

/** Lowercase, strip punctuation, collapse whitespace — a light normalization
 * so "Acme Co." (owner-typed) and "Acme" (parsed from a profile URL/text)
 * can be recognized as the same tracked competitor without requiring exact
 * string equality, which real free-text names almost never satisfy. */
function normalizeCompetitorName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Whether a signal's declared competitor name and a tracked entry's owner-
 * typed name plausibly refer to the same business. Deliberately permissive
 * (equality or substring containment either direction) rather than exact —
 * see normalizeCompetitorName's comment for why exact equality is the wrong
 * bar here. */
function competitorNameMatches(signalCompetitorName: string, trackedEntryName: string): boolean {
  const normalizedSignal = normalizeCompetitorName(signalCompetitorName);
  const normalizedTracked = normalizeCompetitorName(trackedEntryName);
  if (!normalizedSignal || !normalizedTracked) return false;
  return (
    normalizedSignal === normalizedTracked ||
    normalizedSignal.includes(normalizedTracked) ||
    normalizedTracked.includes(normalizedSignal)
  );
}

export function scoreCompetitorSignal(
  signal: MarketContextItemInput,
  trackedEntry: MarketRadarEntry,
): CompetitorSignalScoreResult | null {
  // Benchmarks are for inspiration, not competitive observation — never scored.
  if (trackedEntry.kind !== MarketRadarEntryKinds.COMPETITOR) return null;

  // Only competitor-category signal is in scope for this engine.
  if (signal.category !== "competitor") return null;

  // A fallback/mock signal is explicitly synthetic placeholder copy, not a
  // real observation about a real tracked competitor — never meaningful.
  // (In practice this also always fails the name-match check below, since
  // the fallback signal carries no competitorName metadata at all — this
  // guard makes that guarantee explicit rather than incidental.)
  if (signal.metadata?.isFallback === true) return null;

  const signalCompetitorName = signal.metadata?.competitorName;
  if (typeof signalCompetitorName !== "string" || !signalCompetitorName.trim()) return null;

  // Not scoped to anything the owner asked to watch — never scored.
  if (!competitorNameMatches(signalCompetitorName, trackedEntry.name)) return null;

  const confidenceScore = signal.confidenceScore ?? 0;
  const confidence = confidenceForScore(confidenceScore);
  const meaningful = confidenceScore >= MEANINGFUL_FLOOR;

  return {
    meaningful,
    confidence,
    summary: signal.summary,
  };
}

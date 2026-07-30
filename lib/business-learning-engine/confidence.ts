/**
 * Decay handling (Part 2) and adaptive confidence (Part 4).
 *
 * Decay: a pattern nobody has reinforced in a while is presented less
 * confidently, without ever deleting or mutating its stored history — the
 * decay state is recomputed on read from `lastReinforced`.
 *
 * Adaptive confidence: historical pattern success may nudge a recommendation's
 * confidence upward, bounded so it can never dominate current evidence, and
 * never applied when the historical pattern isn't genuinely positive. This
 * keeps current evidence the strongest signal (Part 4) and never fabricates
 * a confidence boost from thin or negative history.
 */

import { ConfidenceLevels, DecayStates, type BusinessPattern, type ConfidenceLevel, type DecayState } from "@/lib/business-learning-engine/types";

const FRESH_WINDOW_DAYS = 30;
const STALE_WINDOW_DAYS = 90;

function daysSince(isoDate: string, now: Date): number {
  const then = new Date(isoDate).getTime();
  return Math.max(0, (now.getTime() - then) / (1000 * 60 * 60 * 24));
}

/** Recomputed on every read — never persisted as the source of truth for
 * "is this pattern still relevant," only cached alongside the row for
 * queryability. */
export function computeDecayState(lastReinforced: string, now: Date = new Date()): DecayState {
  const days = daysSince(lastReinforced, now);
  if (days <= FRESH_WINDOW_DAYS) return DecayStates.FRESH;
  if (days <= STALE_WINDOW_DAYS) return DecayStates.DECAYING;
  return DecayStates.STALE;
}

/** A stale, unreinforced pattern is never presented at full confidence; a
 * decaying one loses only its top tier. A fresh pattern is unaffected. */
export function applyDecay(confidenceLevel: ConfidenceLevel, decayState: DecayState): ConfidenceLevel {
  if (decayState === DecayStates.STALE) return ConfidenceLevels.LOW;
  if (decayState === DecayStates.DECAYING && confidenceLevel === ConfidenceLevels.HIGH) {
    return ConfidenceLevels.MEDIUM;
  }
  return confidenceLevel;
}

export type ConfidenceBlendResult = {
  blended: ConfidenceLevel;
  /** True only when the blend actually moved the confidence — lets callers
   * decide whether to mention historical influence at all. */
  historicalInfluenceApplied: boolean;
};

const CONFIDENCE_TIER: Record<ConfidenceLevel, number> = { low: 1, medium: 2, high: 3 };
const TIER_CONFIDENCE: Record<number, ConfidenceLevel> = { 1: "low", 2: "medium", 3: "high" };

/** Minimum reinforcement before a pattern is trusted enough to influence
 * confidence at all — a pattern observed only once is real evidence for
 * itself, but not yet a "pattern" worth nudging an unrelated recommendation. */
const MIN_REINFORCEMENT_FOR_INFLUENCE = 2;

/**
 * Blends a recommendation's current confidence with a relevant historical
 * pattern's effective (decay-adjusted) confidence. Current evidence is
 * always the floor — this function only ever nudges confidence up by
 * exactly one tier, and only when the pattern is genuinely positive, has
 * real reinforcement behind it, and is itself at least medium confidence.
 * A negative or thin pattern is never used to silently downgrade the
 * recommendation Marketing Director already decided on; it's surfaced as
 * separate, explicit historical context instead (see observations.ts).
 */
export function blendConfidence(
  current: ConfidenceLevel,
  pattern: BusinessPattern | null,
): ConfidenceBlendResult {
  const eligible =
    pattern &&
    pattern.direction === "positive" &&
    pattern.reinforcementCount >= MIN_REINFORCEMENT_FOR_INFLUENCE &&
    pattern.effectiveConfidence !== ConfidenceLevels.LOW &&
    CONFIDENCE_TIER[current] < 3;

  if (!eligible) {
    return { blended: current, historicalInfluenceApplied: false };
  }

  const blended = TIER_CONFIDENCE[CONFIDENCE_TIER[current] + 1]!;
  return { blended, historicalInfluenceApplied: true };
}

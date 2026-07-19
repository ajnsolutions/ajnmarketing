import "server-only";

import {
  EARLY_SIGNAL_SAMPLE_CEILING,
  MAX_CONTRADICTION_RATE_FOR_DEVELOPING,
  MIN_CONSISTENCY_FOR_DEVELOPING,
  MIN_EFFECT_SIZE_FOR_DIRECTION,
  STRONG_PATTERN_MAX_RECENCY_DAYS,
  STRONG_PATTERN_MIN_CONSISTENCY,
  STRONG_PATTERN_MIN_SAMPLE,
} from "@/lib/marketing-memory/learningConfig";
import {
  EvidenceClassifications,
  LearningConfidenceLevels,
  LearningDirections,
  type EvidenceClassification,
  type LearningConfidenceLevel,
  type LearningDirection,
  type LearningEvidenceItem,
} from "@/lib/marketing-memory/learningTypes";

/**
 * Signed, normalized relative effect: how far the cohort's value sits from the
 * baseline, as a fraction of the baseline. Bounded to +/-3.0 (300%) purely to keep a
 * single wild data point from producing an unreadable stored value — the confidence
 * model, not this clamp, is what actually decides whether a large effect is trustworthy.
 */
export function computeEffectSize(cohortValue: number, baselineValue: number): number {
  if (baselineValue === 0) return 0;
  const raw = (cohortValue - baselineValue) / Math.abs(baselineValue);
  return Math.max(-3, Math.min(3, raw));
}

/** Below MIN_EFFECT_SIZE_FOR_DIRECTION, an effect is noise, not a directional pattern. */
export function classifyDirection(effectSize: number): LearningDirection {
  if (Math.abs(effectSize) < MIN_EFFECT_SIZE_FOR_DIRECTION) return LearningDirections.NEUTRAL;
  return effectSize > 0 ? LearningDirections.POSITIVE : LearningDirections.NEGATIVE;
}

/**
 * Classifies one evidence item against the cohort's net direction. An item whose own
 * relative effect is too small to distinguish from noise is 'neutral' regardless of the
 * net direction; otherwise it 'supports' the net direction if it points the same way,
 * or 'contradicts' it if it points the opposite way. This is the single function both
 * learning families use to build their supporting/contradicting/neutral counts — see
 * lib/marketing-memory/cohorts.ts for how each family resolves an item's own value and
 * the baseline it's compared against.
 */
export function classifyEvidenceItem(
  itemValue: number,
  baselineValue: number,
  netDirection: LearningDirection
): EvidenceClassification {
  const itemEffect = computeEffectSize(itemValue, baselineValue);
  const itemDirection = classifyDirection(itemEffect);

  if (itemDirection === LearningDirections.NEUTRAL) return EvidenceClassifications.NEUTRAL;
  if (netDirection === LearningDirections.NEUTRAL || netDirection === LearningDirections.INCONCLUSIVE) {
    return EvidenceClassifications.NEUTRAL;
  }
  return itemDirection === netDirection ? EvidenceClassifications.SUPPORTING : EvidenceClassifications.CONTRADICTING;
}

/** Consistency excludes neutral items from the denominator — same convention as
 * lib/recommendation-learning/signals.ts's successRateByBucket ("a publish_failed
 * recommendation must never drag down... success rate"): a pattern's consistency is
 * about supporting vs. contradicting evidence, not diluted by inconclusive items. */
export function computeConsistency(supportingCount: number, contradictingCount: number): number {
  const total = supportingCount + contradictingCount;
  if (total === 0) return 0;
  return supportingCount / total;
}

export function computeContradictionRate(supportingCount: number, contradictingCount: number): number {
  if (supportingCount === 0) return contradictingCount > 0 ? 1 : 0;
  return contradictingCount / supportingCount;
}

export function daysBetween(earlier: string | Date, later: string | Date): number {
  const earlierMs = new Date(earlier).getTime();
  const laterMs = new Date(later).getTime();
  return Math.max(0, Math.round((laterMs - earlierMs) / (24 * 60 * 60 * 1000)));
}

export type ClassifyConfidenceInput = {
  sampleSize: number;
  consistency: number;
  contradictionRate: number;
  recencyDays: number;
  seasonalRecurrenceCount: number;
};

/**
 * The full, documented Phase 2 confidence rule set — finalizes the illustrative formula
 * published in docs/MARKETING_MEMORY_ARCHITECTURE.md §10. Deterministic, rule-based,
 * never an ML model or LLM call. See learningConfig.ts for every threshold used here.
 */
export function classifyConfidence(input: ClassifyConfidenceInput): LearningConfidenceLevel {
  if (input.sampleSize < EARLY_SIGNAL_SAMPLE_CEILING) {
    return LearningConfidenceLevels.EARLY_SIGNAL;
  }

  if (
    input.consistency < MIN_CONSISTENCY_FOR_DEVELOPING ||
    input.contradictionRate > MAX_CONTRADICTION_RATE_FOR_DEVELOPING
  ) {
    return LearningConfidenceLevels.EARLY_SIGNAL;
  }

  const hasRecencyOrSeasonalSupport =
    input.recencyDays <= STRONG_PATTERN_MAX_RECENCY_DAYS || input.seasonalRecurrenceCount >= 1;

  if (
    input.sampleSize >= STRONG_PATTERN_MIN_SAMPLE &&
    input.consistency >= STRONG_PATTERN_MIN_CONSISTENCY &&
    hasRecencyOrSeasonalSupport
  ) {
    return LearningConfidenceLevels.STRONG_PATTERN;
  }

  return LearningConfidenceLevels.DEVELOPING_PATTERN;
}

/** Most recent evidence item's occurredAt, in days-ago form — the "recencyDays" input to
 * classifyConfidence. */
export function mostRecentEvidenceRecencyDays(items: LearningEvidenceItem[], asOf: Date = new Date()): number {
  if (items.length === 0) return Number.POSITIVE_INFINITY;
  const mostRecent = items.reduce((latest, item) => {
    const itemMs = new Date(item.occurredAt).getTime();
    return itemMs > latest ? itemMs : latest;
  }, 0);
  return daysBetween(new Date(mostRecent), asOf);
}

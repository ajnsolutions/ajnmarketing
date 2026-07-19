import "server-only";

import { MIN_SAMPLE_SIZE_TO_CREATE, RECENT_WEAKENING_WINDOW_DAYS } from "@/lib/marketing-memory/learningConfig";
import {
  classifyDirection,
  classifyEvidenceItem,
  computeConsistency,
  computeContradictionRate,
  computeEffectSize,
  mostRecentEvidenceRecencyDays,
} from "@/lib/marketing-memory/learningMath";
import { seasonalRecurrenceCount } from "@/lib/marketing-memory/seasonality";
import {
  EvidenceClassifications,
  LearningDirections,
  TimeDimensions,
  type LearningDirection,
  type TimeDimension,
} from "@/lib/marketing-memory/learningTypes";

/** A single evidence data point, already resolved to one numeric value and one grouping
 * key by the caller (learningPersistence.ts) — the shape both learning families
 * normalize their raw joined rows into before any cohort math runs. */
export type CohortInputItem = {
  observationId: string;
  occurredAt: string;
  value: number;
  groupKey: string;
};

export type CohortResult = {
  groupKey: string;
  sampleSize: number;
  cohortValue: number;
  baselineValue: number;
  effectSize: number;
  direction: LearningDirection;
  supportingIds: string[];
  contradictingIds: string[];
  neutralIds: string[];
  consistency: number;
  contradictionRate: number;
  recencyDays: number;
  firstObservedAt: string;
  lastObservedAt: string;
  /** Timestamps of only this cohort's own items — used by callers that need
   * per-time-dimension seasonal recurrence, computed by the caller since it requires
   * knowing which time_dimension produced this cohort. */
  itemTimestamps: string[];
  /** Contradiction rate computed only from items within RECENT_WEAKENING_WINDOW_DAYS of
   * asOf, using the same net direction/baseline as the full cohort — the basis for
   * detecting "weakening" within a single evaluation pass, without needing to compare
   * against a previously stored row. */
  recentContradictionRate: number;
  recentSampleSize: number;
};

/**
 * Groups items by groupKey, computes each group's average value, compares it against
 * the overall (all-items) average as the baseline, and classifies every item within a
 * group as supporting/contradicting/neutral relative to that group's own net direction.
 * Pure — no database access, no side effects. Groups below MIN_SAMPLE_SIZE_TO_CREATE are
 * dropped entirely (never produce a Learning), matching the architecture doc's minimum
 * evidence floor. This single function is shared by both learning families — the only
 * per-family logic lives in how a caller maps raw rows into { value, groupKey }.
 */
export function buildCohorts(items: CohortInputItem[], asOf: Date = new Date()): CohortResult[] {
  if (items.length === 0) return [];

  const overallAverage = items.reduce((sum, item) => sum + item.value, 0) / items.length;

  const byGroup = new Map<string, CohortInputItem[]>();
  for (const item of items) {
    const bucket = byGroup.get(item.groupKey) ?? [];
    bucket.push(item);
    byGroup.set(item.groupKey, bucket);
  }

  const results: CohortResult[] = [];

  for (const [groupKey, groupItems] of byGroup) {
    if (groupItems.length < MIN_SAMPLE_SIZE_TO_CREATE) continue;

    const cohortValue = groupItems.reduce((sum, item) => sum + item.value, 0) / groupItems.length;
    const effectSize = computeEffectSize(cohortValue, overallAverage);
    const direction = classifyDirection(effectSize);

    const supportingIds: string[] = [];
    const contradictingIds: string[] = [];
    const neutralIds: string[] = [];

    const recentCutoffMs = asOf.getTime() - RECENT_WEAKENING_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    let recentSupporting = 0;
    let recentContradicting = 0;

    for (const item of groupItems) {
      const classification = classifyEvidenceItem(item.value, overallAverage, direction);
      if (classification === EvidenceClassifications.SUPPORTING) supportingIds.push(item.observationId);
      else if (classification === EvidenceClassifications.CONTRADICTING) contradictingIds.push(item.observationId);
      else neutralIds.push(item.observationId);

      if (new Date(item.occurredAt).getTime() >= recentCutoffMs) {
        if (classification === EvidenceClassifications.SUPPORTING) recentSupporting += 1;
        else if (classification === EvidenceClassifications.CONTRADICTING) recentContradicting += 1;
      }
    }

    const timestamps = groupItems.map((item) => item.occurredAt).sort();

    results.push({
      groupKey,
      sampleSize: groupItems.length,
      cohortValue,
      baselineValue: overallAverage,
      effectSize,
      direction,
      supportingIds,
      contradictingIds,
      neutralIds,
      consistency: computeConsistency(supportingIds.length, contradictingIds.length),
      contradictionRate: computeContradictionRate(supportingIds.length, contradictingIds.length),
      recencyDays: mostRecentEvidenceRecencyDays(
        groupItems.map((item) => ({ observationId: item.observationId, occurredAt: item.occurredAt, value: item.value })),
        asOf
      ),
      firstObservedAt: timestamps[0],
      lastObservedAt: timestamps[timestamps.length - 1],
      recentContradictionRate: computeContradictionRate(recentSupporting, recentContradicting),
      recentSampleSize: recentSupporting + recentContradicting,
      itemTimestamps: timestamps,
    });
  }

  return results;
}

/** Convenience wrapper: seasonal recurrence only applies to month/season time
 * dimensions — day_of_week and the (time-dimension-less) action-outcome family always
 * return 0, per lib/marketing-memory/seasonality.ts. */
export function cohortSeasonalRecurrenceCount(
  cohort: CohortResult,
  timeDimension: TimeDimension | null
): number {
  if (timeDimension !== TimeDimensions.MONTH && timeDimension !== TimeDimensions.SEASON) return 0;
  return seasonalRecurrenceCount(
    cohort.itemTimestamps.map((occurredAt, index) => ({
      observationId: `${cohort.groupKey}-${index}`,
      occurredAt,
      value: 0,
    })),
    timeDimension
  );
}

/** True net direction requires at least a minimal effect AND some supporting evidence —
 * a cohort with zero supporting/contradicting items (everything neutral) is
 * inconclusive, not silently defaulted to whatever classifyDirection happened to
 * compute from the averages alone. */
export function resolveCohortDirection(cohort: CohortResult): LearningDirection {
  if (cohort.direction === LearningDirections.NEUTRAL) return LearningDirections.NEUTRAL;
  if (cohort.supportingIds.length === 0 && cohort.contradictingIds.length === 0) {
    return LearningDirections.INCONCLUSIVE;
  }
  return cohort.direction;
}

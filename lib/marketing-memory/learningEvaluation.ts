import "server-only";

import {
  EVALUATION_WINDOW_DAYS,
  PERFORMANCE_ESTIMATION_CONFIDENCE_CEILING,
  RECENT_CONTRADICTION_RATE_FOR_WEAKENING,
  STRONG_PATTERN_MIN_SAMPLE,
  ConfounderCodes,
  type ConfounderCode,
} from "@/lib/marketing-memory/learningConfig";
import { buildCohorts, cohortSeasonalRecurrenceCount, resolveCohortDirection, type CohortInputItem, type CohortResult } from "@/lib/marketing-memory/cohorts";
import { classifyConfidence } from "@/lib/marketing-memory/learningMath";
import { recurrencePatternForTimeDimension } from "@/lib/marketing-memory/seasonality";
import { buildCustomerSafeSummary, buildInternalRationale } from "@/lib/marketing-memory/rationale";
import {
  LearningConfidenceLevels,
  LearningDirections,
  LearningFamilies,
  LearningMetricKeys,
  LearningStatuses,
  TimeDimensions,
  type LearningConfidenceLevel,
  type LearningEvaluationResult,
  type LearningStatus,
  type TimeDimension,
} from "@/lib/marketing-memory/learningTypes";

/** One performance_measured observation, already joined with its context snapshot's
 * day-of-week/month/season — the exact shape lib/marketing-memory/learningPersistence.ts
 * fetches from the database. Pure evaluation never touches Supabase directly. */
export type PerformanceEvidenceRow = {
  observationId: string;
  occurredAt: string;
  performanceScore: number;
  dayOfWeek: string | null;
  month: number | null;
  season: string | null;
};

/** One recommendation_approved/recommendation_rejected observation, already joined with
 * its recommendation's recommended_action_type. */
export type ActionOutcomeEvidenceRow = {
  observationId: string;
  occurredAt: string;
  approved: boolean;
  actionType: string;
};

function buildLearningKey(
  businessProfileId: string,
  learningFamily: string,
  timeDimension: TimeDimension | null,
  subjectKey: string,
  metricKey: string
): string {
  return `${businessProfileId}:${learningFamily}:${timeDimension ?? "none"}:${subjectKey}:${metricKey}`;
}

function detectConfounders(input: {
  cohort: CohortResult;
  isPerformanceFamily: boolean;
  overallSampleSize: number;
}): ConfounderCode[] {
  const codes: ConfounderCode[] = [];

  if (input.cohort.sampleSize < STRONG_PATTERN_MIN_SAMPLE) {
    codes.push(ConfounderCodes.SMALL_SAMPLE);
  }
  if (input.isPerformanceFamily) {
    codes.push(ConfounderCodes.ESTIMATED_PERFORMANCE_METRIC);
  }
  if (input.cohort.consistency < 0.5 && input.cohort.supportingIds.length + input.cohort.contradictingIds.length >= 3) {
    codes.push(ConfounderCodes.MIXED_EVIDENCE);
  }
  if (input.cohort.recencyDays > EVALUATION_WINDOW_DAYS) {
    codes.push(ConfounderCodes.INSUFFICIENT_RECENCY);
  }
  if (input.overallSampleSize < STRONG_PATTERN_MIN_SAMPLE * 2) {
    codes.push(ConfounderCodes.LOW_BASELINE_QUALITY);
  }

  return codes;
}

function resolveStatus(direction: string, confidenceLevel: LearningConfidenceLevel, isWeakening: boolean): LearningStatus {
  if (direction === LearningDirections.NEUTRAL || direction === LearningDirections.INCONCLUSIVE) {
    return LearningStatuses.INCONCLUSIVE;
  }
  if (isWeakening) return LearningStatuses.WEAKENING;
  if (confidenceLevel === LearningConfidenceLevels.EARLY_SIGNAL) return LearningStatuses.EMERGING;
  return LearningStatuses.ACTIVE;
}

function evaluateCohort(input: {
  businessProfileId: string;
  learningFamily: typeof LearningFamilies[keyof typeof LearningFamilies];
  timeDimension: TimeDimension | null;
  metricKey: typeof LearningMetricKeys[keyof typeof LearningMetricKeys];
  comparisonBaseline: string;
  cohort: CohortResult;
  overallSampleSize: number;
  asOf: Date;
}): LearningEvaluationResult {
  const { cohort } = input;
  const direction = resolveCohortDirection(cohort);
  const seasonalRecurrence = cohortSeasonalRecurrenceCount(cohort, input.timeDimension);
  const isPerformanceFamily = input.learningFamily === LearningFamilies.TIMING_PERFORMANCE;

  let confidenceLevel = classifyConfidence({
    sampleSize: cohort.sampleSize,
    consistency: cohort.consistency,
    contradictionRate: cohort.contradictionRate,
    recencyDays: cohort.recencyDays,
    seasonalRecurrenceCount: seasonalRecurrence,
  });

  // Structural confidence ceiling: performanceScore is an aggregate-allocation estimate
  // today (see learningConfig.ts), never a true per-post measurement, so this family can
  // never honestly reach "strong_pattern" until the analytics engine changes.
  if (
    isPerformanceFamily &&
    confidenceLevel === LearningConfidenceLevels.STRONG_PATTERN
  ) {
    confidenceLevel = PERFORMANCE_ESTIMATION_CONFIDENCE_CEILING;
  }

  const isWeakening =
    cohort.recentSampleSize >= 2 && cohort.recentContradictionRate >= RECENT_CONTRADICTION_RATE_FOR_WEAKENING;

  // A weakening pattern is never reported with unearned confidence — recent
  // contradiction pulls it back to, at most, developing_pattern.
  if (isWeakening && confidenceLevel === LearningConfidenceLevels.STRONG_PATTERN) {
    confidenceLevel = LearningConfidenceLevels.DEVELOPING_PATTERN;
  }

  const status = resolveStatus(direction, confidenceLevel, isWeakening);
  const confounderCodes = detectConfounders({ cohort, isPerformanceFamily, overallSampleSize: input.overallSampleSize });

  const confidenceComponents = {
    sampleSize: cohort.sampleSize,
    supportingCount: cohort.supportingIds.length,
    contradictingCount: cohort.contradictingIds.length,
    neutralCount: cohort.neutralIds.length,
    excludedCount: 0,
    consistency: cohort.consistency,
    contradictionRate: cohort.contradictionRate,
    effectSize: cohort.effectSize,
    recencyDays: cohort.recencyDays,
    seasonalRecurrenceCount: seasonalRecurrence,
    confounderCodes,
  };

  const summary = buildCustomerSafeSummary({
    learningFamily: input.learningFamily,
    timeDimension: input.timeDimension,
    subjectKey: cohort.groupKey,
    direction,
    confidenceLevel,
  });

  const internalRationale = buildInternalRationale({
    learningFamily: input.learningFamily,
    subjectKey: cohort.groupKey,
    confidenceComponents,
    comparisonBaseline: input.comparisonBaseline,
  });

  return {
    learningFamily: input.learningFamily,
    timeDimension: input.timeDimension,
    subjectKey: cohort.groupKey,
    metricKey: input.metricKey,
    direction,
    status,
    confidenceLevel,
    confidenceComponents,
    sampleSize: cohort.sampleSize,
    supportingCount: cohort.supportingIds.length,
    contradictingCount: cohort.contradictingIds.length,
    neutralCount: cohort.neutralIds.length,
    excludedCount: 0,
    effectSize: cohort.effectSize,
    comparisonBaseline: input.comparisonBaseline,
    baselineValue: cohort.baselineValue,
    cohortValue: cohort.cohortValue,
    firstObservedAt: cohort.firstObservedAt,
    lastObservedAt: cohort.lastObservedAt,
    evaluationWindowDays: EVALUATION_WINDOW_DAYS,
    recurrencePattern: recurrencePatternForTimeDimension(input.timeDimension),
    seasonalRecurrenceCount: seasonalRecurrence,
    confounderCodes,
    summary,
    internalRationale,
    learningKey: buildLearningKey(
      input.businessProfileId,
      input.learningFamily,
      input.timeDimension,
      cohort.groupKey,
      input.metricKey
    ),
    evidenceByClassification: {
      supporting: cohort.supportingIds,
      contradicting: cohort.contradictingIds,
      neutral: cohort.neutralIds,
    },
  };
}

/**
 * Evaluates the timing_performance family across all three time dimensions
 * (day_of_week, month, season) independently — a business's Thursday pattern and its
 * December pattern are separate cohorts/learnings, not conflated. Pure: no database
 * access.
 */
export function evaluateTimingPerformance(
  businessProfileId: string,
  rows: PerformanceEvidenceRow[],
  asOf: Date = new Date()
): LearningEvaluationResult[] {
  const results: LearningEvaluationResult[] = [];
  const overallSampleSize = rows.length;

  const dimensions: { dimension: TimeDimension; extract: (row: PerformanceEvidenceRow) => string | null }[] = [
    { dimension: TimeDimensions.DAY_OF_WEEK, extract: (row) => row.dayOfWeek },
    { dimension: TimeDimensions.MONTH, extract: (row) => (row.month != null ? String(row.month) : null) },
    { dimension: TimeDimensions.SEASON, extract: (row) => row.season },
  ];

  for (const { dimension, extract } of dimensions) {
    const items: CohortInputItem[] = rows
      .filter((row) => extract(row) !== null)
      .map((row) => ({
        observationId: row.observationId,
        occurredAt: row.occurredAt,
        value: row.performanceScore,
        groupKey: extract(row) as string,
      }));

    const cohorts = buildCohorts(items, asOf);

    for (const cohort of cohorts) {
      results.push(
        evaluateCohort({
          businessProfileId,
          learningFamily: LearningFamilies.TIMING_PERFORMANCE,
          timeDimension: dimension,
          metricKey: LearningMetricKeys.PERFORMANCE_SCORE,
          comparisonBaseline: "trailing rolling average performance score for this business",
          cohort,
          overallSampleSize,
          asOf,
        })
      );
    }
  }

  return results;
}

/**
 * Evaluates the recommendation_action_outcome family — one cohort per
 * recommended_action_type, compared against this business's overall approval rate
 * across every action type. Pure: no database access.
 */
export function evaluateRecommendationActionOutcome(
  businessProfileId: string,
  rows: ActionOutcomeEvidenceRow[],
  asOf: Date = new Date()
): LearningEvaluationResult[] {
  const items: CohortInputItem[] = rows.map((row) => ({
    observationId: row.observationId,
    occurredAt: row.occurredAt,
    value: row.approved ? 1 : 0,
    groupKey: row.actionType,
  }));

  const cohorts = buildCohorts(items, asOf);
  const overallSampleSize = rows.length;

  return cohorts.map((cohort) =>
    evaluateCohort({
      businessProfileId,
      learningFamily: LearningFamilies.RECOMMENDATION_ACTION_OUTCOME,
      timeDimension: null,
      metricKey: LearningMetricKeys.APPROVAL_RATE,
      comparisonBaseline: "overall approval rate across all recommendation types for this business",
      cohort,
      overallSampleSize,
      asOf,
    })
  );
}

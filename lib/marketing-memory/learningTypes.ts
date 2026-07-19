import "server-only";

import type { ConfounderCode } from "@/lib/marketing-memory/learningConfig";

/**
 * Marketing Memory Phase 2 — shared learning types and closed vocabularies. Every enum
 * here has a matching `check` constraint in
 * supabase/migrations/025_marketing_memory_learnings.sql — this file and that migration
 * must be changed together, exactly mirroring the Phase 1 types.ts/024 relationship.
 */

/**
 * Intentionally limited to what Phase 1 observations can honestly support. Weather and
 * event-attention families are NOT implemented — see docs/MARKETING_MEMORY_LEARNINGS.md
 * for why (Phase 1 never classifies context impact_direction beyond 'unknown').
 */
export const LearningFamilies = {
  TIMING_PERFORMANCE: "timing_performance",
  RECOMMENDATION_ACTION_OUTCOME: "recommendation_action_outcome",
} as const;

export type LearningFamily = (typeof LearningFamilies)[keyof typeof LearningFamilies];

export const TimeDimensions = {
  DAY_OF_WEEK: "day_of_week",
  MONTH: "month",
  SEASON: "season",
} as const;

export type TimeDimension = (typeof TimeDimensions)[keyof typeof TimeDimensions];

export const LearningMetricKeys = {
  PERFORMANCE_SCORE: "performance_score",
  APPROVAL_RATE: "approval_rate",
} as const;

export type LearningMetricKey = (typeof LearningMetricKeys)[keyof typeof LearningMetricKeys];

/** The Learning's own directional claim — distinct from any individual observation's
 * outcome_direction. 'inconclusive' is a first-class, honest outcome: evidence exists
 * but never resolved to a clear net direction. */
export const LearningDirections = {
  POSITIVE: "positive",
  NEGATIVE: "negative",
  NEUTRAL: "neutral",
  INCONCLUSIVE: "inconclusive",
} as const;

export type LearningDirection = (typeof LearningDirections)[keyof typeof LearningDirections];

export const LearningStatuses = {
  EMERGING: "emerging",
  ACTIVE: "active",
  WEAKENING: "weakening",
  INCONCLUSIVE: "inconclusive",
  SUPERSEDED: "superseded",
  ARCHIVED: "archived",
} as const;

export type LearningStatus = (typeof LearningStatuses)[keyof typeof LearningStatuses];

/** 'confirmed_preference' is deliberately excluded — Phase 2 never assigns it, and the
 * database's own check constraint refuses it (see migration 025). */
export const LearningConfidenceLevels = {
  EARLY_SIGNAL: "early_signal",
  DEVELOPING_PATTERN: "developing_pattern",
  STRONG_PATTERN: "strong_pattern",
} as const;

export type LearningConfidenceLevel =
  (typeof LearningConfidenceLevels)[keyof typeof LearningConfidenceLevels];

export const RecurrencePatterns = {
  NONE: "none",
  ANNUAL_MONTH: "annual_month",
  ANNUAL_RANGE: "annual_range",
  RECURRING_WEEKLY: "recurring_weekly",
} as const;

export type RecurrencePattern = (typeof RecurrencePatterns)[keyof typeof RecurrencePatterns];

export const EvidenceClassifications = {
  SUPPORTING: "supporting",
  CONTRADICTING: "contradicting",
  NEUTRAL: "neutral",
  EXCLUDED: "excluded",
} as const;

export type EvidenceClassification =
  (typeof EvidenceClassifications)[keyof typeof EvidenceClassifications];

/** One factual data point pulled in for evaluation — already resolved to a single
 * numeric value and timestamp, independent of which family produced it. Never a raw
 * observation row; this is the minimal shape learningMath/cohorts need. */
export type LearningEvidenceItem = {
  observationId: string;
  occurredAt: string;
  value: number;
  /** Present only for timing_performance evidence (resolved from the observation's
   * context_snapshot); absent for recommendation_action_outcome evidence. */
  timeDimensionValue?: string;
};

export type ConfidenceComponents = {
  sampleSize: number;
  supportingCount: number;
  contradictingCount: number;
  neutralCount: number;
  excludedCount: number;
  consistency: number;
  contradictionRate: number;
  effectSize: number;
  recencyDays: number;
  seasonalRecurrenceCount: number;
  confounderCodes: ConfounderCode[];
};

/** The pure, deterministic output of evaluating one cohort — no database access, no
 * side effects. lib/marketing-memory/learningPersistence.ts is responsible for turning
 * this into an actual row. */
export type LearningEvaluationResult = {
  learningFamily: LearningFamily;
  timeDimension: TimeDimension | null;
  subjectKey: string;
  metricKey: LearningMetricKey;
  direction: LearningDirection;
  /** Already resolved (including the "weakening" transition, which depends on
   * recent-window evidence only learningEvaluation.ts's cohort math has access to) —
   * consumers should use this value directly rather than re-deriving status from
   * direction/confidenceLevel alone. */
  status: LearningStatus;
  confidenceLevel: LearningConfidenceLevel;
  confidenceComponents: ConfidenceComponents;
  sampleSize: number;
  supportingCount: number;
  contradictingCount: number;
  neutralCount: number;
  excludedCount: number;
  effectSize: number;
  comparisonBaseline: string;
  baselineValue: number;
  cohortValue: number;
  firstObservedAt: string;
  lastObservedAt: string;
  evaluationWindowDays: number;
  recurrencePattern: RecurrencePattern;
  seasonalRecurrenceCount: number;
  confounderCodes: ConfounderCode[];
  summary: string;
  internalRationale: string;
  learningKey: string;
  /** Observation ids classified as supporting/contradicting/neutral — used to write
   * marketing_memory_evidence_links rows once persisted. Excluded items are not linked
   * (they were dropped before evaluation, not evidence against the pattern). */
  evidenceByClassification: Record<
    Exclude<EvidenceClassification, "excluded">,
    string[]
  >;
};

/** One row of public.marketing_memory_learnings. */
export type MarketingMemoryLearning = {
  id: string;
  user_id: string;
  business_profile_id: string;
  learning_family: LearningFamily;
  time_dimension: TimeDimension | null;
  subject_key: string;
  metric_key: LearningMetricKey;
  direction: LearningDirection;
  status: LearningStatus;
  confidence_level: LearningConfidenceLevel;
  confidence_components: ConfidenceComponents;
  sample_size: number;
  supporting_count: number;
  contradicting_count: number;
  neutral_count: number;
  excluded_count: number;
  effect_size: number | null;
  comparison_baseline: string;
  baseline_value: number | null;
  cohort_value: number | null;
  first_observed_at: string;
  last_observed_at: string;
  evaluation_window_days: number;
  recurrence_pattern: RecurrencePattern;
  seasonal_recurrence_count: number;
  confounder_codes: ConfounderCode[];
  summary: string;
  internal_rationale: string;
  learning_key: string;
  superseded_by_learning_id: string | null;
  schema_version: number;
  evaluated_at: string;
  created_at: string;
  updated_at: string;
};

export type EvaluateLearningsSummary = {
  businessProfileId: string;
  cohortsEvaluated: number;
  learningsCreated: number;
  learningsUpdated: number;
  learningsSuperseded: number;
  learningsSkipped: number;
};

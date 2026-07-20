/**
 * Marketing Experimentation Engine — closed vocabularies and entity shapes.
 * See docs/MARKETING_EXPERIMENTATION_ENGINE.md.
 *
 * Experiments measure outcomes for Director-proposed, user-approved tests.
 * They never invent recommendations or strategy.
 */

export const ExperimentTypes = {
  POSTING_TIME: "posting_time",
  CONTENT_FORMAT: "content_format",
  CTA_VARIATION: "cta_variation",
  MESSAGING_STYLE: "messaging_style",
  IMAGE_VS_TEXT: "image_vs_text",
  CAMPAIGN_SEQUENCING: "campaign_sequencing",
  REVIEW_REQUEST_TIMING: "review_request_timing",
} as const;

export type ExperimentType = (typeof ExperimentTypes)[keyof typeof ExperimentTypes];

export const ExperimentStatuses = {
  DRAFT: "draft",
  PROPOSED: "proposed",
  APPROVED: "approved",
  RUNNING: "running",
  MEASURING: "measuring",
  COMPLETED: "completed",
  ARCHIVED: "archived",
} as const;

export type ExperimentStatus = (typeof ExperimentStatuses)[keyof typeof ExperimentStatuses];

export const ExperimentConfidenceLevels = {
  INSUFFICIENT: "insufficient",
  EARLY: "early",
  MODERATE: "moderate",
  STRONG: "strong",
} as const;

export type ExperimentConfidenceLevel =
  (typeof ExperimentConfidenceLevels)[keyof typeof ExperimentConfidenceLevels];

export const ExperimentOutcomeDirections = {
  VARIANT_A: "variant_a",
  VARIANT_B: "variant_b",
  INCONCLUSIVE: "inconclusive",
  INSUFFICIENT_DATA: "insufficient_data",
} as const;

export type ExperimentOutcomeDirection =
  (typeof ExperimentOutcomeDirections)[keyof typeof ExperimentOutcomeDirections];

export type ExperimentVariant = {
  /** "control" | "treatment" — explicit roles, never an unordered pair. */
  key: string;
  label: string;
  description: string;
};

export type ExperimentKpiMetric =
  | "engagement"
  | "clicks"
  | "reviews"
  | "reach"
  | "conversions"
  | "publishingConsistency";

/**
 * [Claude review, follow-up] Existing analytics capture one aggregate total per KPI per
 * business — there is no per-post/per-variant tag anywhere in analytics capture, so
 * there is no real per-variant metric to record. A prior version of this type held
 * separate *A/*B fields; the very shape invited fabricating a comparison (first via a
 * biased floor/ceil split, then via duplicating one value into both fields even after
 * that was fixed) where no real distinction exists. This shape can only ever describe
 * the aggregate observed over the experiment's measurement window — not attribute any
 * of it to a variant. See docs/MARKETING_EXPERIMENTATION_ENGINE.md "Future attribution
 * boundary" for what would need to exist before a variant-level type is reintroduced.
 */
export type ExperimentMetrics = {
  primaryMetric: ExperimentKpiMetric;
  /** Aggregate value observed over the measurement window, or null if unmeasured. */
  aggregateValue: number | null;
  measurementStart: string | null;
  measurementEnd: string | null;
};

export type ExperimentOutcome = {
  direction: ExperimentOutcomeDirection;
  confidenceLevel: ExperimentConfidenceLevel;
  winningVariantKey: string | null;
  summary: string;
  primaryMetric: ExperimentKpiMetric;
  liftPercent: number | null;
  /**
   * True only once a future phase adds real per-variant attribution (see
   * ExperimentMetrics doc comment). Every producer in this codebase today sets this to
   * false, and whenever it is false, direction/winningVariantKey/liftPercent/
   * confidenceLevel must reflect "aggregate observed, no attribution" — never a winner,
   * never confidence above "early".
   */
  attributionAvailable: boolean;
};

export type MarketingExperiment = {
  id: string;
  user_id: string;
  business_profile_id: string;
  experiment_type: ExperimentType;
  title: string;
  hypothesis: string;
  status: ExperimentStatus;
  variants: ExperimentVariant[];
  outcome: ExperimentOutcome;
  metrics: ExperimentMetrics;
  created_from_recommendation_id: string;
  related_campaign_id: string | null;
  marketing_director_decision_key: string;
  template_id: string;
  /** The approved proposal this experiment was converted from. Never null for an
   * experiment created through the current (proposal-only) creation path. */
  source_proposal_id: string | null;
  started_at: string | null;
  measured_at: string | null;
  completed_at: string | null;
  schema_version: number;
  created_at: string;
  updated_at: string;
};

/** Customer-safe dashboard card — no internal scores. */
export type ExperimentDashboardCard = {
  id: string;
  experimentType: ExperimentType;
  title: string;
  hypothesis: string;
  status: ExperimentStatus;
  outcomeSummary: string;
  confidenceLabel: string;
  attributionAvailable: boolean;
  recommendationId: string;
  campaignId: string | null;
  variants: ExperimentVariant[];
};

export type ExperimentTemplate = {
  id: string;
  experimentType: ExperimentType;
  title: string;
  defaultHypothesis: string;
  variants: ExperimentVariant[];
  primaryMetric: ExperimentKpiMetric;
  /** Only `supported: true` templates may back a Marketing Director proposal — see the
   * module doc comment in experiment-templates.ts. */
  supported: boolean;
  /** Required when supported is false — why this type is deferred, not measurable yet. */
  deferralReason?: string;
};

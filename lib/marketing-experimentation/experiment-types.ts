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
  key: string;
  label: string;
  description: string;
};

export type ExperimentMetrics = {
  engagementA: number;
  engagementB: number;
  clicksA: number;
  clicksB: number;
  reviewsA: number;
  reviewsB: number;
  reachA: number;
  reachB: number;
  conversionsA: number;
  conversionsB: number;
  publishingConsistencyA: number;
  publishingConsistencyB: number;
};

export type ExperimentOutcome = {
  direction: ExperimentOutcomeDirection;
  confidenceLevel: ExperimentConfidenceLevel;
  winningVariantKey: string | null;
  summary: string;
  primaryMetric:
    | "engagement"
    | "clicks"
    | "reviews"
    | "reach"
    | "conversions"
    | "publishingConsistency";
  liftPercent: number | null;
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
  primaryMetric: ExperimentOutcome["primaryMetric"];
};

/**
 * Creation is Marketing Director–gated and must cite an existing recommendation.
 * Engine never invents free-form experiments.
 */
export type ProposeExperimentInput = {
  experimentType: ExperimentType;
  createdFromRecommendationId: string;
  marketingDirectorDecisionKey: string;
  relatedCampaignId?: string | null;
  hypothesis?: string;
  /** Must be the literal gate acknowledging MD proposal. */
  proposedBy: "marketing_director";
};

/**
 * Adaptive Recommendation Intelligence: deterministic, non-ML learning from historical
 * recommendation outcomes (PR #27's recommendation_outcome_events / summarizeRecommendationOutcomeForUser).
 * See docs/ADAPTIVE_RECOMMENDATION_INTELLIGENCE.md for the full design.
 */

/** Deterministic 0-100 "did this go well" rate — never null when historicalSampleSize > 0 for that bucket. */
export type SuccessRateMap = Record<string, number>;

export type HistoricalRecommendationSignals = {
  /** Count of past recommendations that reached at least draft_created. Drives confidenceInHistory. */
  historicalSampleSize: number;
  /** 0-1 saturating confidence in the signals below — see COLD_START_FULL_CONFIDENCE_SAMPLE_SIZE. */
  confidenceInHistory: number;

  overallApprovalRate: number | null;
  overallRejectionRate: number | null;
  overallEditRate: number | null;
  overallPublishSuccessRate: number | null;
  /** Fraction of published/measured recommendations for which performance data actually
   * became available -- a coverage rate, not a quality judgment (see docs, "analytics
   * attribution limitations" carried over from PR #27's aggregate-allocation estimate). */
  overallPerformanceRate: number | null;
  /** Fraction of non-"unknown"-signal recommendations whose usefulnessSignal was "positive". */
  averageUsefulScore: number | null;

  channelSuccessRates: SuccessRateMap;
  actionTypeSuccessRates: SuccessRateMap;
  categorySuccessRates: SuccessRateMap;
  seasonalSuccessRates: SuccessRateMap;
  /** Keyed by UTC hour-of-day bucket (morning/afternoon/evening/night) -- see docs for the
   * timezone caveat: business_profiles has no stored timezone, so this reflects UTC. */
  timeOfDaySuccessRates: SuccessRateMap;
  /** Fraction of each category's drafts that received a meaningful edit -- drives the
   * "decrease score when category heavily edited" adjustment rule. */
  categoryEditRates: SuccessRateMap;

  averageTimeToApprovalHours: number | null;
  /** Average draft_edited count across all recommendations with a draft (0 for never-edited). */
  averageEditIntensity: number | null;
};

export const Seasons = {
  WINTER: "winter",
  SPRING: "spring",
  SUMMER: "summer",
  FALL: "fall",
} as const;
export type Season = (typeof Seasons)[keyof typeof Seasons];

export const TimeOfDayBuckets = {
  MORNING: "morning",
  AFTERNOON: "afternoon",
  EVENING: "evening",
  NIGHT: "night",
} as const;
export type TimeOfDayBucket = (typeof TimeOfDayBuckets)[keyof typeof TimeOfDayBuckets];

/** Deterministic business preference profile -- derived only from actual historical data. */
export type BusinessPreferenceProfile = {
  preferredChannels: string[];
  preferredRecommendationTypes: string[];
  preferredCategories: string[];
  /** Day-of-week names (UTC), derived from publishing_jobs.published_at. Empty if no publishes yet. */
  preferredPostingDays: string[];
  preferredPostingTimes: TimeOfDayBucket[];
  frequentlyRejectedTypes: string[];
  frequentlyEditedTypes: string[];
  highestPerformingTypes: string[];
  highestPerformingChannels: string[];
  lowestPerformingChannels: string[];
  /** Overall approval rate, exposed here too since it's the core "approval pattern". */
  approvalRate: number | null;
  sampleSize: number;
};

export const RecommendationReasonTypes = {
  HISTORICAL_APPROVAL: "historical_approval",
  HISTORICAL_REJECTION: "historical_rejection",
  CHANNEL_PERFORMANCE: "channel_performance",
  CATEGORY_PERFORMANCE: "category_performance",
  ACTION_TYPE_PERFORMANCE: "action_type_performance",
  SEASONAL_PERFORMANCE: "seasonal_performance",
  EDIT_INTENSITY: "edit_intensity",
  COLD_START: "cold_start",
  MARKET_OPPORTUNITY: "market_opportunity",
} as const;
export type RecommendationReasonType =
  (typeof RecommendationReasonTypes)[keyof typeof RecommendationReasonTypes];

export type RecommendationReasonSource = "market" | "history";

export type RecommendationReason = {
  reasonType: RecommendationReasonType;
  /** Signed contribution to the final score, in the same 0-100 points scale as priorityScore. */
  reasonWeight: number;
  reasonDescription: string;
  reasonSource: RecommendationReasonSource;
};

export type AdaptiveScoreBreakdown = {
  baseScore: number;
  baseConfidence: number;
  historicalAdjustment: number;
  historicalConfidence: number;
  finalScore: number;
  finalConfidence: number;
  reasons: RecommendationReason[];
  historicalSampleSize: number;
};

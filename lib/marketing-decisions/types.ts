export const RecommendedActionTypes = {
  PUBLISH_GBP_POST: "publish_gbp_post",
  REQUEST_REVIEWS: "request_reviews",
  CREATE_SEASONAL_CONTENT: "create_seasonal_content",
  CREATE_TIMELY_CONTENT: "create_timely_content",
  INCREASE_POSTING_FREQUENCY: "increase_posting_frequency",
  UPDATE_BUSINESS_INFO: "update_business_info",
  UPLOAD_PHOTOS: "upload_photos",
  REFRESH_WEBSITE_CONTENT: "refresh_website_content",
} as const;

export type RecommendedActionType =
  (typeof RecommendedActionTypes)[keyof typeof RecommendedActionTypes];

export const RecommendationUrgencies = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical",
} as const;

export type RecommendationUrgency =
  (typeof RecommendationUrgencies)[keyof typeof RecommendationUrgencies];

export const RecommendationImpacts = { LOW: "low", MEDIUM: "medium", HIGH: "high" } as const;
export type RecommendationImpact = (typeof RecommendationImpacts)[keyof typeof RecommendationImpacts];

export const RecommendationEfforts = { LOW: "low", MEDIUM: "medium", HIGH: "high" } as const;
export type RecommendationEffort = (typeof RecommendationEfforts)[keyof typeof RecommendationEfforts];

export const RecommendationStatuses = {
  OPEN: "open",
  DISMISSED: "dismissed",
  COMPLETED: "completed",
  // A recommendation whose underlying opportunity group no longer exists as detected
  // (e.g. some of its opportunities were resolved/dismissed, or expired) — distinct
  // from "completed" (the user did it) or "dismissed" (the user rejected it): nobody
  // acted on it, the reasoning behind it simply no longer holds.
  SUPERSEDED: "superseded",
} as const;

export type RecommendationStatus =
  (typeof RecommendationStatuses)[keyof typeof RecommendationStatuses];

/** One row of public.marketing_recommendations. */
export type MarketingRecommendation = {
  id: string;
  user_id: string;
  business_profile_id: string;
  recommended_action_type: RecommendedActionType;
  /** 0-100, aggregate rank across the merged opportunity group. */
  priority_score: number;
  urgency: RecommendationUrgency;
  business_impact: RecommendationImpact;
  estimated_effort: RecommendationEffort;
  /** 0-100, average confidence across the merged opportunity group. */
  confidence: number;
  reasoning: string;
  related_opportunity_ids: string[];
  status: RecommendationStatus;
  created_at: string;
  updated_at: string;
};

/**
 * What the decision engine produces for one action-type group — not yet persisted.
 * `dedupeKey` is the sorted, joined relatedOpportunityIds; see the migration's unique
 * constraint and lib/marketing-decisions/decisionEngine.ts for how it's derived.
 */
export type MarketingRecommendationDraft = {
  recommendedActionType: RecommendedActionType;
  priorityScore: number;
  urgency: RecommendationUrgency;
  businessImpact: RecommendationImpact;
  estimatedEffort: RecommendationEffort;
  confidence: number;
  reasoning: string;
  relatedOpportunityIds: string[];
  dedupeKey: string;
};

export const OpportunityCategories = {
  MISSING_GBP_POSTS: "missing_gbp_posts",
  LOW_REVIEW_ACTIVITY: "low_review_activity",
  SEASONAL: "seasonal",
  HOLIDAY: "holiday",
  WEATHER: "weather",
  LOCAL_EVENT: "local_event",
  DECLINING_ENGAGEMENT: "declining_engagement",
  MISSING_BUSINESS_INFO: "missing_business_info",
  MISSING_PHOTOS: "missing_photos",
  STALE_WEBSITE_CONTENT: "stale_website_content",
} as const;

export type OpportunityCategory =
  (typeof OpportunityCategories)[keyof typeof OpportunityCategories];

export const OpportunitySeverities = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical",
} as const;

export type OpportunitySeverity =
  (typeof OpportunitySeverities)[keyof typeof OpportunitySeverities];

export const OpportunityStatuses = {
  OPEN: "open",
  IN_PROGRESS: "in_progress",
  DISMISSED: "dismissed",
  EXPIRED: "expired",
  RESOLVED: "resolved",
} as const;

export type OpportunityStatus = (typeof OpportunityStatuses)[keyof typeof OpportunityStatuses];

/** One row of public.marketing_opportunities. */
export type MarketingOpportunity = {
  id: string;
  user_id: string;
  business_profile_id: string;
  category: OpportunityCategory;
  severity: OpportunitySeverity;
  confidence: number;
  title: string;
  description: string;
  evidence: Record<string, unknown>;
  recommended_action: string;
  expires_at: string | null;
  status: OpportunityStatus;
  created_at: string;
  updated_at: string;
};

/**
 * What a detector produces — not yet persisted, and deliberately missing id/user_id/
 * business_profile_id/status/created_at/updated_at, all of which the persistence layer
 * (not the detector) is responsible for. `dedupeKey` is the detector's declaration of
 * "what makes this one logical opportunity" — see the migration's unique constraint.
 */
export type MarketingOpportunityDraft = {
  category: OpportunityCategory;
  severity: OpportunitySeverity;
  /** 0-100 */
  confidence: number;
  title: string;
  description: string;
  evidence: Record<string, unknown>;
  recommendedAction: string;
  /** null means the opportunity never auto-expires. */
  expiresAt: string | null;
  dedupeKey: string;
};

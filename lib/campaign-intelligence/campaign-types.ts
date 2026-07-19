/**
 * Campaign Intelligence Engine — closed vocabularies and entity shapes.
 * See docs/CAMPAIGN_INTELLIGENCE_ENGINE.md.
 *
 * Campaigns are execution plans. They never create recommendations. Steps only
 * reference existing RecommendedActionType values.
 */

import type { RecommendedActionType } from "@/lib/marketing-decisions/types";

export const CampaignTypes = {
  BACK_TO_SCHOOL: "back_to_school",
  HOLIDAY_PROMOTION: "holiday_promotion",
  CUSTOMER_APPRECIATION: "customer_appreciation",
  COMMUNITY_EVENT: "community_event",
  HIRING: "hiring",
  SEASONAL_PROMOTION: "seasonal_promotion",
} as const;

export type CampaignType = (typeof CampaignTypes)[keyof typeof CampaignTypes];

export const CampaignStatuses = {
  DRAFT: "draft",
  PLANNED: "planned",
  APPROVED: "approved",
  SCHEDULED: "scheduled",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  MEASURED: "measured",
  ARCHIVED: "archived",
} as const;

export type CampaignStatus = (typeof CampaignStatuses)[keyof typeof CampaignStatuses];

/** Future cancellation — reserved, not implemented in transitions yet. */
export const FUTURE_CAMPAIGN_STATUS_CANCELLED = "cancelled" as const;

export const CampaignStepStatuses = {
  PENDING: "pending",
  SCHEDULED: "scheduled",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  BLOCKED: "blocked",
  MISSED: "missed",
  SKIPPED: "skipped",
} as const;

export type CampaignStepStatus =
  (typeof CampaignStepStatuses)[keyof typeof CampaignStepStatuses];

export type CampaignTimelineStep = {
  key: string;
  label: string;
  /** Existing recommended_action_type only — never a new recommendation kind. */
  actionType: RecommendedActionType;
  status: CampaignStepStatus;
  dayOffset: number;
  scheduledFor: string | null;
  completedAt: string | null;
};

export type CampaignMetrics = {
  completionRate: number;
  stepsCompleted: number;
  stepsSkipped: number;
  stepsTotal: number;
  engagement: number;
  publishingConsistency: number;
  reviewActivity: number;
  recommendationAcceptance: number;
  campaignDurationDays: number | null;
  campaignCompletionTimeDays: number | null;
};

export type MarketingCampaign = {
  id: string;
  user_id: string;
  business_profile_id: string;
  campaign_type: CampaignType;
  objective: string;
  status: CampaignStatus;
  start_date: string | null;
  target_end_date: string | null;
  current_step_index: number;
  timeline: CampaignTimelineStep[];
  metrics: CampaignMetrics;
  created_from_recommendation_id: string | null;
  marketing_director_decision_key: string | null;
  template_id: string;
  schema_version: number;
  created_at: string;
  updated_at: string;
};

/** Customer-safe dashboard summary — no internal scoring. */
export type CampaignDashboardCard = {
  id: string;
  campaignType: CampaignType;
  title: string;
  objective: string;
  status: CampaignStatus;
  nextMilestone: string | null;
  completionPercent: number;
  timeline: CampaignTimelineStep[];
  recentProgress: string[];
};

export type CampaignTemplateStep = {
  key: string;
  label: string;
  actionType: RecommendedActionType;
  dayOffset: number;
};

export type CampaignTemplate = {
  id: string;
  campaignType: CampaignType;
  title: string;
  defaultObjective: string;
  steps: CampaignTemplateStep[];
};

export type InitiateCampaignInput = {
  campaignType: CampaignType;
  objective?: string;
  /** Required — Campaign Engine never self-initiates. */
  marketingDirectorDecisionKey: string;
  createdFromRecommendationId?: string | null;
  startDate?: string | null;
  /** Must be the literal gate acknowledging MD initiation. */
  initiatedBy: "marketing_director";
};

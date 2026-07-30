/**
 * Autonomous Growth Planner — weekly strategic plan model.
 *
 * The planner turns Business Brain intelligence into one weekly marketing plan.
 * It recommends. The customer approves. Nothing executes automatically.
 *
 * See docs/project-magic/AUTONOMOUS_GROWTH_PLANNER.md.
 */

import type { ConfidenceLabel } from "@/lib/recommendation-presentation/types";
import type { PlanTrustCertainty } from "@/lib/growth-planner/trust";

/** Exactly one primary objective per weekly plan. */
export const PrimaryObjectiveKeys = {
  INCREASE_SERVICE_BOOKINGS: "increase_service_bookings",
  IMPROVE_REVIEW_VELOCITY: "improve_review_velocity",
  GROW_LOCAL_AWARENESS: "grow_local_awareness",
  PROMOTE_SEASONAL_SERVICES: "promote_seasonal_services",
  INCREASE_REPEAT_CUSTOMERS: "increase_repeat_customers",
} as const;

export type PrimaryObjectiveKey =
  (typeof PrimaryObjectiveKeys)[keyof typeof PrimaryObjectiveKeys];

export const PRIMARY_OBJECTIVE_LABELS: Record<PrimaryObjectiveKey, string> = {
  increase_service_bookings: "Increase service bookings",
  improve_review_velocity: "Improve review velocity",
  grow_local_awareness: "Grow local awareness",
  promote_seasonal_services: "Promote seasonal services",
  increase_repeat_customers: "Increase repeat customers",
};

export const SupportingActionKinds = {
  GOOGLE_BUSINESS_POST: "google_business_post",
  WEBSITE_UPDATE: "website_update",
  EMAIL_CAMPAIGN: "email_campaign",
  SOCIAL_CONTENT: "social_content",
  LANDING_PAGE_REFRESH: "landing_page_refresh",
  REVIEW_REQUEST_CAMPAIGN: "review_request_campaign",
  PHOTO_UPDATE: "photo_update",
  BUSINESS_INFO_UPDATE: "business_info_update",
} as const;

export type SupportingActionKind =
  (typeof SupportingActionKinds)[keyof typeof SupportingActionKinds];

export const SUPPORTING_ACTION_LABELS: Record<SupportingActionKind, string> = {
  google_business_post: "Google Business Post",
  website_update: "Website update",
  email_campaign: "Email campaign",
  social_content: "Social content",
  landing_page_refresh: "Landing page refresh",
  review_request_campaign: "Review request campaign",
  photo_update: "Photo update",
  business_info_update: "Business info update",
};

export const SuccessMetricKeys = {
  PHONE_CALLS: "phone_calls",
  BOOKINGS: "bookings",
  WEBSITE_INQUIRIES: "website_inquiries",
  REVIEW_VOLUME: "review_volume",
  RETURNING_CUSTOMERS: "returning_customers",
  LOCAL_VISIBILITY: "local_visibility",
} as const;

export type SuccessMetricKey = (typeof SuccessMetricKeys)[keyof typeof SuccessMetricKeys];

export const SUCCESS_METRIC_LABELS: Record<SuccessMetricKey, string> = {
  phone_calls: "Phone calls",
  bookings: "Bookings",
  website_inquiries: "Website inquiries",
  review_volume: "Review volume",
  returning_customers: "Returning customers",
  local_visibility: "Local visibility",
};

export const WeeklyPlanStatuses = {
  PROPOSED: "proposed",
  APPROVED: "approved",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  SKIPPED: "skipped",
} as const;

export type WeeklyPlanStatus = (typeof WeeklyPlanStatuses)[keyof typeof WeeklyPlanStatuses];

/** One grounded evidence citation — never chain-of-thought. */
export type PlanEvidenceItem = {
  id: string;
  /** Observed | Likely | Recommended */
  certainty: PlanTrustCertainty;
  /** Short customer-safe statement. */
  statement: string;
  /** Opaque Business Brain source key. */
  source: "business_discovery" | "goals" | "customer_voice" | "external_intelligence" | "weekly_briefing" | "smart_uploads" | "business_reasoning" | "business_learning_engine";
};

export type PlanSupportingAction = {
  id: string;
  kind: SupportingActionKind;
  title: string;
  detail: string;
  /** Always Recommended — never auto-executed. */
  certainty: PlanTrustCertainty;
};

export type PlanWatchSignal = {
  id: string;
  label: string;
  detail: string;
};

export type PlanExplainability = {
  whyNow: string;
  supportingEvidence: string[];
  confidenceLabel: ConfidenceLabel | null;
  confidenceLabelText: string | null;
  businessImpact: string;
  relatedGoals: string[];
};

export type WeeklyGrowthPlan = {
  /** Stable id for this generated plan instance. */
  id: string;
  /** ISO week key, e.g. 2026-W31. */
  weekKey: string;
  generatedAt: string;
  status: WeeklyPlanStatus;
  /** Customer-reported or later-recorded outcome — null until available. */
  outcome: string | null;

  primaryObjective: {
    key: PrimaryObjectiveKey;
    label: string;
  };
  whyNow: string;
  expectedImpact: string;
  estimatedEffort: string;
  supportingActions: PlanSupportingAction[];
  successMetric: {
    key: SuccessMetricKey;
    label: string;
    detail: string;
  };
  whatIllWatch: PlanWatchSignal[];
  evidence: PlanEvidenceItem[];
  /**
   * Business Learning Engine context (Part 6) — shown separately from
   * current evidence, never blended into it. Empty when no reinforced
   * pattern is relevant to this week's objective.
   */
  historicalContext: PlanEvidenceItem[];
  explainability: PlanExplainability;
};

/** Compact history row for comparison UI and persistence. */
export type WeeklyPlanHistoryEntry = {
  id: string;
  weekKey: string;
  generatedAt: string;
  objectiveKey: PrimaryObjectiveKey;
  objectiveLabel: string;
  status: WeeklyPlanStatus;
  outcome: string | null;
  /** Snapshot of the full plan for week-over-week comparison. */
  plan: WeeklyGrowthPlan;
};

export type WeeklyPlanComparison = {
  current: WeeklyPlanHistoryEntry;
  previous: WeeklyPlanHistoryEntry | null;
  objectiveChanged: boolean;
  statusChanged: boolean;
  summary: string;
};

/** Presentation + persistence bundle for Growth Advisor. */
export type WeeklyGrowthPlanBundle = {
  plan: WeeklyGrowthPlan;
  history: WeeklyPlanHistoryEntry[];
  comparison: WeeklyPlanComparison;
  /** True when the plan was written back to marketing_goals history. */
  persisted: boolean;
};

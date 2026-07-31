/**
 * Resolve exactly one primary weekly objective from Business Brain signals.
 * Never returns more than one. Prefer Marketing Director's ranked action direction
 * without inventing a competing recommendation engine.
 */

import type { BusinessGoal } from "@/lib/goals/types";
import type { CustomerVoiceIntelligence } from "@/lib/customer-voice/types";
import type { ExternalIntelligence } from "@/lib/external-intelligence/types";
import type { HeadOfMarketingBriefing } from "@/lib/head-of-marketing/types";
import { RecommendedActionTypes } from "@/lib/marketing-decisions/types";
import type { DetectedOpportunity } from "@/lib/opportunity-engine/types";
import {
  PRIMARY_OBJECTIVE_LABELS,
  PrimaryObjectiveKeys,
  type PrimaryObjectiveKey,
} from "@/lib/growth-planner/types";

/** Every opportunity type maps to exactly one primary objective — lets the
 * Weekly Growth Plan be generated from an active, evidence-scored
 * opportunity rather than only a static action-type/goal lookup table. */
const OPPORTUNITY_TYPE_TO_OBJECTIVE: Record<DetectedOpportunity["type"], PrimaryObjectiveKey> = {
  seasonal: PrimaryObjectiveKeys.PROMOTE_SEASONAL_SERVICES,
  trending_search: PrimaryObjectiveKeys.INCREASE_SERVICE_BOOKINGS,
  reputation: PrimaryObjectiveKeys.IMPROVE_REVIEW_VELOCITY,
  review_request: PrimaryObjectiveKeys.IMPROVE_REVIEW_VELOCITY,
  content_gap: PrimaryObjectiveKeys.INCREASE_SERVICE_BOOKINGS,
  website_improvement: PrimaryObjectiveKeys.GROW_LOCAL_AWARENESS,
  local_event: PrimaryObjectiveKeys.GROW_LOCAL_AWARENESS,
  competitive_positioning: PrimaryObjectiveKeys.GROW_LOCAL_AWARENESS,
  customer_education: PrimaryObjectiveKeys.INCREASE_SERVICE_BOOKINGS,
  faq: PrimaryObjectiveKeys.INCREASE_SERVICE_BOOKINGS,
  service_spotlight: PrimaryObjectiveKeys.INCREASE_SERVICE_BOOKINGS,
  underperforming_content_refresh: PrimaryObjectiveKeys.INCREASE_SERVICE_BOOKINGS,
  high_performing_content_expansion: PrimaryObjectiveKeys.GROW_LOCAL_AWARENESS,
};

/** Only a genuinely well-evidenced, high-scoring opportunity drives the
 * week's objective — a thin or borderline one defers to the existing
 * action-type/goal-based resolution below. */
const MIN_OPPORTUNITY_SCORE_TO_DRIVE_OBJECTIVE = 60;

export type PrimaryObjectiveResolution = {
  key: PrimaryObjectiveKey;
  label: string;
};

const ACTION_TO_OBJECTIVE: Partial<Record<string, PrimaryObjectiveKey>> = {
  [RecommendedActionTypes.REQUEST_REVIEWS]: PrimaryObjectiveKeys.IMPROVE_REVIEW_VELOCITY,
  [RecommendedActionTypes.CREATE_SEASONAL_CONTENT]: PrimaryObjectiveKeys.PROMOTE_SEASONAL_SERVICES,
  [RecommendedActionTypes.PUBLISH_GBP_POST]: PrimaryObjectiveKeys.GROW_LOCAL_AWARENESS,
  [RecommendedActionTypes.INCREASE_POSTING_FREQUENCY]: PrimaryObjectiveKeys.GROW_LOCAL_AWARENESS,
  [RecommendedActionTypes.UPLOAD_PHOTOS]: PrimaryObjectiveKeys.GROW_LOCAL_AWARENESS,
  [RecommendedActionTypes.UPDATE_BUSINESS_INFO]: PrimaryObjectiveKeys.GROW_LOCAL_AWARENESS,
  [RecommendedActionTypes.CREATE_TIMELY_CONTENT]: PrimaryObjectiveKeys.INCREASE_SERVICE_BOOKINGS,
  [RecommendedActionTypes.REFRESH_WEBSITE_CONTENT]: PrimaryObjectiveKeys.INCREASE_SERVICE_BOOKINGS,
};

function objectiveFromGoalKey(goalKey: string): PrimaryObjectiveKey | null {
  switch (goalKey) {
    case "generate_more_leads":
    case "increase_revenue":
    case "increase_website_conversions":
      return PrimaryObjectiveKeys.INCREASE_SERVICE_BOOKINGS;
    case "improve_online_reputation":
      return PrimaryObjectiveKeys.IMPROVE_REVIEW_VELOCITY;
    case "increase_recurring_customers":
    case "grow_memberships":
      return PrimaryObjectiveKeys.INCREASE_REPEAT_CUSTOMERS;
    case "reduce_seasonality":
    case "launch_new_service":
      return PrimaryObjectiveKeys.PROMOTE_SEASONAL_SERVICES;
    case "expand_new_market":
      return PrimaryObjectiveKeys.GROW_LOCAL_AWARENESS;
    default:
      return null;
  }
}

/**
 * Pick exactly one primary objective.
 * Priority: MD action type → primary goal → Customer Voice / External cues → default awareness.
 */
export function resolvePrimaryObjective(input: {
  briefing: HeadOfMarketingBriefing;
  goals: BusinessGoal[];
  customerVoice?: CustomerVoiceIntelligence | null;
  externalIntelligence?: ExternalIntelligence | null;
  topOpportunity?: DetectedOpportunity | null;
}): PrimaryObjectiveResolution {
  if (input.topOpportunity && input.topOpportunity.score.total >= MIN_OPPORTUNITY_SCORE_TO_DRIVE_OBJECTIVE) {
    const key = OPPORTUNITY_TYPE_TO_OBJECTIVE[input.topOpportunity.type];
    return { key, label: PRIMARY_OBJECTIVE_LABELS[key] };
  }

  const actionType = input.briefing.topRecommendationDetail?.actionType ?? null;
  if (actionType && ACTION_TO_OBJECTIVE[actionType]) {
    const key = ACTION_TO_OBJECTIVE[actionType]!;
    return { key, label: PRIMARY_OBJECTIVE_LABELS[key] };
  }

  const primaryGoal = [...input.goals]
    .filter((g) => g.status === "active")
    .sort((a, b) => a.priority - b.priority)[0];
  if (primaryGoal) {
    const fromGoal = objectiveFromGoalKey(primaryGoal.key);
    if (fromGoal) {
      return { key: fromGoal, label: PRIMARY_OBJECTIVE_LABELS[fromGoal] };
    }
  }

  const ei = input.externalIntelligence;
  if (
    ei &&
    (ei.seasonalOpportunities.length > 0 || ei.holidayCalendar.length > 0) &&
    ei.emptyState !== "no_evidence"
  ) {
    return {
      key: PrimaryObjectiveKeys.PROMOTE_SEASONAL_SERVICES,
      label: PRIMARY_OBJECTIVE_LABELS[PrimaryObjectiveKeys.PROMOTE_SEASONAL_SERVICES],
    };
  }

  const cv = input.customerVoice;
  if (cv && cv.emptyState !== "no_evidence") {
    const voiceThemes = [
      ...cv.concerns,
      ...cv.opportunities,
      ...cv.strengths,
    ];
    const reviewPressure = voiceThemes.some(
      (t) => /review|reputation|trust/i.test(t.label) || t.sentiment === "negative",
    );
    if (reviewPressure || (cv.evidenceCount > 0 && cv.overallSentiment === "negative")) {
      return {
        key: PrimaryObjectiveKeys.IMPROVE_REVIEW_VELOCITY,
        label: PRIMARY_OBJECTIVE_LABELS[PrimaryObjectiveKeys.IMPROVE_REVIEW_VELOCITY],
      };
    }
  }

  return {
    key: PrimaryObjectiveKeys.GROW_LOCAL_AWARENESS,
    label: PRIMARY_OBJECTIVE_LABELS[PrimaryObjectiveKeys.GROW_LOCAL_AWARENESS],
  };
}

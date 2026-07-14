/**
 * Deterministic expected-benefit mapping, keyed by the existing RecommendedActionType
 * vocabulary (lib/marketing-decisions/types.ts) -- never a numeric projection.
 * Deliberately never claims a specific lead count, ranking increase, or ROI figure;
 * see docs/CLIENT_RECOMMENDATION_EXPERIENCE.md for why.
 */

import { RecommendedActionTypes, type RecommendedActionType } from "@/lib/marketing-decisions/types";

const EXPECTED_BENEFIT_BY_ACTION_TYPE: Record<RecommendedActionType, string> = {
  [RecommendedActionTypes.PUBLISH_GBP_POST]: "Improve your visibility on Google Business Profile.",
  [RecommendedActionTypes.REQUEST_REVIEWS]: "Support ongoing review growth.",
  [RecommendedActionTypes.CREATE_SEASONAL_CONTENT]: "Promote a seasonal service at the right time.",
  [RecommendedActionTypes.CREATE_TIMELY_CONTENT]: "Stay active and visible during a timely moment.",
  [RecommendedActionTypes.INCREASE_POSTING_FREQUENCY]: "Encourage more customer engagement with a steadier posting rhythm.",
  [RecommendedActionTypes.UPDATE_BUSINESS_INFO]: "Keep your business information accurate and easy for customers to find.",
  [RecommendedActionTypes.UPLOAD_PHOTOS]: "Strengthen your profile with fresh, current photos.",
  [RecommendedActionTypes.REFRESH_WEBSITE_CONTENT]: "Strengthen your website's relevance to what customers are searching for.",
};

export function getExpectedBenefit(actionType: RecommendedActionType): string {
  return EXPECTED_BENEFIT_BY_ACTION_TYPE[actionType];
}

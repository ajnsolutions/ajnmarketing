import type { OpportunityCategory } from "@/lib/marketing-opportunities/types";
import { OpportunityCategories } from "@/lib/marketing-opportunities/types";
import type {
  RecommendationEffort,
  RecommendationImpact,
  RecommendedActionType,
} from "@/lib/marketing-decisions/types";
import { RecommendationEfforts, RecommendationImpacts, RecommendedActionTypes } from "@/lib/marketing-decisions/types";

/**
 * Which recommended action an opportunity category ultimately points to. This is the
 * engine's merge rule: opportunities whose categories map to the SAME action type are
 * grouped into one recommendation (see decisionEngine.ts) — most directly, holiday,
 * weather, and local_event all become "create timely content", because asking a small
 * business to take three near-identical actions in the same week is redundant advice.
 * Every other category maps 1:1 to its own action, since those actions are genuinely
 * distinct (uploading photos is not the same task as requesting reviews).
 */
export const CATEGORY_TO_ACTION_TYPE: Record<OpportunityCategory, RecommendedActionType> = {
  [OpportunityCategories.MISSING_GBP_POSTS]: RecommendedActionTypes.PUBLISH_GBP_POST,
  [OpportunityCategories.LOW_REVIEW_ACTIVITY]: RecommendedActionTypes.REQUEST_REVIEWS,
  [OpportunityCategories.SEASONAL]: RecommendedActionTypes.CREATE_SEASONAL_CONTENT,
  [OpportunityCategories.HOLIDAY]: RecommendedActionTypes.CREATE_TIMELY_CONTENT,
  [OpportunityCategories.WEATHER]: RecommendedActionTypes.CREATE_TIMELY_CONTENT,
  [OpportunityCategories.LOCAL_EVENT]: RecommendedActionTypes.CREATE_TIMELY_CONTENT,
  [OpportunityCategories.DECLINING_ENGAGEMENT]: RecommendedActionTypes.INCREASE_POSTING_FREQUENCY,
  [OpportunityCategories.MISSING_BUSINESS_INFO]: RecommendedActionTypes.UPDATE_BUSINESS_INFO,
  [OpportunityCategories.MISSING_PHOTOS]: RecommendedActionTypes.UPLOAD_PHOTOS,
  [OpportunityCategories.STALE_WEBSITE_CONTENT]: RecommendedActionTypes.REFRESH_WEBSITE_CONTENT,
};

/**
 * Static, documented product judgment about how much a given action type typically
 * moves the needle for a small local business, and how much owner effort it typically
 * takes. Deterministic by design — these are not computed from opportunity evidence,
 * they're a property of the action itself.
 */
export const ACTION_TYPE_IMPACT: Record<RecommendedActionType, RecommendationImpact> = {
  [RecommendedActionTypes.PUBLISH_GBP_POST]: RecommendationImpacts.MEDIUM,
  [RecommendedActionTypes.REQUEST_REVIEWS]: RecommendationImpacts.HIGH,
  [RecommendedActionTypes.CREATE_SEASONAL_CONTENT]: RecommendationImpacts.MEDIUM,
  [RecommendedActionTypes.CREATE_TIMELY_CONTENT]: RecommendationImpacts.MEDIUM,
  [RecommendedActionTypes.INCREASE_POSTING_FREQUENCY]: RecommendationImpacts.MEDIUM,
  [RecommendedActionTypes.UPDATE_BUSINESS_INFO]: RecommendationImpacts.HIGH,
  [RecommendedActionTypes.UPLOAD_PHOTOS]: RecommendationImpacts.MEDIUM,
  [RecommendedActionTypes.REFRESH_WEBSITE_CONTENT]: RecommendationImpacts.LOW,
};

export const ACTION_TYPE_EFFORT: Record<RecommendedActionType, RecommendationEffort> = {
  [RecommendedActionTypes.PUBLISH_GBP_POST]: RecommendationEfforts.LOW,
  [RecommendedActionTypes.REQUEST_REVIEWS]: RecommendationEfforts.LOW,
  [RecommendedActionTypes.CREATE_SEASONAL_CONTENT]: RecommendationEfforts.MEDIUM,
  [RecommendedActionTypes.CREATE_TIMELY_CONTENT]: RecommendationEfforts.MEDIUM,
  [RecommendedActionTypes.INCREASE_POSTING_FREQUENCY]: RecommendationEfforts.MEDIUM,
  [RecommendedActionTypes.UPDATE_BUSINESS_INFO]: RecommendationEfforts.LOW,
  [RecommendedActionTypes.UPLOAD_PHOTOS]: RecommendationEfforts.MEDIUM,
  [RecommendedActionTypes.REFRESH_WEBSITE_CONTENT]: RecommendationEfforts.HIGH,
};

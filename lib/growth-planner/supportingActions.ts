/**
 * Practical supporting actions — recommendations only, never executed automatically.
 */

import type { HeadOfMarketingBriefing } from "@/lib/head-of-marketing/types";
import { RecommendedActionTypes } from "@/lib/marketing-decisions/types";
import { PlanTrustCertaintyLevels } from "@/lib/growth-planner/trust";
import {
  SUPPORTING_ACTION_LABELS,
  SupportingActionKinds,
  type PlanSupportingAction,
  type PrimaryObjectiveKey,
  type SupportingActionKind,
} from "@/lib/growth-planner/types";

const OBJECTIVE_ACTIONS: Record<PrimaryObjectiveKey, SupportingActionKind[]> = {
  increase_service_bookings: [
    SupportingActionKinds.GOOGLE_BUSINESS_POST,
    SupportingActionKinds.WEBSITE_UPDATE,
    SupportingActionKinds.LANDING_PAGE_REFRESH,
  ],
  improve_review_velocity: [
    SupportingActionKinds.REVIEW_REQUEST_CAMPAIGN,
    SupportingActionKinds.GOOGLE_BUSINESS_POST,
    SupportingActionKinds.EMAIL_CAMPAIGN,
  ],
  grow_local_awareness: [
    SupportingActionKinds.GOOGLE_BUSINESS_POST,
    SupportingActionKinds.SOCIAL_CONTENT,
    SupportingActionKinds.PHOTO_UPDATE,
  ],
  promote_seasonal_services: [
    SupportingActionKinds.GOOGLE_BUSINESS_POST,
    SupportingActionKinds.SOCIAL_CONTENT,
    SupportingActionKinds.EMAIL_CAMPAIGN,
  ],
  increase_repeat_customers: [
    SupportingActionKinds.EMAIL_CAMPAIGN,
    SupportingActionKinds.SOCIAL_CONTENT,
    SupportingActionKinds.REVIEW_REQUEST_CAMPAIGN,
  ],
};

const ACTION_TYPE_TO_KIND: Partial<Record<string, SupportingActionKind>> = {
  [RecommendedActionTypes.PUBLISH_GBP_POST]: SupportingActionKinds.GOOGLE_BUSINESS_POST,
  [RecommendedActionTypes.REQUEST_REVIEWS]: SupportingActionKinds.REVIEW_REQUEST_CAMPAIGN,
  [RecommendedActionTypes.CREATE_SEASONAL_CONTENT]: SupportingActionKinds.SOCIAL_CONTENT,
  [RecommendedActionTypes.CREATE_TIMELY_CONTENT]: SupportingActionKinds.GOOGLE_BUSINESS_POST,
  [RecommendedActionTypes.INCREASE_POSTING_FREQUENCY]: SupportingActionKinds.SOCIAL_CONTENT,
  [RecommendedActionTypes.UPDATE_BUSINESS_INFO]: SupportingActionKinds.BUSINESS_INFO_UPDATE,
  [RecommendedActionTypes.UPLOAD_PHOTOS]: SupportingActionKinds.PHOTO_UPDATE,
  [RecommendedActionTypes.REFRESH_WEBSITE_CONTENT]: SupportingActionKinds.WEBSITE_UPDATE,
};

const ACTION_DETAILS: Record<SupportingActionKind, string> = {
  google_business_post:
    "Share a timely Google Business update that points people toward the right next step.",
  website_update: "Refresh a key website page so visitors can find and act on your offer faster.",
  email_campaign: "Send a short email that re-engages past customers around this week’s focus.",
  social_content: "Post one clear social message aligned with the weekly objective.",
  landing_page_refresh:
    "Tighten a landing page around the service or offer you want more bookings for.",
  review_request_campaign:
    "Ask recent happy customers for a review while the experience is still fresh.",
  photo_update: "Add fresh photos that help people trust what you offer locally.",
  business_info_update: "Confirm hours, services, and contact details stay accurate everywhere.",
};

function actionFromKind(kind: SupportingActionKind, index: number): PlanSupportingAction {
  return {
    id: `action_${kind}_${index}`,
    kind,
    title: SUPPORTING_ACTION_LABELS[kind],
    detail: ACTION_DETAILS[kind],
    certainty: PlanTrustCertaintyLevels.RECOMMENDED,
  };
}

/**
 * Build 2–4 supporting actions. Primary MD action kind is always included first when known.
 * These remain recommendations — never auto-executed.
 */
export function buildSupportingActions(input: {
  objectiveKey: PrimaryObjectiveKey;
  briefing: HeadOfMarketingBriefing;
}): PlanSupportingAction[] {
  const kinds: SupportingActionKind[] = [];
  const seen = new Set<SupportingActionKind>();

  const push = (kind: SupportingActionKind) => {
    if (seen.has(kind)) return;
    seen.add(kind);
    kinds.push(kind);
  };

  const actionType = input.briefing.topRecommendationDetail?.actionType ?? null;
  if (actionType && ACTION_TYPE_TO_KIND[actionType]) {
    push(ACTION_TYPE_TO_KIND[actionType]!);
  }

  for (const kind of OBJECTIVE_ACTIONS[input.objectiveKey]) {
    push(kind);
    if (kinds.length >= 4) break;
  }

  if (kinds.length < 2) {
    push(SupportingActionKinds.GOOGLE_BUSINESS_POST);
    push(SupportingActionKinds.SOCIAL_CONTENT);
  }

  return kinds.slice(0, 4).map((kind, index) => actionFromKind(kind, index));
}

import { RecommendedActionTypes, type RecommendedActionType } from "@/lib/marketing-decisions/types";

/**
 * Action types that naturally produce a written content draft today.
 * Everything else must fail clearly and must not mutate recommendation state.
 */
export const CONTENT_SUPPORTED_ACTION_TYPES = [
  RecommendedActionTypes.CREATE_TIMELY_CONTENT,
  RecommendedActionTypes.CREATE_SEASONAL_CONTENT,
  RecommendedActionTypes.PUBLISH_GBP_POST,
  RecommendedActionTypes.REFRESH_WEBSITE_CONTENT,
] as const satisfies readonly RecommendedActionType[];

export type ContentSupportedActionType = (typeof CONTENT_SUPPORTED_ACTION_TYPES)[number];

export function isContentSupportedActionType(
  actionType: RecommendedActionType
): actionType is ContentSupportedActionType {
  return (CONTENT_SUPPORTED_ACTION_TYPES as readonly string[]).includes(actionType);
}

export type RecommendationContentTarget = {
  contentType: string;
  targetPlatform: string;
  length: "Short" | "Medium" | "Long";
  tone: "Professional" | "Friendly" | "Educational" | "Promotional";
};

const ACTION_CONTENT_TARGETS: Record<ContentSupportedActionType, RecommendationContentTarget> = {
  [RecommendedActionTypes.CREATE_TIMELY_CONTENT]: {
    contentType: "Community Post",
    targetPlatform: "Google Business Profile / Social",
    length: "Medium",
    tone: "Promotional",
  },
  [RecommendedActionTypes.CREATE_SEASONAL_CONTENT]: {
    contentType: "Seasonal Post",
    targetPlatform: "Google Business Profile / Social",
    length: "Medium",
    tone: "Friendly",
  },
  [RecommendedActionTypes.PUBLISH_GBP_POST]: {
    contentType: "Google Business Profile Post",
    targetPlatform: "Google Business Profile",
    length: "Short",
    tone: "Professional",
  },
  [RecommendedActionTypes.REFRESH_WEBSITE_CONTENT]: {
    contentType: "Blog Intro",
    targetPlatform: "Website",
    length: "Long",
    tone: "Educational",
  },
};

export function mapActionTypeToContentTarget(
  actionType: ContentSupportedActionType
): RecommendationContentTarget {
  return ACTION_CONTENT_TARGETS[actionType];
}

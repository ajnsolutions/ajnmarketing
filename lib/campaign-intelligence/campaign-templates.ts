/**
 * Declarative campaign templates — data only. Future templates should be added here
 * (or loaded from config) without changing execution logic.
 */

import { RecommendedActionTypes } from "@/lib/marketing-decisions/types";
import {
  CampaignTypes,
  type CampaignTemplate,
  type CampaignType,
} from "@/lib/campaign-intelligence/campaign-types";

export const CAMPAIGN_TEMPLATES: readonly CampaignTemplate[] = [
  {
    id: "tmpl_back_to_school_v1",
    campaignType: CampaignTypes.BACK_TO_SCHOOL,
    title: "Back to School",
    defaultObjective: "Capture seasonal local demand as school season approaches.",
    steps: [
      {
        key: "bts_gbp",
        label: "Publish a back-to-school Google Business post",
        actionType: RecommendedActionTypes.PUBLISH_GBP_POST,
        dayOffset: 0,
      },
      {
        key: "bts_seasonal",
        label: "Prepare seasonal content for the week",
        actionType: RecommendedActionTypes.CREATE_SEASONAL_CONTENT,
        dayOffset: 2,
      },
      {
        key: "bts_reviews",
        label: "Request reviews from recent customers",
        actionType: RecommendedActionTypes.REQUEST_REVIEWS,
        dayOffset: 5,
      },
      {
        key: "bts_photos",
        label: "Upload fresh photos of the business",
        actionType: RecommendedActionTypes.UPLOAD_PHOTOS,
        dayOffset: 7,
      },
    ],
  },
  {
    id: "tmpl_holiday_promotion_v1",
    campaignType: CampaignTypes.HOLIDAY_PROMOTION,
    title: "Holiday Promotion",
    defaultObjective: "Promote a timely holiday offer across owned channels.",
    steps: [
      {
        key: "hol_seasonal",
        label: "Create holiday-themed content",
        actionType: RecommendedActionTypes.CREATE_SEASONAL_CONTENT,
        dayOffset: 0,
      },
      {
        key: "hol_gbp",
        label: "Publish the holiday offer on Google",
        actionType: RecommendedActionTypes.PUBLISH_GBP_POST,
        dayOffset: 1,
      },
      {
        key: "hol_freq",
        label: "Keep posting cadence steady through the holiday window",
        actionType: RecommendedActionTypes.INCREASE_POSTING_FREQUENCY,
        dayOffset: 4,
      },
      {
        key: "hol_reviews",
        label: "Ask happy customers for reviews",
        actionType: RecommendedActionTypes.REQUEST_REVIEWS,
        dayOffset: 8,
      },
    ],
  },
  {
    id: "tmpl_customer_appreciation_v1",
    campaignType: CampaignTypes.CUSTOMER_APPRECIATION,
    title: "Customer Appreciation",
    defaultObjective: "Thank customers and reinforce local reputation.",
    steps: [
      {
        key: "app_gbp",
        label: "Publish a thank-you Google post",
        actionType: RecommendedActionTypes.PUBLISH_GBP_POST,
        dayOffset: 0,
      },
      {
        key: "app_reviews",
        label: "Request reviews from appreciated customers",
        actionType: RecommendedActionTypes.REQUEST_REVIEWS,
        dayOffset: 2,
      },
      {
        key: "app_photos",
        label: "Share photos of the team or community",
        actionType: RecommendedActionTypes.UPLOAD_PHOTOS,
        dayOffset: 4,
      },
    ],
  },
  {
    id: "tmpl_community_event_v1",
    campaignType: CampaignTypes.COMMUNITY_EVENT,
    title: "Community Event",
    defaultObjective: "Promote involvement in a local community moment.",
    steps: [
      {
        key: "com_timely",
        label: "Create timely local-event content",
        actionType: RecommendedActionTypes.CREATE_TIMELY_CONTENT,
        dayOffset: 0,
      },
      {
        key: "com_gbp",
        label: "Announce the event on Google",
        actionType: RecommendedActionTypes.PUBLISH_GBP_POST,
        dayOffset: 1,
      },
      {
        key: "com_info",
        label: "Confirm business info is accurate for visitors",
        actionType: RecommendedActionTypes.UPDATE_BUSINESS_INFO,
        dayOffset: 2,
      },
    ],
  },
  {
    id: "tmpl_hiring_v1",
    campaignType: CampaignTypes.HIRING,
    title: "Hiring",
    defaultObjective: "Attract local candidates with clear, consistent hiring visibility.",
    steps: [
      {
        key: "hire_gbp",
        label: "Publish a hiring post on Google",
        actionType: RecommendedActionTypes.PUBLISH_GBP_POST,
        dayOffset: 0,
      },
      {
        key: "hire_web",
        label: "Refresh website hiring/about content",
        actionType: RecommendedActionTypes.REFRESH_WEBSITE_CONTENT,
        dayOffset: 3,
      },
      {
        key: "hire_photos",
        label: "Upload workplace or team photos",
        actionType: RecommendedActionTypes.UPLOAD_PHOTOS,
        dayOffset: 5,
      },
    ],
  },
  {
    id: "tmpl_seasonal_promotion_v1",
    campaignType: CampaignTypes.SEASONAL_PROMOTION,
    title: "Seasonal Promotion",
    defaultObjective: "Run a focused seasonal promotion with consistent follow-through.",
    steps: [
      {
        key: "sea_seasonal",
        label: "Create seasonal promotional content",
        actionType: RecommendedActionTypes.CREATE_SEASONAL_CONTENT,
        dayOffset: 0,
      },
      {
        key: "sea_gbp",
        label: "Publish the promotion on Google",
        actionType: RecommendedActionTypes.PUBLISH_GBP_POST,
        dayOffset: 1,
      },
      {
        key: "sea_freq",
        label: "Maintain posting frequency during the season",
        actionType: RecommendedActionTypes.INCREASE_POSTING_FREQUENCY,
        dayOffset: 3,
      },
      {
        key: "sea_reviews",
        label: "Request reviews after promotional traffic",
        actionType: RecommendedActionTypes.REQUEST_REVIEWS,
        dayOffset: 9,
      },
    ],
  },
] as const;

export function getCampaignTemplate(campaignType: CampaignType): CampaignTemplate | null {
  return CAMPAIGN_TEMPLATES.find((template) => template.campaignType === campaignType) ?? null;
}

export function listCampaignTemplates(): CampaignTemplate[] {
  return [...CAMPAIGN_TEMPLATES];
}

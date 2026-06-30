import type { AiMarketingProfile } from "@/lib/ai-marketing-profile/types";
import type { BusinessProfile } from "@/lib/business-profile";
import type { MarketContextPromptSummary } from "@/lib/market-context/types";
import type { WebsiteAnalysis } from "@/lib/website-analysis/types";

export type MarketingPlanStatus = "generating" | "active" | "failed";

export type MarketingPlanWeeklyFocus = {
  week: number;
  title: string;
  focus: string;
  actions: string[];
};

export type MarketingPlanCalendarDay = {
  day: number;
  title: string;
  channel: string;
  contentType: string;
  note: string;
};

export type MarketingPlanPostingSchedule = {
  platform: string;
  cadence: string;
  bestTimes: string[];
  notes: string;
};

export type MarketingPlanContentMixItem = {
  type: string;
  percentage: number;
  description: string;
};

export type MarketingPlanGbpCadence = {
  cadence: string;
  postTypes: string[];
  notes: string;
};

export type MarketingPlanBlogRecommendation = {
  title: string;
  angle: string;
  keywords: string[];
};

export type MarketingPlanEmailIdea = {
  title: string;
  audience: string;
  goal: string;
  subjectLine: string;
};

export type MarketingPlanSeasonalCampaign = {
  title: string;
  timing: string;
  description: string;
};

export type MarketingPlanPromotion = {
  title: string;
  offer: string;
  channel: string;
  goal: string;
};

export type MarketingPlanVideoIdea = {
  title: string;
  format: string;
  hook: string;
};

export type MarketingPlanSocialRecommendation = {
  platform: string;
  priority: string;
  rationale: string;
  contentFocus: string[];
};

export type MarketingPlanKpi = {
  metric: string;
  target: string;
  why: string;
};

export type MarketingPlanJson = {
  executiveSummary: string;
  businessGoals: string[];
  marketingThemes: string[];
  weeklyFocus: MarketingPlanWeeklyFocus[];
  thirtyDayCalendar: MarketingPlanCalendarDay[];
  recommendedPostingSchedule: MarketingPlanPostingSchedule[];
  contentMix: MarketingPlanContentMixItem[];
  googleBusinessProfilePostingCadence: MarketingPlanGbpCadence;
  blogRecommendations: MarketingPlanBlogRecommendation[];
  emailCampaignIdeas: MarketingPlanEmailIdea[];
  seasonalCampaigns: MarketingPlanSeasonalCampaign[];
  suggestedPromotions: MarketingPlanPromotion[];
  videoIdeas: MarketingPlanVideoIdea[];
  socialPlatformRecommendations: MarketingPlanSocialRecommendation[];
  kpisToMonitor: MarketingPlanKpi[];
};

export type MarketingPlan = {
  id: string;
  user_id: string;
  business_profile_id: string;
  month: number;
  year: number;
  status: MarketingPlanStatus;
  plan_json: MarketingPlanJson;
  created_at: string;
  updated_at: string;
};

export type MarketingPlannerContext = {
  businessProfile: BusinessProfile;
  aiMarketingProfile: AiMarketingProfile | null;
  websiteAnalysis: WebsiteAnalysis | null;
  marketContextSummary: MarketContextPromptSummary | null;
  month: number;
  year: number;
  monthName: string;
  season: string;
};

export interface MarketingPlanner {
  generate(context: MarketingPlannerContext): Promise<MarketingPlanJson>;
}

export type MarketingPlanPageData = {
  plan: MarketingPlan | null;
  currentMonth: number;
  currentYear: number;
  monthName: string;
};

export type MarketingPlanCreateContentInput = {
  plan_item_type: "calendar" | "campaign" | "blog" | "email" | "video" | "social";
  plan_item_title: string;
  plan_item_description: string;
  recommended_channel?: string;
  scheduled_date?: string;
};

export type MarketingPlanCreateContentResult = {
  content_approval_id: string;
  title: string;
  status: "pending";
};

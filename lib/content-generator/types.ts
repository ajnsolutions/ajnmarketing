import type { AiMarketingProfile } from "@/lib/ai-marketing-profile/types";
import type { BusinessProfile } from "@/lib/business-profile";
import type { MarketContextPromptSummary } from "@/lib/market-context/types";
import type { WebsiteAnalysis } from "@/lib/website-analysis/types";

export type ContentLength = "Short" | "Medium" | "Long";

export type ContentTone = "Professional" | "Friendly" | "Educational" | "Promotional";

export type VariationStyle =
  | "Educational"
  | "Trust / Authority"
  | "Promotion / Engagement";

export const CONTENT_TYPE_OPTIONS = [
  "Google Business Profile Post",
  "Facebook Post",
  "Instagram Caption",
  "LinkedIn Post",
  "Blog Intro",
  "Email Campaign",
  "Promotion",
  "Seasonal Post",
  "Educational Post",
  "Announcement",
  "Community Post",
] as const;

export type ContentTypeOption = (typeof CONTENT_TYPE_OPTIONS)[number];

export type ContentGenerationRequest = {
  contentType: string;
  topic?: string;
  targetArea?: string;
  length: ContentLength;
  tone: ContentTone;
  goals?: string[];
  specialOffer?: string;
  instructions?: string;
};

export type GeneratedContentVariation = {
  style: VariationStyle;
  title: string;
  content: string;
  cta: string;
  hashtags: string[];
  seoKeywords: string[];
  qualityScore: number;
  voiceScore: number;
  reasoning: string;
};

export type ContentGenerationResult = {
  variations: GeneratedContentVariation[];
};

export type ContentGenerationContext = {
  businessProfile: BusinessProfile;
  aiMarketingProfile: AiMarketingProfile | null;
  websiteAnalysis: WebsiteAnalysis | null;
  marketContextSummary: MarketContextPromptSummary | null;
};

export interface ContentGenerator {
  generate(
    context: ContentGenerationContext,
    request: ContentGenerationRequest
  ): Promise<ContentGenerationResult>;
}

export type ContentGenerationBusinessIntel = {
  businessName: string;
  industry: string;
  services: string[];
  serviceAreas: string[];
  idealCustomer: string;
  targetAudience: string;
  brandPersonality: string[];
  writingTone: string;
  brandVoice: string;
  valueProposition: string;
  keywords: string[];
  preferredCtas: string[];
  commonObjections: string[];
  seoStrategy: string;
  contentStrategy: string;
  reviewStrategy: string;
  websiteSummary: string;
  contentOpportunities: string[];
  customerPersona: string;
  googleBusinessStrategy: string;
  avoidWords: string[];
  marketingGoals: string[];
};

export type MarketingPlanItemType =
  | "calendar"
  | "campaign"
  | "blog"
  | "email"
  | "video"
  | "social";

export type MarketingPlanContentRequest = {
  planItemType: MarketingPlanItemType;
  planItemTitle: string;
  planItemDescription: string;
  recommendedChannel?: string;
  scheduledDate?: string;
  marketingPlanSummary?: string;
  marketingThemes?: string[];
};

export type GeneratedContentDraft = {
  title: string;
  content: string;
  cta: string;
  hashtags: string[];
  seoKeywords: string[];
  qualityScore: number;
  voiceScore: number;
  reasoning: string;
};

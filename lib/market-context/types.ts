import type { AiMarketingProfile } from "@/lib/ai-marketing-profile/types";
import type { BusinessProfile } from "@/lib/business-profile";

export const MARKET_CONTEXT_CATEGORIES = [
  "weather",
  "holiday",
  "local_event",
  "school_calendar",
  "competitor",
  "news",
  "trend",
] as const;

export type MarketContextCategory = (typeof MARKET_CONTEXT_CATEGORIES)[number];

export type MarketContextBriefStatus = "generating" | "active" | "failed";

export type MarketContextItemInput = {
  category: MarketContextCategory;
  title: string;
  summary: string;
  sourceName?: string | null;
  sourceUrl?: string | null;
  relevanceScore?: number;
  confidenceScore?: number;
  contextDate: string;
  expiresAt?: string | null;
  metadata?: Record<string, unknown>;
};

export type ScoredMarketContextItem = MarketContextItemInput & {
  relevanceScore: number;
  confidenceScore: number;
  scoreBreakdown: MarketContextScoreBreakdown;
};

export type MarketContextScoreBreakdown = {
  industryRelevance: number;
  localRelevance: number;
  timeliness: number;
  confidence: number;
  categoryPriority: number;
  composite: number;
};

export type MarketContextItem = {
  id: string;
  user_id: string;
  business_profile_id: string;
  category: MarketContextCategory;
  title: string;
  summary: string;
  source_name: string | null;
  source_url: string | null;
  relevance_score: number;
  confidence_score: number;
  context_date: string;
  expires_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type MarketContextBrief = {
  id: string;
  user_id: string;
  business_profile_id: string;
  brief_start_date: string;
  brief_end_date: string;
  overall_summary: string;
  recommended_topics: string[];
  high_opportunity_keywords: string[];
  content_angles: string[];
  selected_context_item_ids: string[];
  status: MarketContextBriefStatus;
  created_at: string;
  updated_at: string;
};

export type MarketContextBriefWithItems = {
  brief: MarketContextBrief;
  items: MarketContextItem[];
};

export type MarketContextPageData = {
  briefWithItems: MarketContextBriefWithItems | null;
  weekLabel: string;
};

export type MarketContextProviderContext = {
  businessProfile: BusinessProfile;
  aiMarketingProfile: AiMarketingProfile | null;
  referenceDate: Date;
};

export type MarketContextBusinessContext = {
  businessProfile: BusinessProfile;
  aiMarketingProfile: AiMarketingProfile | null;
  industry: string;
  city: string;
  state: string;
  serviceAreas: string[];
  services: string[];
  competitors: string[];
};

export type MarketContextPromptSummary = {
  weekLabel: string;
  overallSummary: string;
  recommendedTopics: string[];
  highOpportunityKeywords: string[];
  contentAngles: string[];
  topSignals: Array<{
    category: MarketContextCategory;
    title: string;
    summary: string;
    relevanceScore: number;
  }>;
  localEventSignals: Array<{
    title: string;
    summary: string;
    sourceName: string | null;
    sourceUrl: string | null;
    relevanceScore: number;
  }>;
  competitorSignals: Array<{
    title: string;
    summary: string;
    sourceName: string | null;
    sourceUrl: string | null;
    relevanceScore: number;
    isProfileBased: boolean;
  }>;
};

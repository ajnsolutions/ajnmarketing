export type AiMarketingProfileStatus = "pending" | "generating" | "active" | "failed";

export type AiMarketingProfileFaq = {
  question: string;
  answer: string;
};

export type AiMarketingProfileTheme = {
  month: string;
  theme: string;
  focus: string;
};

export type AiMarketingProfileCampaign = {
  title: string;
  description: string;
};

export type AiMarketingProfileGenerated = {
  business_summary: string;
  target_audience: string;
  ideal_customer: string;
  services: string[];
  service_areas: string[];
  industry: string;
  brand_voice: string;
  tone: string;
  value_proposition: string;
  keywords: string[];
  competitors: string[];
  faqs: AiMarketingProfileFaq[];
  seasonal_opportunities: string[];
  recommended_ctas: string[];
  common_objections: string[];
  brand_personality: string[];
  writing_examples: string[];
  marketing_strategy: string;
  seo_strategy: string;
  content_strategy: string;
  review_strategy: string;
  google_business_strategy: string;
  monthly_themes: AiMarketingProfileTheme[];
  quarterly_campaigns: AiMarketingProfileCampaign[];
};

export type AiMarketingProfile = {
  id: string;
  user_id: string;
  business_profile_id: string;
  website_analysis_id: string | null;
  profile_status: AiMarketingProfileStatus;
  business_summary: string | null;
  target_audience: string | null;
  ideal_customer: string | null;
  services: string[] | null;
  service_areas: string[] | null;
  industry: string | null;
  brand_voice: string | null;
  tone: string | null;
  value_proposition: string | null;
  keywords: string[] | null;
  competitors: string[] | null;
  faqs: AiMarketingProfileFaq[] | null;
  seasonal_opportunities: string[] | null;
  recommended_ctas: string[] | null;
  common_objections: string[] | null;
  brand_personality: string[] | null;
  writing_examples: string[] | null;
  marketing_strategy: string | null;
  seo_strategy: string | null;
  content_strategy: string | null;
  review_strategy: string | null;
  google_business_strategy: string | null;
  monthly_themes: AiMarketingProfileTheme[] | null;
  quarterly_campaigns: AiMarketingProfileCampaign[] | null;
  /** Structured details from the most recent failed generation attempt, if any. Never used to render fake profile content. */
  last_error: AiMarketingProfileFailureRecord | null;
  last_error_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AiMarketingProfileFailureRecord = {
  provider: string;
  model?: string;
  status?: number;
  code?: string | null;
  type?: string | null;
  requestId?: string | null;
  message: string;
};

export type AiMarketingProfileSourceData = {
  businessProfile: {
    id: string;
    user_id: string;
    business_name: string | null;
    industry: string | null;
    website: string | null;
    city: string | null;
    state: string | null;
    primary_service_area: string | null;
    nearby_cities: string | null;
    primary_services: string | null;
    emergency_services: string | null;
    seasonal_services: string | null;
    specialty_services: string | null;
    competitors: string | null;
    marketing_goals: string[] | null;
    brand_voice_tone: string | null;
    preferred_words: string | null;
    avoid_words: string | null;
    voice_notes: string | null;
  };
  websiteAnalysis: {
    id: string | null;
    analysis_status: string | null;
    brand_voice: string | null;
    tone: string | null;
    keywords: string[] | null;
    services: Array<{ name: string }> | null;
    cities: string[] | null;
    raw_summary: {
      businessName?: string;
      industry?: string;
      primaryServices?: string[];
      secondaryServices?: string[];
      serviceAreas?: string[];
      citiesMentioned?: string[];
      callsToAction?: string[];
      keywords?: string[];
      brandVoice?: string;
      tone?: string;
      customerPersona?: string;
      valueProposition?: string;
      executiveSummary?: string;
      contentOpportunities?: Array<{ title: string }>;
      highestRoiImprovements?: string[];
      strengths?: string[];
      weaknesses?: string[];
      seoIssues?: string[];
    } | null;
  } | null;
};

export interface AiMarketingProfileGenerator {
  generate(input: AiMarketingProfileSourceData): Promise<AiMarketingProfileGenerated>;
}

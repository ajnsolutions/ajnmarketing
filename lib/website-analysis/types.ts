export type WebsiteAnalysisStatus = "pending" | "running" | "completed" | "failed";

export type SeoFinding = {
  label: string;
  status: "good" | "warning" | "poor";
  detail: string;
};

export type DetectedService = {
  name: string;
  confidence: number;
  opportunity: "High" | "Medium" | "Low";
};

export type ContentOpportunity = {
  title: string;
  seoScore: number;
  competition: "Low" | "Medium" | "High";
};

export type WebsiteExtractionResult = {
  businessName: string;
  industry: string;
  primaryServices: string[];
  secondaryServices: string[];
  serviceAreas: string[];
  citiesMentioned: string[];
  phoneNumbers: string[];
  emailAddresses: string[];
  businessHours: string[];
  callsToAction: string[];
  keywords: string[];
  brandVoice: string;
  readingLevel: string;
  tone: string;
  customerPersona: string;
  valueProposition: string;
  metaTitle: string | null;
  metaDescription: string | null;
  h1Headings: string[];
  seoIssues: string[];
  internalLinks: number;
  pageCountEstimate: number;
  strengths: string[];
  weaknesses: string[];
  highestRoiImprovements: string[];
  nextRecommendedActions: string;
  executiveSummary: string;
  contentOpportunities: ContentOpportunity[];
};

export type WebsiteAnalysis = {
  id: string;
  user_id: string;
  business_profile_id: string;
  website: string;
  analysis_status: WebsiteAnalysisStatus;
  analysis_score: number | null;
  brand_voice: string | null;
  tone: string | null;
  keywords: string[] | null;
  services: DetectedService[] | null;
  cities: string[] | null;
  seo_score: number | null;
  seo_findings: SeoFinding[] | null;
  raw_summary: WebsiteExtractionResult | null;
  created_at: string;
  updated_at: string;
};

export type FetchedWebsite = {
  url: string;
  finalUrl: string;
  html: string;
  textContent: string;
  fetchedAt: string;
};

export interface WebsiteExtractor {
  extract(input: {
    website: FetchedWebsite;
    profile: {
      business_name: string | null;
      industry: string | null;
      website: string | null;
      phone: string | null;
      city: string | null;
      state: string | null;
      primary_service_area: string | null;
      nearby_cities: string | null;
      primary_services: string | null;
      emergency_services: string | null;
      seasonal_services: string | null;
      specialty_services: string | null;
      brand_voice_tone: string | null;
      preferred_words: string | null;
      avoid_words: string | null;
      voice_notes: string | null;
    };
  }): Promise<WebsiteExtractionResult>;
}

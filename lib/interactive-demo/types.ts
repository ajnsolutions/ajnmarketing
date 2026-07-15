import type { WebsiteExtractionResult } from "@/lib/website-analysis/types";
import type { AiMarketingProfileGenerated } from "@/lib/ai-marketing-profile/types";
import type { RecommendedActionType } from "@/lib/marketing-decisions/types";

export type InteractiveDemoInput = {
  websiteUrl: string;
  businessName?: string;
  industry?: string;
  city?: string;
  state?: string;
};

export type DemoWebsiteSnapshot = {
  kind: "live_findings";
  businessSummary: string;
  businessName: string;
  industry: string;
  strengths: string[];
  improvementOpportunities: string[];
  services: string[];
  serviceAreas: string[];
  sourceUrl: string;
};

export type DemoMarketingSnapshot = {
  kind: "generated_profile";
  brandPersonality: string[];
  targetAudience: string;
  messaging: string;
  competitivePositioning: string;
  brandVoice: string;
  valueProposition: string;
};

export type DemoRecommendationCard = {
  kind: "recommendation";
  title: string;
  why: string[];
  expectedBenefit: string;
  exampleAction: string;
  explanation: string;
  actionType: RecommendedActionType;
};

export type DemoContentExample = {
  kind: "example_content";
  label: string;
  channel: string;
  title: string;
  body: string;
  cta?: string;
};

export type InteractiveDemoResult = {
  websiteSnapshot: DemoWebsiteSnapshot;
  marketingSnapshot: DemoMarketingSnapshot;
  recommendations: DemoRecommendationCard[];
  contentExamples: DemoContentExample[];
  weeklyWorkflow: string[];
  meta: {
    cached: boolean;
    durationMs: number;
    inferredBusinessName: string;
    inferredIndustry: string;
    inferredCity: string | null;
  };
};

export type InteractiveDemoFunnelEvent =
  | "demo_started"
  | "demo_completed"
  | "cta_clicked";

/** Internal pipeline intermediates (not always returned to client). */
export type DemoPipelineContext = {
  input: InteractiveDemoInput;
  extraction: WebsiteExtractionResult;
  profile: AiMarketingProfileGenerated;
  sourceUrl: string;
};

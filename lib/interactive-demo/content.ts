import type { AiMarketingProfile } from "@/lib/ai-marketing-profile/types";
import type { AiMarketingProfileGenerated } from "@/lib/ai-marketing-profile/types";
import { createContentGenerator } from "@/lib/content-generator/generator";
import type {
  ContentGenerationContext,
  ContentTypeOption,
} from "@/lib/content-generator/types";
import type { DemoContentExample, InteractiveDemoInput } from "@/lib/interactive-demo/types";
import {
  DEMO_EPHEMERAL_PROFILE_ID,
  DEMO_EPHEMERAL_USER_ID,
  buildEphemeralBusinessProfile,
} from "@/lib/interactive-demo/stubs";
import type { WebsiteAnalysis, WebsiteExtractionResult } from "@/lib/website-analysis/types";

function toEphemeralAiProfile(
  generated: AiMarketingProfileGenerated,
): AiMarketingProfile {
  const now = new Date().toISOString();
  return {
    id: "00000000-0000-4000-8000-0000000000e0",
    user_id: DEMO_EPHEMERAL_USER_ID,
    business_profile_id: DEMO_EPHEMERAL_PROFILE_ID,
    website_analysis_id: null,
    profile_status: "active",
    business_summary: generated.business_summary,
    target_audience: generated.target_audience,
    ideal_customer: generated.ideal_customer,
    services: generated.services,
    service_areas: generated.service_areas,
    industry: generated.industry,
    brand_voice: generated.brand_voice,
    tone: generated.tone,
    value_proposition: generated.value_proposition,
    keywords: generated.keywords,
    competitors: generated.competitors,
    faqs: generated.faqs,
    seasonal_opportunities: generated.seasonal_opportunities,
    recommended_ctas: generated.recommended_ctas,
    common_objections: generated.common_objections,
    brand_personality: generated.brand_personality,
    writing_examples: generated.writing_examples,
    marketing_strategy: generated.marketing_strategy,
    seo_strategy: generated.seo_strategy,
    content_strategy: generated.content_strategy,
    review_strategy: generated.review_strategy,
    google_business_strategy: generated.google_business_strategy,
    monthly_themes: generated.monthly_themes,
    quarterly_campaigns: generated.quarterly_campaigns,
    last_error: null,
    last_error_at: null,
    created_at: now,
    updated_at: now,
  };
}

function toEphemeralWebsiteAnalysis(
  extraction: WebsiteExtractionResult,
  sourceUrl: string,
): WebsiteAnalysis {
  const now = new Date().toISOString();
  return {
    id: "00000000-0000-4000-8000-0000000000e1",
    user_id: DEMO_EPHEMERAL_USER_ID,
    business_profile_id: DEMO_EPHEMERAL_PROFILE_ID,
    website: sourceUrl,
    analysis_status: "completed",
    analysis_score: null,
    brand_voice: extraction.brandVoice,
    tone: extraction.tone,
    keywords: extraction.keywords,
    services: extraction.primaryServices.map((name) => ({
      name,
      confidence: 0.8,
      opportunity: "Medium",
    })),
    cities: extraction.citiesMentioned,
    seo_score: null,
    seo_findings: null,
    raw_summary: extraction,
    created_at: now,
    updated_at: now,
  };
}

async function generateOneExample(options: {
  context: ContentGenerationContext;
  contentType: ContentTypeOption | string;
  label: string;
  channel: string;
  topic?: string;
  instructions?: string;
}): Promise<DemoContentExample | null> {
  try {
    const generator = createContentGenerator();
    const result = await generator.generate(options.context, {
      contentType: options.contentType,
      topic: options.topic,
      length: "Medium",
      tone: "Friendly",
      instructions: options.instructions,
    });
    const best = result.variations[0];
    if (!best) return null;
    return {
      kind: "example_content",
      label: options.label,
      channel: options.channel,
      title: best.title,
      body: best.content,
      cta: best.cta,
    };
  } catch {
    return null;
  }
}

export async function generateDemoContentExamples(options: {
  input: InteractiveDemoInput;
  extraction: WebsiteExtractionResult;
  profile: AiMarketingProfileGenerated;
  sourceUrl: string;
}): Promise<DemoContentExample[]> {
  const businessProfile = buildEphemeralBusinessProfile(
    options.input,
    options.extraction,
  );
  const context: ContentGenerationContext = {
    businessProfile,
    aiMarketingProfile: toEphemeralAiProfile(options.profile),
    websiteAnalysis: toEphemeralWebsiteAnalysis(
      options.extraction,
      options.sourceUrl,
    ),
    marketContextSummary: null,
    analyticsFeedback: null,
  };

  const service =
    options.extraction.primaryServices[0] ||
    options.profile.services[0] ||
    options.profile.industry ||
    "your services";
  const area =
    options.input.city ||
    options.extraction.serviceAreas[0] ||
    options.extraction.citiesMentioned[0] ||
    "your area";

  const examples = await Promise.all([
    generateOneExample({
      context,
      contentType: "Google Business Profile Post",
      label: "Example Google Business post",
      channel: "Google Business Profile",
      topic: `${service} for customers in ${area}`,
    }),
    generateOneExample({
      context,
      contentType: "Facebook Post",
      label: "Example Facebook post",
      channel: "Facebook",
      topic: `Helpful tip about ${service} for local homeowners`,
    }),
    generateOneExample({
      context,
      contentType: "Blog Intro",
      label: "Example blog introduction",
      channel: "Website / Blog",
      topic: `How to choose the right ${service} provider in ${area}`,
    }),
    generateOneExample({
      context,
      contentType: "Educational Post",
      label: "Example review reply",
      channel: "Reviews",
      topic: "Reply to a positive customer review",
      instructions:
        "Write a short, warm reply to a 5-star customer review. Thank the customer, mention the service briefly, and invite them back. Do not invent a fake customer name if none is provided — use a generic greeting.",
    }),
  ]);

  return examples.filter((example): example is DemoContentExample => Boolean(example));
}

export const WEEKLY_WORKFLOW_STEPS = [
  "Reviews your business signals and Google presence",
  "Finds the best opportunities for this week",
  "Creates marketing drafts tailored to your business",
  "Sends one approval email (or dashboard review)",
  "Publishes only what you approve",
  "Learns what works and improves next week’s recommendations",
] as const;

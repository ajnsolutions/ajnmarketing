import {
  createAiMarketingProfileGenerator,
  PlaceholderAiMarketingProfileGenerator,
} from "@/lib/ai-marketing-profile/generator";
import { isOpenAiMarketingProfileConfigured } from "@/lib/ai-marketing-profile/openai-generator";
import type { AiMarketingProfileGenerated } from "@/lib/ai-marketing-profile/types";
import type { InteractiveDemoInput } from "@/lib/interactive-demo/types";
import {
  DEMO_EPHEMERAL_PROFILE_ID,
  DEMO_EPHEMERAL_USER_ID,
} from "@/lib/interactive-demo/stubs";
import type { WebsiteExtractionResult } from "@/lib/website-analysis/types";

export async function generateDemoMarketingProfile(options: {
  input: InteractiveDemoInput;
  extraction: WebsiteExtractionResult;
  sourceUrl: string;
}): Promise<AiMarketingProfileGenerated> {
  const { input, extraction, sourceUrl } = options;
  const generator = isOpenAiMarketingProfileConfigured()
    ? createAiMarketingProfileGenerator()
    : new PlaceholderAiMarketingProfileGenerator();

  return generator.generate({
    businessProfile: {
      id: DEMO_EPHEMERAL_PROFILE_ID,
      user_id: DEMO_EPHEMERAL_USER_ID,
      business_name: input.businessName?.trim() || extraction.businessName || null,
      industry: input.industry?.trim() || extraction.industry || null,
      website: sourceUrl,
      city: input.city?.trim() || extraction.citiesMentioned[0] || null,
      state: input.state?.trim() || null,
      primary_service_area:
        input.city?.trim() || extraction.serviceAreas[0] || null,
      nearby_cities: extraction.citiesMentioned.slice(0, 5).join(", ") || null,
      primary_services: extraction.primaryServices.join(", ") || null,
      emergency_services: null,
      seasonal_services: null,
      specialty_services: extraction.secondaryServices.join(", ") || null,
      competitors: null,
      marketing_goals: ["local_visibility", "reviews", "consistent_content"],
      brand_voice_tone: extraction.tone || extraction.brandVoice || null,
      preferred_words: null,
      avoid_words: null,
      voice_notes: null,
    },
    websiteAnalysis: {
      id: null,
      analysis_status: "completed",
      brand_voice: extraction.brandVoice,
      tone: extraction.tone,
      keywords: extraction.keywords,
      services: extraction.primaryServices.map((name) => ({ name })),
      cities: extraction.citiesMentioned,
      raw_summary: extraction,
    },
  });
}

export function buildMarketingSnapshot(profile: AiMarketingProfileGenerated) {
  return {
    kind: "generated_profile" as const,
    brandPersonality: (profile.brand_personality ?? []).slice(0, 5),
    targetAudience: profile.target_audience || profile.ideal_customer || "",
    messaging: profile.value_proposition || profile.business_summary || "",
    competitivePositioning:
      profile.marketing_strategy ||
      profile.google_business_strategy ||
      profile.content_strategy ||
      "",
    brandVoice: profile.brand_voice || profile.tone || "",
    valueProposition: profile.value_proposition || "",
  };
}

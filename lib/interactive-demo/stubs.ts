import type { BusinessProfile } from "@/lib/business-profile";
import type { InteractiveDemoInput } from "@/lib/interactive-demo/types";
import type { WebsiteExtractionResult } from "@/lib/website-analysis/types";

export const DEMO_EPHEMERAL_USER_ID = "00000000-0000-4000-8000-0000000000de";
export const DEMO_EPHEMERAL_PROFILE_ID = "00000000-0000-4000-8000-0000000000df";

export function emptyExtractorProfile(input: InteractiveDemoInput) {
  return {
    business_name: input.businessName?.trim() || null,
    industry: input.industry?.trim() || null,
    website: input.websiteUrl.trim() || null,
    phone: null,
    city: input.city?.trim() || null,
    state: input.state?.trim() || null,
    primary_service_area: input.city?.trim() || null,
    nearby_cities: null,
    primary_services: null,
    emergency_services: null,
    seasonal_services: null,
    specialty_services: null,
    brand_voice_tone: null,
    preferred_words: null,
    avoid_words: null,
    voice_notes: null,
  };
}

export function buildEphemeralBusinessProfile(
  input: InteractiveDemoInput,
  extraction: WebsiteExtractionResult,
): BusinessProfile {
  const now = new Date().toISOString();
  return {
    id: DEMO_EPHEMERAL_PROFILE_ID,
    user_id: DEMO_EPHEMERAL_USER_ID,
    business_name:
      input.businessName?.trim() || extraction.businessName || null,
    industry: input.industry?.trim() || extraction.industry || null,
    website: input.websiteUrl.trim() || null,
    phone: extraction.phoneNumbers[0] ?? null,
    city: input.city?.trim() || extraction.citiesMentioned[0] || null,
    state: input.state?.trim() || null,
    primary_service_area:
      input.city?.trim() ||
      extraction.serviceAreas[0] ||
      extraction.citiesMentioned[0] ||
      null,
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
    onboarding_completed: false,
    created_at: now,
    updated_at: now,
  };
}

import type { BusinessProfile } from "@/lib/business-profile";
import { createAiMarketingProfileGenerator } from "@/lib/ai-marketing-profile/generator";
import {
  getAiMarketingProfileForUser,
  markAiMarketingProfileFailed,
  saveAiMarketingProfileResult,
  upsertAiMarketingProfileStatus,
} from "@/lib/ai-marketing-profile/persistence";
import type { AiMarketingProfile, AiMarketingProfileSourceData } from "@/lib/ai-marketing-profile/types";
import { getWebsiteAnalysisForUser } from "@/lib/website-analysis/persistence";
import type { WebsiteAnalysis } from "@/lib/website-analysis/types";
import { createClient } from "@/lib/supabase/server";

function buildSourceData(
  profile: BusinessProfile,
  analysis: WebsiteAnalysis | null
): AiMarketingProfileSourceData {
  return {
    businessProfile: {
      id: profile.id,
      user_id: profile.user_id,
      business_name: profile.business_name,
      industry: profile.industry,
      website: profile.website,
      city: profile.city,
      state: profile.state,
      primary_service_area: profile.primary_service_area,
      nearby_cities: profile.nearby_cities,
      primary_services: profile.primary_services,
      emergency_services: profile.emergency_services,
      seasonal_services: profile.seasonal_services,
      specialty_services: profile.specialty_services,
      competitors: profile.competitors,
      marketing_goals: profile.marketing_goals,
      brand_voice_tone: profile.brand_voice_tone,
      preferred_words: profile.preferred_words,
      avoid_words: profile.avoid_words,
      voice_notes: profile.voice_notes,
    },
    websiteAnalysis: analysis
      ? {
          id: analysis.id,
          analysis_status: analysis.analysis_status,
          brand_voice: analysis.brand_voice,
          tone: analysis.tone,
          keywords: analysis.keywords,
          services: analysis.services,
          cities: analysis.cities,
          raw_summary: analysis.raw_summary,
        }
      : null,
  };
}

export async function getAiMarketingProfileForCurrentUser(): Promise<AiMarketingProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;
  return getAiMarketingProfileForUser(supabase, user.id);
}

export async function generateAiMarketingProfileForUser(userId: string): Promise<AiMarketingProfile | null> {
  const supabase = await createClient();

  const { data: profile, error: profileError } = await supabase
    .from("business_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileError || !profile) {
    return null;
  }

  const typedProfile = profile as BusinessProfile;
  const analysis = await getWebsiteAnalysisForUser(supabase, userId);

  await upsertAiMarketingProfileStatus(supabase, {
    userId,
    businessProfileId: typedProfile.id,
    websiteAnalysisId: analysis?.id ?? null,
    status: "generating",
  });

  try {
    const generator = createAiMarketingProfileGenerator();
    const generated = await generator.generate(buildSourceData(typedProfile, analysis));

    return saveAiMarketingProfileResult(supabase, {
      userId,
      businessProfileId: typedProfile.id,
      websiteAnalysisId: analysis?.id ?? null,
      generated,
    });
  } catch {
    await markAiMarketingProfileFailed(
      supabase,
      userId,
      typedProfile.id,
      analysis?.id ?? null
    );
    return null;
  }
}

import type { BusinessProfile } from "@/lib/business-profile";
import { createAiMarketingProfileGenerator } from "@/lib/ai-marketing-profile/generator";
import { AiMarketingProfileGenerationError } from "@/lib/ai-marketing-profile/errors";
import {
  getAiMarketingProfileForUser,
  markAiMarketingProfileFailed,
  saveAiMarketingProfileResult,
  upsertAiMarketingProfileStatus,
} from "@/lib/ai-marketing-profile/persistence";
import type {
  AiMarketingProfile,
  AiMarketingProfileFailureRecord,
  AiMarketingProfileSourceData,
} from "@/lib/ai-marketing-profile/types";
import { getWebsiteAnalysisForUser } from "@/lib/website-analysis/persistence";
import type { WebsiteAnalysis } from "@/lib/website-analysis/types";
import { AuditActions, auditErrorMetadata, logAuditEvent } from "@/lib/audit-log-server";
import { sanitizeUserErrorMessage } from "@/lib/security/safe-error-message";
import { createClient } from "@/lib/supabase/server";

const GENERATION_FAILURE_FALLBACK_MESSAGE =
  "AI marketing profile generation failed. Please try again.";

function buildFailureRecord(error: unknown): AiMarketingProfileFailureRecord {
  if (error instanceof AiMarketingProfileGenerationError) {
    return {
      ...error.details,
      message: sanitizeUserErrorMessage(error.details.message, GENERATION_FAILURE_FALLBACK_MESSAGE),
    };
  }

  return {
    provider: "unknown",
    message: sanitizeUserErrorMessage(
      error instanceof Error ? error.message : String(error),
      GENERATION_FAILURE_FALLBACK_MESSAGE
    ),
  };
}

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

export type GenerateAiMarketingProfileResult = {
  profile: AiMarketingProfile | null;
  error?: string;
};

export async function generateAiMarketingProfileForUser(
  userId: string
): Promise<GenerateAiMarketingProfileResult> {
  const supabase = await createClient();

  const { data: profile, error: profileError } = await supabase
    .from("business_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileError || !profile) {
    return { profile: null, error: "Business profile not found." };
  }

  const typedProfile = profile as BusinessProfile;
  const analysis = await getWebsiteAnalysisForUser(supabase, userId);

  await upsertAiMarketingProfileStatus(supabase, {
    userId,
    businessProfileId: typedProfile.id,
    websiteAnalysisId: analysis?.id ?? null,
    status: "generating",
  });

  await logAuditEvent(supabase, {
    userId,
    businessProfileId: typedProfile.id,
    action: AuditActions.AI_MARKETING_PROFILE_GENERATION_STARTED,
    entityType: "ai_marketing_profile",
    status: "started",
  });

  try {
    const generator = createAiMarketingProfileGenerator();
    const generated = await generator.generate(buildSourceData(typedProfile, analysis));

    const result = await saveAiMarketingProfileResult(supabase, {
      userId,
      businessProfileId: typedProfile.id,
      websiteAnalysisId: analysis?.id ?? null,
      generated,
    });

    await logAuditEvent(supabase, {
      userId,
      businessProfileId: typedProfile.id,
      action: AuditActions.AI_MARKETING_PROFILE_GENERATION_COMPLETED,
      entityType: "ai_marketing_profile",
      entityId: result?.id ?? null,
      status: "success",
    });

    return { profile: result };
  } catch (error) {
    // Never save the generator's output here — on any failure (OpenAI error, malformed
    // response, missing config), the profile stays at its last-known-good state with
    // profile_status "failed" and structured failure details for troubleshooting/retry.
    const failure = buildFailureRecord(error);

    console.error("[AiMarketingProfile] Generation failed:", failure);

    await markAiMarketingProfileFailed(
      supabase,
      userId,
      typedProfile.id,
      analysis?.id ?? null,
      failure
    );

    await logAuditEvent(supabase, {
      userId,
      businessProfileId: typedProfile.id,
      action: AuditActions.AI_MARKETING_PROFILE_GENERATION_FAILED,
      entityType: "ai_marketing_profile",
      status: "failure",
      metadata: {
        ...failure,
        ...auditErrorMetadata(error, GENERATION_FAILURE_FALLBACK_MESSAGE),
      },
    });

    return { profile: null, error: failure.message };
  }
}

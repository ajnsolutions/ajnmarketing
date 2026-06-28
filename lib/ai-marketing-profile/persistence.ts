import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AiMarketingProfile,
  AiMarketingProfileGenerated,
  AiMarketingProfileStatus,
} from "@/lib/ai-marketing-profile/types";

export function formatProfileStatus(status: AiMarketingProfileStatus | null | undefined): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "generating":
      return "Generating";
    case "active":
      return "Active";
    case "failed":
      return "Failed";
    default:
      return "Not created";
  }
}

export function formatRelativeTime(isoDate: string | null | undefined): string {
  if (!isoDate) return "Not yet updated";

  const diffMs = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export async function getAiMarketingProfileForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<AiMarketingProfile | null> {
  const { data, error } = await supabase
    .from("ai_marketing_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return data as AiMarketingProfile;
}

export async function upsertAiMarketingProfileStatus(
  supabase: SupabaseClient,
  input: {
    userId: string;
    businessProfileId: string;
    websiteAnalysisId: string | null;
    status: AiMarketingProfileStatus;
  }
): Promise<AiMarketingProfile | null> {
  const { data, error } = await supabase
    .from("ai_marketing_profiles")
    .upsert(
      {
        user_id: input.userId,
        business_profile_id: input.businessProfileId,
        website_analysis_id: input.websiteAnalysisId,
        profile_status: input.status,
      },
      { onConflict: "user_id" }
    )
    .select("*")
    .single();

  if (error) return null;
  return data as AiMarketingProfile;
}

export async function saveAiMarketingProfileResult(
  supabase: SupabaseClient,
  input: {
    userId: string;
    businessProfileId: string;
    websiteAnalysisId: string | null;
    generated: AiMarketingProfileGenerated;
  }
): Promise<AiMarketingProfile | null> {
  const { data, error } = await supabase
    .from("ai_marketing_profiles")
    .upsert(
      {
        user_id: input.userId,
        business_profile_id: input.businessProfileId,
        website_analysis_id: input.websiteAnalysisId,
        profile_status: "active",
        business_summary: input.generated.business_summary,
        target_audience: input.generated.target_audience,
        ideal_customer: input.generated.ideal_customer,
        services: input.generated.services,
        service_areas: input.generated.service_areas,
        industry: input.generated.industry,
        brand_voice: input.generated.brand_voice,
        tone: input.generated.tone,
        value_proposition: input.generated.value_proposition,
        keywords: input.generated.keywords,
        competitors: input.generated.competitors,
        faqs: input.generated.faqs,
        seasonal_opportunities: input.generated.seasonal_opportunities,
        recommended_ctas: input.generated.recommended_ctas,
        common_objections: input.generated.common_objections,
        brand_personality: input.generated.brand_personality,
        writing_examples: input.generated.writing_examples,
        marketing_strategy: input.generated.marketing_strategy,
        seo_strategy: input.generated.seo_strategy,
        content_strategy: input.generated.content_strategy,
        review_strategy: input.generated.review_strategy,
        google_business_strategy: input.generated.google_business_strategy,
        monthly_themes: input.generated.monthly_themes,
        quarterly_campaigns: input.generated.quarterly_campaigns,
      },
      { onConflict: "user_id" }
    )
    .select("*")
    .single();

  if (error) return null;
  return data as AiMarketingProfile;
}

export async function markAiMarketingProfileFailed(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
  websiteAnalysisId: string | null
) {
  await supabase.from("ai_marketing_profiles").upsert(
    {
      user_id: userId,
      business_profile_id: businessProfileId,
      website_analysis_id: websiteAnalysisId,
      profile_status: "failed",
    },
    { onConflict: "user_id" }
  );
}

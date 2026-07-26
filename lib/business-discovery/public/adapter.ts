/**
 * Public-safe adapter — the explicit boundary between visitor-supplied /
 * publicly-fetched data and the pure Business Discovery collectors from
 * PR #73 (lib/business-discovery/collectors.ts).
 *
 * This is the mechanism, not a boolean flag: it constructs ephemeral,
 * never-persisted BusinessProfile / WebsiteAnalysis / AiMarketingProfile
 * *shaped* objects from public-path data only, mirroring the established
 * pattern in lib/interactive-demo/stubs.ts (buildEphemeralBusinessProfile)
 * and lib/interactive-demo/content.ts (toEphemeralAiProfile) — reused
 * conventions, not a new one. Only these three collectors are ever called
 * for the public path:
 *
 *   collectBusinessProfileObservations   (visitor-supplied fields)
 *   collectWebsiteAnalysisObservations   (public website fetch + extraction)
 *   collectAiMarketingProfileObservations (AI synthesis over the above)
 *
 * collectGoogleBusinessProfileObservations, collectPublicReviewObservations,
 * and collectMarketContextObservations are never imported here — there is no
 * authenticated user, no connected Google Business Profile, no review table
 * row, and no Market Context brief to read for an anonymous visitor.
 */

import type { BusinessProfile } from "@/lib/business-profile";
import type { AiMarketingProfile, AiMarketingProfileGenerated } from "@/lib/ai-marketing-profile/types";
import type { WebsiteAnalysis, WebsiteExtractionResult } from "@/lib/website-analysis/types";
import type { PublicSnapshotRequestV1 } from "@/lib/business-discovery/public/types";

/** Fixed, non-random, never-persisted identifiers — distinct from the interactive demo's ephemeral IDs so the two anonymous paths are never confused in logs or evidence text. */
export const PUBLIC_SNAPSHOT_EPHEMERAL_USER_ID = "00000000-0000-4000-8000-0000000000f0";
export const PUBLIC_SNAPSHOT_EPHEMERAL_PROFILE_ID = "00000000-0000-4000-8000-0000000000f1";
export const PUBLIC_SNAPSHOT_EPHEMERAL_ANALYSIS_ID = "00000000-0000-4000-8000-0000000000f2";
export const PUBLIC_SNAPSHOT_EPHEMERAL_AI_PROFILE_ID = "00000000-0000-4000-8000-0000000000f3";

export function buildEphemeralPublicBusinessProfile(
  request: PublicSnapshotRequestV1,
  extraction: WebsiteExtractionResult | null,
  websiteUrl: string
): BusinessProfile {
  const now = new Date().toISOString();
  return {
    id: PUBLIC_SNAPSHOT_EPHEMERAL_PROFILE_ID,
    user_id: PUBLIC_SNAPSHOT_EPHEMERAL_USER_ID,
    business_name: request.businessName ?? extraction?.businessName ?? null,
    industry: extraction?.industry ?? null,
    website: websiteUrl,
    phone: null,
    city: request.city ?? extraction?.citiesMentioned[0] ?? null,
    state: request.stateOrRegion ?? null,
    primary_service_area: request.city ?? extraction?.serviceAreas[0] ?? null,
    nearby_cities: null,
    primary_services: null,
    emergency_services: null,
    seasonal_services: null,
    specialty_services: null,
    competitors: null,
    marketing_goals: null,
    brand_voice_tone: null,
    preferred_words: null,
    avoid_words: null,
    voice_notes: null,
    onboarding_completed: false,
    created_at: now,
    updated_at: now,
  };
}

export function buildEphemeralPublicWebsiteAnalysis(
  extraction: WebsiteExtractionResult,
  websiteUrl: string
): WebsiteAnalysis {
  const now = new Date().toISOString();
  return {
    id: PUBLIC_SNAPSHOT_EPHEMERAL_ANALYSIS_ID,
    user_id: PUBLIC_SNAPSHOT_EPHEMERAL_USER_ID,
    business_profile_id: PUBLIC_SNAPSHOT_EPHEMERAL_PROFILE_ID,
    website: websiteUrl,
    analysis_status: "completed",
    analysis_score: null,
    brand_voice: extraction.brandVoice || null,
    tone: extraction.tone || null,
    keywords: extraction.keywords,
    services: [],
    cities: extraction.citiesMentioned,
    seo_score: null,
    seo_findings: null,
    raw_summary: extraction,
    created_at: now,
    updated_at: now,
  };
}

export function buildEphemeralPublicAiMarketingProfile(
  generated: AiMarketingProfileGenerated
): AiMarketingProfile {
  const now = new Date().toISOString();
  return {
    id: PUBLIC_SNAPSHOT_EPHEMERAL_AI_PROFILE_ID,
    user_id: PUBLIC_SNAPSHOT_EPHEMERAL_USER_ID,
    business_profile_id: PUBLIC_SNAPSHOT_EPHEMERAL_PROFILE_ID,
    website_analysis_id: PUBLIC_SNAPSHOT_EPHEMERAL_ANALYSIS_ID,
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

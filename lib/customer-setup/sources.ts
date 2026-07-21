/**
 * Gather CustomerSetupFacts from existing product tables.
 * Never invents completion — adapters only.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getAiMarketingProfileForUser } from "@/lib/ai-marketing-profile/persistence";
import type { BusinessProfile } from "@/lib/business-profile";
import type { CustomerSetupFacts } from "@/lib/customer-setup/types";
import { getGoogleBusinessProfileConnectionStatusForUser } from "@/lib/google-business-profile/service";
import { getLatestMarketingPlanForUser } from "@/lib/marketing-planner/persistence";
import { hasNoWebsiteConfirmed } from "@/lib/onboarding-storage";
import { getWebsiteAnalysisForUser } from "@/lib/website-analysis/persistence";

export async function gatherCustomerSetupFacts(
  supabase: SupabaseClient,
  userId: string,
  profile: BusinessProfile | null,
): Promise<{ facts: CustomerSetupFacts; warnings: string[] }> {
  const warnings: string[] = [];

  if (!profile) {
    return {
      facts: {
        hasBusinessProfile: false,
        businessName: null,
        industry: null,
        city: null,
        state: null,
        websiteUrl: null,
        noWebsiteConfirmed: false,
        marketingGoals: [],
        brandVoiceTone: null,
        preferredWords: null,
        onboardingCompleted: false,
        gbp: {
          setupRequired: false,
          connected: false,
          connectionStatus: null,
          scopesValid: true,
          lastSyncedAt: null,
        },
        websiteAnalysis: { exists: false, status: null, failed: false },
        aiMarketingProfileExists: false,
        marketingPlanExists: false,
        openRecommendationCount: 0,
        pendingApprovalCount: 0,
      },
      warnings,
    };
  }

  const [gbpStatus, websiteAnalysis, aiProfile, marketingPlan] = await Promise.all([
    getGoogleBusinessProfileConnectionStatusForUser(userId, supabase).catch(() => {
      warnings.push("Google connection status could not be refreshed.");
      return null;
    }),
    getWebsiteAnalysisForUser(supabase, userId).catch(() => {
      warnings.push("Website analysis status could not be loaded.");
      return null;
    }),
    getAiMarketingProfileForUser(supabase, userId).catch(() => {
      warnings.push("Marketing profile status could not be loaded.");
      return null;
    }),
    getLatestMarketingPlanForUser(supabase, userId).catch(() => {
      warnings.push("Marketing plan status could not be loaded.");
      return null;
    }),
  ]);

  const connectionStatus = gbpStatus?.connection?.connection_status ?? null;

  return {
    facts: {
      hasBusinessProfile: true,
      businessName: profile.business_name,
      industry: profile.industry,
      city: profile.city,
      state: profile.state,
      websiteUrl: profile.website,
      noWebsiteConfirmed: hasNoWebsiteConfirmed(profile.voice_notes),
      marketingGoals: profile.marketing_goals ?? [],
      brandVoiceTone: profile.brand_voice_tone,
      preferredWords: profile.preferred_words,
      onboardingCompleted: profile.onboarding_completed === true,
      gbp: {
        setupRequired: gbpStatus?.setupRequired ?? false,
        connected: gbpStatus?.connected ?? false,
        connectionStatus,
        scopesValid: gbpStatus?.scopesValid ?? true,
        lastSyncedAt: gbpStatus?.connection?.last_synced_at ?? null,
      },
      websiteAnalysis: {
        exists: Boolean(websiteAnalysis),
        status: websiteAnalysis?.analysis_status ?? null,
        failed: websiteAnalysis?.analysis_status === "failed",
      },
      aiMarketingProfileExists: Boolean(aiProfile),
      marketingPlanExists: Boolean(marketingPlan),
      openRecommendationCount: 0,
      pendingApprovalCount: 0,
    },
    warnings,
  };
}

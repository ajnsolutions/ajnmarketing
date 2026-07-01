import "server-only";

import { getAiMarketingProfileForUser } from "@/lib/ai-marketing-profile/persistence";
import { getBusinessProfileForUser } from "@/lib/business-profile-server";
import { createContentGenerator } from "@/lib/content-generator/generator";
import {
  formatOpenAiContentError,
  OpenAIContentGenerator,
} from "@/lib/content-generator/openai-generator";
import { mapMarketingPlanChannelToContentType } from "@/lib/content-generator/prompt-builder";
import type {
  ContentGenerationContext,
  ContentGenerationRequest,
  ContentGenerationResult,
  GeneratedContentDraft,
  MarketingPlanContentRequest,
} from "@/lib/content-generator/types";
import { getWebsiteAnalysisForUser } from "@/lib/website-analysis/persistence";
import type { BusinessProfile } from "@/lib/business-profile";
import type { AiMarketingProfile } from "@/lib/ai-marketing-profile/types";
import type { WebsiteAnalysis } from "@/lib/website-analysis/types";
import { AuditActions, logAuditEvent } from "@/lib/audit-log-server";
import { getAnalyticsFeedbackForUser } from "@/lib/analytics/analyticsEngine";
import { buildMarketContextPromptSummary } from "@/lib/market-context/prompt-context";
import { getLatestMarketContextBriefForUser } from "@/lib/market-context/marketContextService";
import { createClient } from "@/lib/supabase/server";

async function loadGenerationContext(userId: string): Promise<ContentGenerationContext | null> {
  const supabase = await createClient();

  const { data: profile, error } = await supabase
    .from("business_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !profile) return null;

  const [aiMarketingProfile, websiteAnalysis, marketContextBrief, analyticsFeedback] =
    await Promise.all([
    getAiMarketingProfileForUser(supabase, userId),
    getWebsiteAnalysisForUser(supabase, userId),
    getLatestMarketContextBriefForUser(userId),
    getAnalyticsFeedbackForUser(userId),
  ]);

  return {
    businessProfile: profile as BusinessProfile,
    aiMarketingProfile: aiMarketingProfile as AiMarketingProfile | null,
    websiteAnalysis: websiteAnalysis as WebsiteAnalysis | null,
    marketContextSummary: buildMarketContextPromptSummary(marketContextBrief),
    analyticsFeedback,
  };
}

export async function generateContentForUser(
  userId: string,
  request: ContentGenerationRequest
): Promise<{ result: ContentGenerationResult | null; error?: string }> {
  const supabase = await createClient();
  const context = await loadGenerationContext(userId);

  if (!context) {
    return { result: null, error: "Business profile not found. Complete onboarding first." };
  }

  try {
    const generator = createContentGenerator();
    const result = await generator.generate(context, request);

    await logAuditEvent(supabase, {
      userId,
      businessProfileId: context.businessProfile.id,
      action: AuditActions.CONTENT_GENERATED,
      entityType: "content_generation",
      status: "success",
      metadata: {
        contentType: request.contentType,
        variationCount: result.variations.length,
        tone: request.tone ?? null,
      },
    });

    return { result };
  } catch (error) {
    return { result: null, error: formatOpenAiContentError(error) };
  }
}

export async function generateContentForCurrentUser(
  request: ContentGenerationRequest
): Promise<{ result: ContentGenerationResult | null; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { result: null, error: "Unauthorized" };
  }

  return generateContentForUser(user.id, request);
}

export async function generateContentFromMarketingPlanItem(
  context: ContentGenerationContext,
  request: MarketingPlanContentRequest
): Promise<{ draft: GeneratedContentDraft | null; error?: string }> {
  try {
    const generator = createContentGenerator();

    if (!(generator instanceof OpenAIContentGenerator)) {
      return { draft: null, error: "Marketing plan content generation requires OpenAI." };
    }

    const draft = await generator.generateFromMarketingPlanItem(context, request);

    await logAuditEvent(await createClient(), {
      userId: context.businessProfile.user_id,
      businessProfileId: context.businessProfile.id,
      action: AuditActions.CONTENT_GENERATED,
      entityType: "content_generation",
      status: "success",
      metadata: {
        contentType: mapMarketingPlanChannelToContentType(
          request.recommendedChannel,
          request.planItemType
        ),
        source: "marketing_plan",
        planItemType: request.planItemType,
      },
    });

    return { draft };
  } catch (error) {
    return { draft: null, error: formatOpenAiContentError(error) };
  }
}

export function resolveMarketingPlanContentType(
  request: MarketingPlanContentRequest
): string {
  return mapMarketingPlanChannelToContentType(
    request.recommendedChannel,
    request.planItemType
  );
}

export async function getContentGenerationContextForCurrentUser(): Promise<ContentGenerationContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const profile = await getBusinessProfileForUser();
  if (!profile) return null;

  const [aiMarketingProfile, websiteAnalysis, marketContextBrief, analyticsFeedback] =
    await Promise.all([
    getAiMarketingProfileForUser(supabase, user.id),
    getWebsiteAnalysisForUser(supabase, user.id),
    getLatestMarketContextBriefForUser(user.id),
    getAnalyticsFeedbackForUser(user.id),
  ]);

  return {
    businessProfile: profile,
    aiMarketingProfile,
    websiteAnalysis,
    marketContextSummary: buildMarketContextPromptSummary(marketContextBrief),
    analyticsFeedback,
  };
}

export async function loadContentGenerationContextForUser(
  userId: string
): Promise<ContentGenerationContext | null> {
  return loadGenerationContext(userId);
}

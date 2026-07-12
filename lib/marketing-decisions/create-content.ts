import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getAiMarketingProfileForUser } from "@/lib/ai-marketing-profile/persistence";
import { getBusinessProfileForUserId } from "@/lib/business-profile-server";
import {
  createContentApprovalWithConflict,
  getActiveContentApprovalForRecommendation,
} from "@/lib/content-approval/persistence";
import type { ContentApproval } from "@/lib/content-approval/types";
import {
  createContentGenerator,
} from "@/lib/content-generator/generator";
import {
  formatOpenAiContentError,
  OpenAIContentGenerator,
} from "@/lib/content-generator/openai-generator";
import type {
  ContentGenerationContext,
  GeneratedContentDraft,
} from "@/lib/content-generator/types";
import { getWebsiteAnalysisForUser } from "@/lib/website-analysis/persistence";
import { buildMarketContextPromptSummary } from "@/lib/market-context/prompt-context";
import { getLatestMarketContextBriefWithItemsForUser } from "@/lib/market-context/persistence";
import {
  isContentSupportedActionType,
  mapActionTypeToContentTarget,
} from "@/lib/marketing-decisions/actionTypeContentMapping";
import type { RecommendationContentRequest } from "@/lib/marketing-decisions/content-prompt";
import {
  getMarketingRecommendationByIdForUser,
  markMarketingRecommendationInProgress,
} from "@/lib/marketing-decisions/persistence";
import type { MarketingRecommendation } from "@/lib/marketing-decisions/types";
import { getMarketingOpportunitiesByIdsForUser } from "@/lib/marketing-opportunities/persistence";
import { auditErrorMetadata, logAuditEvent } from "@/lib/audit-log/service";
import { AuditActions } from "@/lib/audit-log/types";
import { createClient } from "@/lib/supabase/server";

export type RecommendationContentDraftResult = {
  contentApproval: ContentApproval;
  recommendation: MarketingRecommendation;
  reused: boolean;
};

export type GenerateContentDraftDeps = {
  /**
   * Injectable draft generator for tests / alternate runners.
   * Production uses OpenAIContentGenerator.generateFromRecommendation.
   */
  generateDraft?: (
    context: ContentGenerationContext,
    request: RecommendationContentRequest
  ) => Promise<GeneratedContentDraft>;
};

const ACTIVE_RECOMMENDATION_STATUSES = new Set(["open", "in_progress"]);

async function loadRecommendationGenerationContext(
  supabase: SupabaseClient,
  userId: string
): Promise<ContentGenerationContext | null> {
  const businessProfile = await getBusinessProfileForUserId(supabase, userId);
  if (!businessProfile) return null;

  const [aiMarketingProfile, websiteAnalysis, marketContextBrief] = await Promise.all([
    getAiMarketingProfileForUser(supabase, userId),
    getWebsiteAnalysisForUser(supabase, userId),
    getLatestMarketContextBriefWithItemsForUser(supabase, userId),
  ]);

  return {
    businessProfile,
    aiMarketingProfile,
    websiteAnalysis,
    marketContextSummary: buildMarketContextPromptSummary(marketContextBrief),
    // Analytics feedback is optional enrichment; keep this path fully injectable
    // for Trigger.dev / service-role execution without cookie-bound helpers.
    analyticsFeedback: null,
  };
}

async function defaultGenerateDraft(
  context: ContentGenerationContext,
  request: RecommendationContentRequest
): Promise<GeneratedContentDraft> {
  const generator = createContentGenerator();
  if (!(generator instanceof OpenAIContentGenerator)) {
    throw new Error("Recommendation content generation requires OpenAI.");
  }
  return generator.generateFromRecommendation(context, request);
}

/**
 * Turns an open/in_progress marketing recommendation into a pending content_approvals
 * draft using the existing content generator. Never publishes, never auto-approves,
 * never marks the recommendation completed.
 *
 * Idempotency / regeneration:
 * - If an active linked draft exists (pending | approved | published), return it.
 * - If all prior linked drafts are rejected, generation is allowed again.
 * - Concurrent races that hit the partial unique index re-query and return the winner.
 *
 * Lifecycle:
 * - Recommendation moves open → in_progress only after the draft insert succeeds.
 * - Generation/persistence failures leave open recommendations open.
 * - dismissed / completed / superseded are never overwritten.
 */
export async function generateContentDraftForRecommendation(
  userId: string,
  recommendationId: string,
  supabaseClient?: SupabaseClient,
  deps: GenerateContentDraftDeps = {}
): Promise<{ result: RecommendationContentDraftResult | null; error?: string }> {
  const supabase = supabaseClient ?? (await createClient());
  const generateDraft = deps.generateDraft ?? defaultGenerateDraft;

  const recommendation = await getMarketingRecommendationByIdForUser(
    supabase,
    userId,
    recommendationId
  );

  if (!recommendation) {
    return { result: null, error: "Recommendation not found for this user." };
  }

  if (!ACTIVE_RECOMMENDATION_STATUSES.has(recommendation.status)) {
    return {
      result: null,
      error: `Recommendation is ${recommendation.status} and cannot be drafted.`,
    };
  }

  if (!isContentSupportedActionType(recommendation.recommended_action_type)) {
    return {
      result: null,
      error: `Action type "${recommendation.recommended_action_type}" does not support content drafting.`,
    };
  }

  // Full ownership chain: recommendation.user_id already enforced by query; also
  // verify the business profile belongs to the same user before generating.
  const businessProfile = await getBusinessProfileForUserId(supabase, userId);
  if (!businessProfile || businessProfile.id !== recommendation.business_profile_id) {
    return { result: null, error: "Business profile not found for this recommendation." };
  }

  const existingDraft = await getActiveContentApprovalForRecommendation(
    supabase,
    userId,
    recommendationId
  );

  if (existingDraft) {
    if (existingDraft.user_id !== userId) {
      return { result: null, error: "Linked draft ownership mismatch." };
    }

    await logAuditEvent(supabase, {
      userId,
      businessProfileId: recommendation.business_profile_id,
      action: AuditActions.MARKETING_RECOMMENDATION_CONTENT_DRAFT_REUSED,
      entityType: "content_approval",
      entityId: existingDraft.id,
      status: "success",
      metadata: {
        recommendationId,
        actionType: recommendation.recommended_action_type,
        draftStatus: existingDraft.status,
      },
    });

    return {
      result: {
        contentApproval: existingDraft,
        recommendation,
        reused: true,
      },
    };
  }

  await logAuditEvent(supabase, {
    userId,
    businessProfileId: recommendation.business_profile_id,
    action: AuditActions.MARKETING_RECOMMENDATION_CONTENT_DRAFT_STARTED,
    entityType: "marketing_recommendation",
    entityId: recommendationId,
    status: "started",
    metadata: { actionType: recommendation.recommended_action_type },
  });

  try {
    const context = await loadRecommendationGenerationContext(supabase, userId);
    if (!context) {
      throw new Error("Business profile not found. Complete onboarding first.");
    }

    const opportunities = await getMarketingOpportunitiesByIdsForUser(
      supabase,
      userId,
      recommendation.related_opportunity_ids
    );

    const target = mapActionTypeToContentTarget(recommendation.recommended_action_type);
    const contentRequest: RecommendationContentRequest = {
      recommendation,
      opportunities,
      target,
    };

    const draft = await generateDraft(context, contentRequest);

    const insertResult = await createContentApprovalWithConflict(supabase, {
      userId,
      businessProfileId: recommendation.business_profile_id,
      data: {
        content_type: target.contentType,
        title: draft.title,
        content: draft.content,
        source: "marketing_recommendation",
        ai_score: draft.voiceScore,
        notes: `Created from marketing recommendation ${recommendationId} (${recommendation.recommended_action_type})`,
        marketing_recommendation_id: recommendationId,
      },
    });

    if (insertResult.uniqueViolation) {
      const winningDraft = await getActiveContentApprovalForRecommendation(
        supabase,
        userId,
        recommendationId
      );

      if (!winningDraft || winningDraft.user_id !== userId) {
        throw new Error("Concurrent draft creation conflict could not be resolved.");
      }

      await logAuditEvent(supabase, {
        userId,
        businessProfileId: recommendation.business_profile_id,
        action: AuditActions.MARKETING_RECOMMENDATION_CONTENT_DRAFT_REUSED,
        entityType: "content_approval",
        entityId: winningDraft.id,
        status: "success",
        metadata: {
          recommendationId,
          actionType: recommendation.recommended_action_type,
          draftStatus: winningDraft.status,
          raceResolved: true,
        },
      });

      return {
        result: {
          contentApproval: winningDraft,
          recommendation,
          reused: true,
        },
      };
    }

    if (!insertResult.approval) {
      throw new Error(
        insertResult.error?.message ?? "Unable to save content to Approval Center"
      );
    }

    // Only after successful draft insert: open → in_progress.
    const updatedRecommendation =
      (await markMarketingRecommendationInProgress(supabase, userId, recommendationId)) ??
      recommendation;

    await logAuditEvent(supabase, {
      userId,
      businessProfileId: recommendation.business_profile_id,
      action: AuditActions.MARKETING_RECOMMENDATION_CONTENT_DRAFT_COMPLETED,
      entityType: "content_approval",
      entityId: insertResult.approval.id,
      status: "success",
      metadata: {
        recommendationId,
        actionType: recommendation.recommended_action_type,
        contentType: insertResult.approval.content_type,
        recommendationStatus: updatedRecommendation.status,
      },
    });

    await logAuditEvent(supabase, {
      userId,
      businessProfileId: recommendation.business_profile_id,
      action: AuditActions.CONTENT_SENT_TO_APPROVAL,
      entityType: "content_approval",
      entityId: insertResult.approval.id,
      status: "success",
      metadata: {
        contentType: insertResult.approval.content_type,
        source: insertResult.approval.source,
        title: insertResult.approval.title,
        recommendationId,
      },
    });

    return {
      result: {
        contentApproval: insertResult.approval,
        recommendation: updatedRecommendation,
        reused: false,
      },
    };
  } catch (error) {
    await logAuditEvent(supabase, {
      userId,
      businessProfileId: recommendation.business_profile_id,
      action: AuditActions.MARKETING_RECOMMENDATION_CONTENT_DRAFT_FAILED,
      entityType: "marketing_recommendation",
      entityId: recommendationId,
      status: "failure",
      metadata: auditErrorMetadata(error, "Recommendation content drafting failed"),
    });

    return {
      result: null,
      error: error instanceof Error ? error.message : formatOpenAiContentError(error),
    };
  }
}

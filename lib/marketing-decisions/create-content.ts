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
import { OpenAIContentGenerator } from "@/lib/content-generator/openai-generator";
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
import { toSafeUserErrorMessage } from "@/lib/security/safe-error-message";
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

/**
 * Fallback for any error whose message isn't known-safe by construction. Never
 * interpolates the underlying error, so a raw Postgres/Supabase/internal message can
 * never reach this string by accident -- see the outer catch block below.
 */
const CONTENT_DRAFT_GENERIC_FAILURE_MESSAGE =
  "Unable to generate content for this recommendation right now. Please try again.";

const CONTENT_DRAFT_SAVE_FAILURE_MESSAGE =
  "Unable to save content to Approval Center. Please try again.";

/**
 * Marks an error message as deliberately safe to return to the caller verbatim. Every
 * throw inside generateContentDraftForRecommendation's try block that is safe by
 * construction (a fixed, hand-authored string that never interpolates a lower-level
 * error) uses this class. The outer catch treats anything that ISN'T an instance of
 * this class as unknown/potentially unsafe and always replaces it with a fixed generic
 * fallback -- this is a stronger, unconditional guarantee than pattern-based
 * sanitization alone, which can't recognize every shape a raw Postgres/Supabase/
 * internal message might take (e.g. "relation ... does not exist" matches no known
 * secret/config pattern but still shouldn't be echoed to the caller).
 */
class SafeContentDraftError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "SafeContentDraftError";
  }
}

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
    throw new SafeContentDraftError("Recommendation content generation requires OpenAI.");
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
    // No ownership re-check needed here: getActiveContentApprovalForRecommendation
    // already filters by user_id in its query, so existingDraft can never belong to
    // another tenant -- a redundant check here would be unreachable dead code.
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
      throw new SafeContentDraftError("Business profile not found. Complete onboarding first.");
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

    // Re-check status immediately before the write: draft generation can be slow
    // (a real network call to OpenAI), and nothing between the initial check at the
    // top of this function and this point re-validates that the recommendation is
    // still open/in_progress. A concurrent dismiss/complete/supersede in that window
    // must abort here, before any row is inserted -- not be discovered afterward.
    const freshRecommendation = await getMarketingRecommendationByIdForUser(
      supabase,
      userId,
      recommendationId
    );

    if (!freshRecommendation || !ACTIVE_RECOMMENDATION_STATUSES.has(freshRecommendation.status)) {
      // freshRecommendation.status is one of this schema's own controlled enum
      // values, not external/raw text -- safe to interpolate and return verbatim.
      throw new SafeContentDraftError(
        `Recommendation is ${freshRecommendation?.status ?? "no longer available"} and cannot be drafted.`
      );
    }

    const insertResult = await createContentApprovalWithConflict(supabase, {
      userId,
      businessProfileId: recommendation.business_profile_id,
      data: {
        content_type: target.contentType,
        title: draft.title,
        content: draft.content,
        source: "marketing_recommendation",
        ai_score: draft.voiceScore,
        notes: `Drafted from marketing recommendation (${recommendation.recommended_action_type})`,
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
        throw new SafeContentDraftError("Concurrent draft creation conflict could not be resolved.");
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
      // Never interpolate insertResult.error?.message into this thrown message --
      // it's a raw Postgres/Supabase error that may reveal constraint, column, or
      // table names. Use Error's standard `cause` option to carry the real detail
      // through to the audit log below (see the outer catch), without exposing it
      // in the message that becomes this function's returned `error` string.
      throw new SafeContentDraftError(CONTENT_DRAFT_SAVE_FAILURE_MESSAGE, { cause: insertResult.error });
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
    // Prefer the original cause (e.g. a raw Postgres/Supabase error attached via
    // Error's `cause` option above) for the audit log's diagnostic detail, falling
    // back to the caught error itself. auditErrorMetadata applies this codebase's
    // standard server-side sanitization either way -- this is about giving the audit
    // trail the most useful underlying detail available, not bypassing that.
    const auditDetailSource =
      error instanceof Error && error.cause !== undefined ? error.cause : error;

    await logAuditEvent(supabase, {
      userId,
      businessProfileId: recommendation.business_profile_id,
      action: AuditActions.MARKETING_RECOMMENDATION_CONTENT_DRAFT_FAILED,
      entityType: "marketing_recommendation",
      entityId: recommendationId,
      status: "failure",
      metadata: auditErrorMetadata(auditDetailSource, "Recommendation content drafting failed"),
    });

    // Never return a raw error message here. Only this function's own deliberately-
    // authored, fixed SafeContentDraftError messages are returned verbatim (still run
    // through toSafeUserErrorMessage as a defensive extra layer, though none of them
    // match its patterns). Everything else -- a raw Postgres/Supabase message bubbling
    // up from a lower-level persistence call, an unexpected exception from draft
    // generation, or anything not explicitly vouched for as safe -- is unconditionally
    // replaced with the fixed generic fallback, regardless of what its message
    // contains. This is a stronger guarantee than pattern-based sanitization alone.
    if (error instanceof SafeContentDraftError) {
      return {
        result: null,
        error: toSafeUserErrorMessage(error, CONTENT_DRAFT_GENERIC_FAILURE_MESSAGE),
      };
    }

    return { result: null, error: CONTENT_DRAFT_GENERIC_FAILURE_MESSAGE };
  }
}

/**
 * Current-user wrapper: resolves the session once, then delegates to the injectable
 * core above. Unchanged cookie-bound contract -- mirrors
 * evaluateOpportunitiesForCurrentUser / runMarketingDecisionEngineForCurrentUser. The
 * core function itself has no current-user dependency; this wrapper is the only place
 * that resolves a session.
 */
export async function generateContentDraftForRecommendationForCurrentUser(
  recommendationId: string,
  deps: GenerateContentDraftDeps = {}
): Promise<{ result: RecommendationContentDraftResult | null; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { result: null, error: "Unauthorized" };
  }

  return generateContentDraftForRecommendation(user.id, recommendationId, supabase, deps);
}

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  generateContentDraftForRecommendation,
  type GenerateContentDraftDeps,
} from "@/lib/marketing-decisions/create-content";
import {
  getActiveMarketingRecommendationsForUser,
  getMarketingRecommendationByIdForUser,
} from "@/lib/marketing-decisions/persistence";
import type { MarketingRecommendation } from "@/lib/marketing-decisions/types";
import {
  isContentSupportedActionType,
  // This IS the canonical recommendation-action-to-content-target routing layer
  // (see the module doc comment on actionTypeContentMapping.ts). It already unifies
  // recommendation action names (RecommendedActionTypes, e.g. "publish_gbp_post") with
  // the content generator's own content-type vocabulary (CONTENT_TYPE_OPTIONS, e.g.
  // "Google Business Profile Post") -- there is no second "create_gbp_post"-style name
  // anywhere in the current codebase to reconcile (confirmed by repo-wide search before
  // writing this module). Reused here rather than duplicated, per this engine's mandate
  // to route through one explicit, typed mapping rather than inventing a second one.
  mapActionTypeToContentTarget,
} from "@/lib/marketing-decisions/actionTypeContentMapping";
import { getManualNextStep } from "@/lib/marketing-decisions/ui";
import { recordDraftCreatedOutcome } from "@/lib/recommendation-outcomes/service";
import type {
  RecommendationExecutionBatchResult,
  RecommendationExecutionResult,
} from "@/lib/recommendation-execution/types";

const ACTIVE_RECOMMENDATION_STATUSES = new Set(["open", "in_progress"]);

/** Same deps shape generateContentDraftForRecommendation accepts -- passed straight through. */
export type RecommendationExecutionDeps = GenerateContentDraftDeps;

function baseResult(
  recommendation: Pick<MarketingRecommendation, "business_profile_id" | "recommended_action_type"> | null,
  recommendationId: string
): Omit<RecommendationExecutionResult, "status" | "reason"> {
  return {
    recommendationId,
    businessProfileId: recommendation?.business_profile_id ?? null,
    actionType: recommendation?.recommended_action_type ?? null,
    contentApprovalId: null,
  };
}

/**
 * Executes exactly one recommendation: validates tenant ownership and current
 * actionability, routes its action type through the canonical content-target mapping,
 * and (if eligible) generates and durably saves a draft via the existing
 * recommendation-to-content workflow -- never duplicating that logic here.
 *
 * Idempotency is inherited entirely from generateContentDraftForRecommendation's own
 * guarantees: a partial unique index on content_approvals(marketing_recommendation_id)
 * (active statuses only) makes a duplicate draft impossible even under concurrent
 * execution -- see migration 019_recommendation_content_link.sql. This function adds no
 * new idempotency mechanism of its own; it is a thin, typed adapter that translates that
 * function's {result, reused, error} contract into this engine's five-state result
 * vocabulary (executed | already_executed | skipped | unsupported | failed), which the
 * underlying function does not itself expose.
 *
 * A recommendation is never marked "executed" (i.e. moved open -> in_progress) until
 * after its draft is durably saved -- this ordering guarantee lives entirely inside
 * generateContentDraftForRecommendation and is unchanged here.
 *
 * Accepts an optional injected Supabase client, following the same convention as every
 * other *ForUser function in this codebase: omitted, it defaults to the request-scoped
 * cookie client; pass a service-role client to run this for any tenant from
 * background-job, admin, or Trigger.dev execution with no cookies or session.
 */
export async function executeRecommendationForUser(
  userId: string,
  recommendationId: string,
  supabaseClient?: SupabaseClient,
  deps: RecommendationExecutionDeps = {}
): Promise<RecommendationExecutionResult> {
  const supabase = supabaseClient ?? (await createClient());

  // Tenant/ownership scope: getMarketingRecommendationByIdForUser filters by both
  // user_id and id, so a recommendation belonging to another tenant (or that does not
  // exist) can never be returned here, regardless of what recommendationId was supplied.
  const recommendation = await getMarketingRecommendationByIdForUser(supabase, userId, recommendationId);

  if (!recommendation) {
    return {
      ...baseResult(null, recommendationId),
      status: "failed",
      reason: "Recommendation not found for this tenant.",
    };
  }

  if (!ACTIVE_RECOMMENDATION_STATUSES.has(recommendation.status)) {
    return {
      ...baseResult(recommendation, recommendationId),
      status: "skipped",
      reason: `Recommendation status is "${recommendation.status}"; not eligible for execution.`,
    };
  }

  if (!isContentSupportedActionType(recommendation.recommended_action_type)) {
    return {
      ...baseResult(recommendation, recommendationId),
      status: "unsupported",
      reason: getManualNextStep(recommendation.recommended_action_type),
    };
  }

  // Route the action type through the canonical mapping up front purely to fail fast
  // and consistently if it were ever missing an entry -- generateContentDraftForRecommendation
  // performs the authoritative mapping and generation itself.
  mapActionTypeToContentTarget(recommendation.recommended_action_type);

  const { result, error } = await generateContentDraftForRecommendation(
    userId,
    recommendationId,
    supabase,
    deps
  );

  if (!result) {
    return {
      ...baseResult(recommendation, recommendationId),
      status: "failed",
      reason: error ?? "Recommendation execution failed.",
    };
  }

  // Fire-and-forget-safe idempotent follow-up -- never on the critical path of
  // returning this result, and safe to call on both the "executed" and
  // "already_executed" (reused) branches: the outcome event's own idempotency key is
  // the content approval id, so calling this every time a draft exists (new or reused)
  // guarantees the association is recorded exactly once, regardless of how many times
  // this recommendation is (re-)executed.
  await recordDraftCreatedOutcome(supabase, {
    userId,
    businessProfileId: recommendation.business_profile_id,
    recommendationId,
    contentApprovalId: result.contentApproval.id,
  });

  return {
    ...baseResult(recommendation, recommendationId),
    status: result.reused ? "already_executed" : "executed",
    contentApprovalId: result.contentApproval.id,
    reason: result.reused
      ? "An active draft already exists for this recommendation."
      : "Draft generated and saved to Approval Center.",
  };
}

/**
 * Finds this tenant's currently-eligible recommendations (open/in_progress, per
 * getActiveMarketingRecommendationsForUser) and attempts execution for each. A failure
 * on one recommendation is caught and recorded individually -- it never aborts or
 * corrupts the outcome of any other recommendation in the batch.
 *
 * "Eligible" here deliberately does not pre-filter by action type or existing-draft
 * state at the query level: unsupported action types and already-drafted recommendations
 * are still evaluated, and correctly resolve to "unsupported"/"already_executed" via
 * executeRecommendationForUser's own checks. This keeps the eligibility query itself
 * simple (a single existing, already-tested persistence function) and keeps all
 * classification logic in one place.
 */
export async function executeEligibleRecommendationsForUser(
  userId: string,
  supabaseClient?: SupabaseClient,
  deps: RecommendationExecutionDeps = {}
): Promise<RecommendationExecutionBatchResult> {
  const supabase = supabaseClient ?? (await createClient());
  const eligible = await getActiveMarketingRecommendationsForUser(supabase, userId);

  const results: RecommendationExecutionResult[] = [];
  for (const recommendation of eligible) {
    try {
      results.push(await executeRecommendationForUser(userId, recommendation.id, supabase, deps));
    } catch (error) {
      // executeRecommendationForUser -> generateContentDraftForRecommendation already
      // catch and sanitize their own errors and should never throw past themselves;
      // this is a last-resort safety net so one truly unexpected exception can never
      // abort the rest of the batch.
      results.push({
        ...baseResult(recommendation, recommendation.id),
        status: "failed",
        reason: "Recommendation execution failed.",
      });
      void error;
    }
  }

  const summary = {
    evaluated: results.length,
    executed: results.filter((r) => r.status === "executed").length,
    alreadyExecuted: results.filter((r) => r.status === "already_executed").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    unsupported: results.filter((r) => r.status === "unsupported").length,
    failed: results.filter((r) => r.status === "failed").length,
  };

  return { summary, results };
}

/** Cookie-bound convenience wrapper — resolves the signed-in user, then delegates. */
export async function executeRecommendationForCurrentUser(
  recommendationId: string,
  deps: RecommendationExecutionDeps = {}
): Promise<RecommendationExecutionResult | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return executeRecommendationForUser(user.id, recommendationId, supabase, deps);
}

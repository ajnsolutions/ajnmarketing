import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getMarketingRecommendationByIdForUser } from "@/lib/marketing-decisions/persistence";
import { formatRecommendedActionType } from "@/lib/marketing-decisions/ui";
import type { MarketingRecommendation } from "@/lib/marketing-decisions/types";
import { getMarketingOpportunitiesByIdsForUser } from "@/lib/marketing-opportunities/persistence";
import type { MarketingOpportunity } from "@/lib/marketing-opportunities/types";
import type { ContentApproval } from "@/lib/content-approval/types";
import { inferPlatformFromContentType } from "@/lib/publishing-queue/persistence";
import {
  getContentApprovalForRecommendation,
  getRecommendationsForBusiness,
} from "@/lib/recommendation-outcomes/persistence";
import { summarizeRecommendationOutcomeForUser } from "@/lib/recommendation-outcomes/service";
import type { RecommendationOutcomeSummary } from "@/lib/recommendation-outcomes/types";
import { computeRecommendationScoreBreakdown } from "@/lib/recommendation-learning/adaptiveScoring";
import { getHistoricalRecommendationSignalsForUser } from "@/lib/recommendation-learning/signals";
import type { AdaptiveScoreBreakdown, HistoricalRecommendationSignals } from "@/lib/recommendation-learning/types";
import {
  confidenceExplanation,
  confidenceLabelText,
  resolveConfidenceLabel,
} from "@/lib/recommendation-presentation/confidenceLabels";
import { getExpectedBenefit } from "@/lib/recommendation-presentation/expectedBenefit";
import { buildSupportingReasons } from "@/lib/recommendation-presentation/reasonTranslation";
import { presentOutcomeStatus } from "@/lib/recommendation-presentation/outcomeStatus";
import {
  ClientRecommendationActions,
  type ClientRecommendationAction,
  type ClientRecommendationDecisionPackage,
} from "@/lib/recommendation-presentation/types";

function logPackageRetrieval(input: {
  recommendationId: string;
  contentApprovalId: string | null;
  businessProfileId: string;
  found: boolean;
}): void {
  console.info("[RecommendationPresentation]", {
    scope: "recommendation-presentation",
    action: "package_retrieved",
    recommendationId: input.recommendationId,
    contentApprovalId: input.contentApprovalId,
    businessProfileId: input.businessProfileId,
    found: input.found,
  });
}

function resolveClientActions(approval: ContentApproval | null): ClientRecommendationAction[] {
  if (!approval) return [];

  const actions: ClientRecommendationAction[] = [];
  if (approval.status === "pending") {
    actions.push(ClientRecommendationActions.APPROVE, ClientRecommendationActions.REJECT);
  }
  actions.push(ClientRecommendationActions.EDIT, ClientRecommendationActions.MORE_LIKE_THIS);
  return actions;
}

function buildPackage(input: {
  recommendation: MarketingRecommendation;
  approval: ContentApproval | null;
  relatedOpportunities: MarketingOpportunity[];
  outcomeSummary: RecommendationOutcomeSummary;
  breakdown: AdaptiveScoreBreakdown;
}): ClientRecommendationDecisionPackage {
  const { recommendation, approval, relatedOpportunities, outcomeSummary, breakdown } = input;

  const confidenceLabel = resolveConfidenceLabel({
    finalConfidence: breakdown.finalConfidence,
    historicalSampleSize: breakdown.historicalSampleSize,
  });

  const categories = [...new Set(relatedOpportunities.map((o) => o.category))];
  const platform = approval ? inferPlatformFromContentType(approval.content_type) : null;

  return {
    recommendationId: recommendation.id,
    contentApprovalId: approval?.id ?? null,
    title: approval?.title ?? formatRecommendedActionType(recommendation.recommended_action_type),
    recommendedAction: formatRecommendedActionType(recommendation.recommended_action_type),
    whyNow: recommendation.reasoning || "This recommendation is based on current activity for your business.",
    supportingReasons: buildSupportingReasons(categories, breakdown),
    expectedBenefit: getExpectedBenefit(recommendation.recommended_action_type),
    confidenceLabel,
    confidenceLabelText: confidenceLabelText(confidenceLabel),
    confidenceExplanation: confidenceExplanation(confidenceLabel),
    generatedDraft: approval
      ? {
          contentApprovalId: approval.id,
          title: approval.title,
          content: approval.content,
          contentType: approval.content_type,
          version: approval.version,
        }
      : null,
    platform,
    contentType: approval?.content_type ?? null,
    approvalStatus: approval?.status ?? null,
    outcomeStatus: presentOutcomeStatus(outcomeSummary),
    clientActions: resolveClientActions(approval),
    sourceContext: {
      urgency: recommendation.urgency,
      categories,
    },
    createdAt: recommendation.created_at,
  };
}

/**
 * Server-only, tenant-scoped client presentation package for one recommendation.
 * Combines the recommendation, its linked content_approvals draft, PR #27's outcome
 * summary, and a freshly recomputed PR #28 adaptive score breakdown (via the same
 * computeRecommendationScoreBreakdown the admin debug view uses) into a single,
 * client-safe model. Never returns internal score arithmetic, raw confidence
 * percentages, or admin-only reason weights -- see lib/recommendation-presentation/types.ts.
 *
 * Returns null for a recommendation that doesn't exist OR doesn't belong to this
 * userId -- cross-tenant access is indistinguishable from "not found," matching every
 * other *ForUser function in this codebase.
 */
export async function getRecommendationDecisionPackageForUser(
  userId: string,
  recommendationId: string,
  supabaseClient?: SupabaseClient
): Promise<ClientRecommendationDecisionPackage | null> {
  const supabase = supabaseClient ?? (await createClient());

  const recommendation = await getMarketingRecommendationByIdForUser(supabase, userId, recommendationId);
  if (!recommendation) {
    logPackageRetrieval({
      recommendationId,
      contentApprovalId: null,
      businessProfileId: "unknown",
      found: false,
    });
    return null;
  }

  const [approvalRow, relatedOpportunities, outcomeSummary, signals] = await Promise.all([
    getContentApprovalForRecommendation(supabase, userId, recommendationId),
    getMarketingOpportunitiesByIdsForUser(supabase, userId, recommendation.related_opportunity_ids),
    summarizeRecommendationOutcomeForUser(userId, recommendationId, supabase),
    getHistoricalRecommendationSignalsForUser(userId, recommendation.business_profile_id, supabase),
  ]);

  // getContentApprovalForRecommendation already selects the full row with the exact
  // same (snake_case) field names as ContentApproval -- no second query needed to map it.
  const approval = approvalRow ? (approvalRow as unknown as ContentApproval) : null;

  const breakdown = computeRecommendationScoreBreakdown(recommendation, relatedOpportunities, signals);

  logPackageRetrieval({
    recommendationId,
    contentApprovalId: approval?.id ?? null,
    businessProfileId: recommendation.business_profile_id,
    found: true,
  });

  return buildPackage({ recommendation, approval, relatedOpportunities, outcomeSummary, breakdown });
}

export async function getRecommendationDecisionPackageForCurrentUser(
  recommendationId: string
): Promise<ClientRecommendationDecisionPackage | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;
  return getRecommendationDecisionPackageForUser(user.id, recommendationId, supabase);
}

/**
 * Batch variant for the Approval Center: builds a decision package for every
 * recommendation-linked approval in one pass, fetching this business's historical
 * signals only once (not once per approval). Keyed by content_approval_id. Approvals
 * with no marketing_recommendation_id (hand-authored content) are simply absent from
 * the returned map -- the Approval Center renders those exactly as it does today.
 */
export async function getRecommendationDecisionPackagesForApprovals(
  userId: string,
  businessProfileId: string,
  approvals: ContentApproval[],
  supabaseClient?: SupabaseClient
): Promise<Map<string, ClientRecommendationDecisionPackage>> {
  const supabase = supabaseClient ?? (await createClient());
  const result = new Map<string, ClientRecommendationDecisionPackage>();

  const recommendationLinked = approvals.filter((a) => a.marketing_recommendation_id);
  if (recommendationLinked.length === 0) return result;

  const [signals, allRecommendations] = await Promise.all([
    getHistoricalRecommendationSignalsForUser(userId, businessProfileId, supabase),
    getRecommendationsForBusiness(supabase, userId, businessProfileId),
  ]);

  const recommendationById = new Map(allRecommendations.map((r) => [String(r.id), r]));
  const allOpportunityIds = [
    ...new Set(
      allRecommendations.flatMap((r) => (r.related_opportunity_ids as string[] | null) ?? [])
    ),
  ];
  const opportunities = await getMarketingOpportunitiesByIdsForUser(supabase, userId, allOpportunityIds);
  const opportunityById = new Map(opportunities.map((o) => [o.id, o]));

  for (const approval of recommendationLinked) {
    const recommendationId = approval.marketing_recommendation_id!;
    const rawRec = recommendationById.get(recommendationId);
    if (!rawRec) continue;

    const recommendation: MarketingRecommendation = {
      id: String(rawRec.id),
      user_id: String(rawRec.user_id),
      business_profile_id: String(rawRec.business_profile_id),
      recommended_action_type: rawRec.recommended_action_type as MarketingRecommendation["recommended_action_type"],
      priority_score: Number(rawRec.priority_score ?? 0),
      urgency: rawRec.urgency as MarketingRecommendation["urgency"],
      business_impact: rawRec.business_impact as MarketingRecommendation["business_impact"],
      estimated_effort: rawRec.estimated_effort as MarketingRecommendation["estimated_effort"],
      confidence: Number(rawRec.confidence ?? 0),
      reasoning: String(rawRec.reasoning ?? ""),
      related_opportunity_ids: ((rawRec.related_opportunity_ids as string[] | null) ?? []).map(String),
      status: rawRec.status as MarketingRecommendation["status"],
      created_at: String(rawRec.created_at),
      updated_at: String(rawRec.updated_at),
    };

    const relatedOpportunities = recommendation.related_opportunity_ids
      .map((id) => opportunityById.get(id))
      .filter((o): o is MarketingOpportunity => Boolean(o));

    const outcomeSummary = await summarizeRecommendationOutcomeForUser(userId, recommendationId, supabase);
    const breakdown = computeRecommendationScoreBreakdown(recommendation, relatedOpportunities, signals);

    result.set(
      approval.id,
      buildPackage({ recommendation, approval, relatedOpportunities, outcomeSummary, breakdown })
    );

    logPackageRetrieval({
      recommendationId,
      contentApprovalId: approval.id,
      businessProfileId,
      found: true,
    });
  }

  return result;
}

export type { HistoricalRecommendationSignals };

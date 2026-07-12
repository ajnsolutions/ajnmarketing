import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getActiveMarketingOpportunitiesForUser } from "@/lib/marketing-opportunities/persistence";
import { buildMarketingRecommendationDrafts } from "@/lib/marketing-decisions/decisionEngine";
import {
  closeSupersededMarketingRecommendations,
  upsertMarketingRecommendation,
} from "@/lib/marketing-decisions/persistence";
import type { MarketingRecommendation } from "@/lib/marketing-decisions/types";
import { logAuditEvent, auditErrorMetadata } from "@/lib/audit-log/service";
import { AuditActions } from "@/lib/audit-log/types";
import { createClient } from "@/lib/supabase/server";

export type MarketingDecisionResult = {
  recommendations: MarketingRecommendation[];
  supersededCount: number;
  evaluatedOpportunityCount: number;
};

/**
 * Runs the Marketing Decision Engine for one user: reads active (open/in_progress)
 * marketing_opportunities, ranks and groups them into recommendations, persists the
 * result idempotently, and closes out any previously-open recommendation whose
 * underlying opportunity group no longer matches what this run produced.
 *
 * Accepts an optional injected Supabase client — omitted, it defaults to the
 * request-scoped cookie client exactly like every other *ForUser function in this
 * codebase; pass a service-role client (lib/supabase/service.ts) to run this for any
 * tenant from background-job or Trigger.dev execution with no cookies or session. Every
 * database access in this function is threaded through the same client.
 *
 * businessProfileId is required explicitly (rather than resolved internally from
 * userId) because a recommendation set is scoped to one business, and the caller
 * already has it from having run the detection engine — avoids a redundant lookup.
 */
export async function runMarketingDecisionEngineForUser(
  userId: string,
  businessProfileId: string,
  supabaseClient?: SupabaseClient,
  now: Date = new Date()
): Promise<MarketingDecisionResult> {
  const supabase = supabaseClient ?? (await createClient());

  await logAuditEvent(supabase, {
    userId,
    businessProfileId,
    action: AuditActions.MARKETING_RECOMMENDATIONS_GENERATION_STARTED,
    entityType: "marketing_recommendation",
    status: "started",
  });

  try {
    const activeOpportunities = await getActiveMarketingOpportunitiesForUser(supabase, userId);
    const scopedOpportunities = activeOpportunities.filter(
      (o) => o.business_profile_id === businessProfileId
    );

    const drafts = buildMarketingRecommendationDrafts(scopedOpportunities, now);

    const recommendations: MarketingRecommendation[] = [];
    for (const draft of drafts) {
      recommendations.push(
        await upsertMarketingRecommendation(supabase, userId, businessProfileId, draft)
      );
    }

    const supersededCount = await closeSupersededMarketingRecommendations(
      supabase,
      userId,
      businessProfileId,
      drafts.map((d) => d.dedupeKey)
    );

    await logAuditEvent(supabase, {
      userId,
      businessProfileId,
      action: AuditActions.MARKETING_RECOMMENDATIONS_GENERATION_COMPLETED,
      entityType: "marketing_recommendation",
      status: "success",
      metadata: {
        recommendationCount: recommendations.length,
        supersededCount,
        evaluatedOpportunityCount: scopedOpportunities.length,
        actionTypes: recommendations.map((r) => r.recommended_action_type),
      },
    });

    return {
      recommendations,
      supersededCount,
      evaluatedOpportunityCount: scopedOpportunities.length,
    };
  } catch (error) {
    await logAuditEvent(supabase, {
      userId,
      businessProfileId,
      action: AuditActions.MARKETING_RECOMMENDATIONS_GENERATION_FAILED,
      entityType: "marketing_recommendation",
      status: "failure",
      metadata: auditErrorMetadata(error, "Marketing recommendation generation failed"),
    });
    throw error;
  }
}

/** Current-user wrapper: resolves the session, then delegates. Unchanged cookie-bound contract. */
export async function runMarketingDecisionEngineForCurrentUser(
  businessProfileId: string
): Promise<MarketingDecisionResult | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return runMarketingDecisionEngineForUser(user.id, businessProfileId, supabase);
}

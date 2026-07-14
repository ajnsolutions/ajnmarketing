import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getActiveMarketingRecommendationsForUser } from "@/lib/marketing-decisions/persistence";
import { getMarketingOpportunitiesByIdsForUser } from "@/lib/marketing-opportunities/persistence";
import { computeRecommendationScoreBreakdown } from "@/lib/recommendation-learning/adaptiveScoring";
import { getHistoricalRecommendationSignalsForUser } from "@/lib/recommendation-learning/signals";
import type { AdaptiveScoreBreakdown } from "@/lib/recommendation-learning/types";

export type RecommendationLearningDebugEntry = {
  recommendationId: string;
  actionType: string;
  storedFinalScore: number;
  storedFinalConfidence: number;
  recomputed: AdaptiveScoreBreakdown;
};

/**
 * Developer/admin debug view: for every currently-active recommendation, recomputes
 * the adaptive scoring breakdown (base score, historical adjustment, final score,
 * confidence, top reasons, sample size) fresh, and reports it alongside what's actually
 * stored. Recomputes rather than reads a stored snapshot -- there is no new schema for
 * this feature (see docs/ADAPTIVE_RECOMMENDATION_INTELLIGENCE.md), so "recomputed" may
 * differ slightly from "stored" if historical signals have changed since the
 * recommendation was last (re)generated. This is a deliberate tradeoff, not a bug.
 */
export async function getRecommendationLearningDebugForUser(
  userId: string,
  businessProfileId: string,
  supabaseClient?: SupabaseClient
): Promise<RecommendationLearningDebugEntry[]> {
  const supabase = supabaseClient ?? (await createClient());

  const allActive = await getActiveMarketingRecommendationsForUser(supabase, userId);
  const recommendations = allActive.filter((r) => r.business_profile_id === businessProfileId);
  if (recommendations.length === 0) return [];

  const now = new Date();
  const allOpportunityIds = [...new Set(recommendations.flatMap((r) => r.related_opportunity_ids))];
  const opportunities = await getMarketingOpportunitiesByIdsForUser(supabase, userId, allOpportunityIds);
  const opportunityById = new Map(opportunities.map((o) => [o.id, o]));

  const signals = await getHistoricalRecommendationSignalsForUser(userId, businessProfileId, supabase);

  return recommendations.map((rec) => {
    const relatedOpportunities = rec.related_opportunity_ids
      .map((id) => opportunityById.get(id))
      .filter((o): o is NonNullable<typeof o> => Boolean(o));

    return {
      recommendationId: rec.id,
      actionType: rec.recommended_action_type,
      storedFinalScore: rec.priority_score,
      storedFinalConfidence: rec.confidence,
      recomputed: computeRecommendationScoreBreakdown(rec, relatedOpportunities, signals, now),
    };
  });
}

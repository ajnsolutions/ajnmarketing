import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  MarketingRecommendation,
  MarketingRecommendationDraft,
  RecommendationStatus,
  RecommendedActionType,
} from "@/lib/marketing-decisions/types";

function mapRecommendation(row: Record<string, unknown>): MarketingRecommendation {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    business_profile_id: String(row.business_profile_id),
    recommended_action_type: row.recommended_action_type as RecommendedActionType,
    priority_score: Number(row.priority_score ?? 0),
    urgency: row.urgency as MarketingRecommendation["urgency"],
    business_impact: row.business_impact as MarketingRecommendation["business_impact"],
    estimated_effort: row.estimated_effort as MarketingRecommendation["estimated_effort"],
    confidence: Number(row.confidence ?? 0),
    reasoning: String(row.reasoning ?? ""),
    related_opportunity_ids: ((row.related_opportunity_ids as string[] | null) ?? []).map(String),
    status: row.status as RecommendationStatus,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

/**
 * Statuses that represent "nobody has acted on this yet" — safe for re-generation to
 * overwrite with fresh scoring and reopen if it had been superseded. "dismissed" and
 * "completed" represent a user decision that regeneration must not silently undo.
 */
const REOPENABLE_STATUSES = new Set<RecommendationStatus>(["open", "superseded"]);

/**
 * Idempotent upsert on (userId, businessProfileId, dedupeKey) — the sorted set of
 * related opportunity ids. Re-running the decision engine with the same active
 * opportunity group updates the existing row's scoring/reasoning instead of duplicating
 * it, and never silently reopens a recommendation the user already dismissed/completed.
 */
export async function upsertMarketingRecommendation(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
  draft: MarketingRecommendationDraft
): Promise<MarketingRecommendation> {
  const { data: existing, error: lookupError } = await supabase
    .from("marketing_recommendations")
    .select("id, status")
    .eq("user_id", userId)
    .eq("business_profile_id", businessProfileId)
    .eq("dedupe_key", draft.dedupeKey)
    .maybeSingle();

  if (lookupError) {
    throw new Error(
      `upsertMarketingRecommendation: failed to look up existing recommendation (${lookupError.message ?? lookupError})`
    );
  }

  const nextStatus: RecommendationStatus =
    !existing || REOPENABLE_STATUSES.has(existing.status as RecommendationStatus)
      ? "open"
      : (existing.status as RecommendationStatus);

  const { data, error } = await supabase
    .from("marketing_recommendations")
    .upsert(
      {
        user_id: userId,
        business_profile_id: businessProfileId,
        recommended_action_type: draft.recommendedActionType,
        priority_score: draft.priorityScore,
        urgency: draft.urgency,
        business_impact: draft.businessImpact,
        estimated_effort: draft.estimatedEffort,
        confidence: draft.confidence,
        reasoning: draft.reasoning,
        related_opportunity_ids: draft.relatedOpportunityIds,
        dedupe_key: draft.dedupeKey,
        status: nextStatus,
      },
      { onConflict: "user_id,business_profile_id,dedupe_key" }
    )
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      `upsertMarketingRecommendation: failed to write recommendation (${error?.message ?? "no row returned"})`
    );
  }

  return mapRecommendation(data as Record<string, unknown>);
}

/**
 * Marks (status -> "superseded") every currently-open recommendation for this business
 * whose dedupe_key was not produced by the current run — its underlying opportunity
 * group has changed (some member opportunities were resolved, dismissed, or expired
 * since the last run), so the old grouping/reasoning is stale. Implemented as a
 * read-then-targeted-update on primary key rather than a single filtered update,
 * specifically to avoid embedding dedupe_key values (which may contain arbitrary
 * characters) inside a Postgrest `.in()`/`.not()` filter expression. Never touches
 * dismissed/completed rows — those aren't 'open', so the initial select excludes them.
 */
export async function closeSupersededMarketingRecommendations(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
  currentDedupeKeys: string[]
): Promise<number> {
  const { data: openRows, error: selectError } = await supabase
    .from("marketing_recommendations")
    .select("id, dedupe_key")
    .eq("user_id", userId)
    .eq("business_profile_id", businessProfileId)
    .eq("status", "open");

  if (selectError) {
    throw new Error(
      `closeSupersededMarketingRecommendations: failed to read open recommendations (${selectError.message})`
    );
  }

  const currentKeys = new Set(currentDedupeKeys);
  const idsToSupersede = (openRows ?? [])
    .filter((row) => !currentKeys.has(String(row.dedupe_key)))
    .map((row) => row.id);

  if (idsToSupersede.length === 0) {
    return 0;
  }

  const { error } = await supabase
    .from("marketing_recommendations")
    .update({ status: "superseded" })
    .in("id", idsToSupersede);

  if (error) {
    throw new Error(`closeSupersededMarketingRecommendations: failed to close superseded rows (${error.message})`);
  }

  // The count of rows closed is already known from the read above -- no need to trust
  // (or wait on) whatever the update's own response shape happens to return.
  return idsToSupersede.length;
}

export async function getMarketingRecommendationsForUser(
  supabase: SupabaseClient,
  userId: string,
  options?: { status?: RecommendationStatus; limit?: number }
): Promise<MarketingRecommendation[]> {
  let query = supabase
    .from("marketing_recommendations")
    .select("*")
    .eq("user_id", userId)
    .order("priority_score", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(options?.limit ?? 100);

  if (options?.status) {
    query = query.eq("status", options.status);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`getMarketingRecommendationsForUser: failed to read recommendations (${error.message})`);
  }

  return (data ?? []).map((row) => mapRecommendation(row as Record<string, unknown>));
}

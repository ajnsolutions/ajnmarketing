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
 * overwrite with fresh scoring and reopen if it had been superseded. "dismissed",
 * "completed", and "in_progress" represent user/system progress that regeneration must
 * not silently undo (in_progress means a draft already exists).
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

/**
 * Active (open / in_progress) recommendations for one user, filtered at the query
 * level rather than fetched-then-filtered. This matters: getMarketingRecommendationsForUser
 * caps at a row limit across ALL statuses, so a tenant with enough historical
 * dismissed/completed/superseded rows could have genuinely-active recommendations
 * pushed outside that cap before an in-memory filter ever saw them. Filtering status
 * in SQL means the cap (if any is ever added here) only ever competes among active
 * rows, so an active recommendation can never be silently hidden by inactive history.
 * No limit is applied — at most one recommendation exists per action type per business
 * (8 possible action types), so the active set is inherently small and bounded,
 * mirroring getActiveMarketingOpportunitiesForUser's same no-limit precedent.
 */
export async function getActiveMarketingRecommendationsForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<MarketingRecommendation[]> {
  const { data, error } = await supabase
    .from("marketing_recommendations")
    .select("*")
    .eq("user_id", userId)
    .in("status", ["open", "in_progress"])
    .order("priority_score", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(
      `getActiveMarketingRecommendationsForUser: failed to read recommendations (${error.message})`
    );
  }

  return (data ?? []).map((row) => mapRecommendation(row as Record<string, unknown>));
}

export async function getMarketingRecommendationByIdForUser(
  supabase: SupabaseClient,
  userId: string,
  recommendationId: string
): Promise<MarketingRecommendation | null> {
  const { data, error } = await supabase
    .from("marketing_recommendations")
    .select("*")
    .eq("user_id", userId)
    .eq("id", recommendationId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `getMarketingRecommendationByIdForUser: failed to read recommendation (${error.message})`
    );
  }

  if (!data) return null;
  return mapRecommendation(data as Record<string, unknown>);
}

/**
 * Moves open → in_progress after a draft is persisted. Never touches dismissed,
 * completed, or superseded rows. Idempotent if already in_progress.
 */
export async function markMarketingRecommendationInProgress(
  supabase: SupabaseClient,
  userId: string,
  recommendationId: string
): Promise<MarketingRecommendation | null> {
  const existing = await getMarketingRecommendationByIdForUser(supabase, userId, recommendationId);
  if (!existing) return null;

  if (existing.status === "in_progress") {
    return existing;
  }

  if (existing.status !== "open") {
    return existing;
  }

  const { data, error } = await supabase
    .from("marketing_recommendations")
    .update({ status: "in_progress" })
    .eq("user_id", userId)
    .eq("id", recommendationId)
    .eq("status", "open")
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(
      `markMarketingRecommendationInProgress: failed to update status (${error.message})`
    );
  }

  if (!data) {
    // Race: another writer changed status; re-read and return current row.
    return getMarketingRecommendationByIdForUser(supabase, userId, recommendationId);
  }

  return mapRecommendation(data as Record<string, unknown>);
}

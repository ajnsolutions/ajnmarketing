import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  MarketingOpportunity,
  MarketingOpportunityDraft,
  OpportunityCategory,
  OpportunityStatus,
} from "@/lib/marketing-opportunities/types";

function mapOpportunity(row: Record<string, unknown>): MarketingOpportunity {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    business_profile_id: String(row.business_profile_id),
    category: row.category as OpportunityCategory,
    severity: row.severity as MarketingOpportunity["severity"],
    confidence: Number(row.confidence ?? 0),
    title: String(row.title),
    description: String(row.description ?? ""),
    evidence: (row.evidence as Record<string, unknown>) ?? {},
    recommended_action: String(row.recommended_action ?? ""),
    expires_at: row.expires_at == null ? null : String(row.expires_at),
    status: row.status as OpportunityStatus,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

/**
 * Statuses that represent "the user hasn't acted on this yet" — re-detecting an
 * opportunity in one of these states is safe to overwrite with fresh evidence and
 * re-open if it had expired. Statuses NOT in this set (dismissed, resolved, in_progress)
 * represent a user decision that re-detection must not silently undo.
 */
const REOPENABLE_STATUSES = new Set<OpportunityStatus>(["open", "expired"]);

/**
 * Idempotent upsert: creates a new opportunity, or updates the existing one identified
 * by (userId, businessProfileId, category, draft.dedupeKey) with fresh evidence,
 * confidence, description, and expiry — without duplicating rows and without silently
 * reopening an opportunity the user already dismissed or resolved. This is the only
 * write path detectors should go through; detectors themselves never touch the database.
 */
export async function upsertMarketingOpportunity(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
  draft: MarketingOpportunityDraft
): Promise<MarketingOpportunity> {
  const { data: existing, error: lookupError } = await supabase
    .from("marketing_opportunities")
    .select("id, status")
    .eq("user_id", userId)
    .eq("business_profile_id", businessProfileId)
    .eq("category", draft.category)
    .eq("dedupe_key", draft.dedupeKey)
    .maybeSingle();

  if (lookupError) {
    throw new Error(
      `upsertMarketingOpportunity: failed to look up existing opportunity (${lookupError.message ?? lookupError})`
    );
  }

  const nextStatus: OpportunityStatus =
    !existing || REOPENABLE_STATUSES.has(existing.status as OpportunityStatus)
      ? "open"
      : (existing.status as OpportunityStatus);

  const { data, error } = await supabase
    .from("marketing_opportunities")
    .upsert(
      {
        user_id: userId,
        business_profile_id: businessProfileId,
        category: draft.category,
        severity: draft.severity,
        confidence: draft.confidence,
        title: draft.title,
        description: draft.description,
        evidence: draft.evidence,
        recommended_action: draft.recommendedAction,
        expires_at: draft.expiresAt,
        dedupe_key: draft.dedupeKey,
        status: nextStatus,
      },
      { onConflict: "user_id,business_profile_id,category,dedupe_key" }
    )
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      `upsertMarketingOpportunity: failed to write opportunity (${error?.message ?? "no row returned"})`
    );
  }

  return mapOpportunity(data as Record<string, unknown>);
}

/**
 * Closes (status -> "expired") every currently-open opportunity whose expires_at has
 * passed. Safe to call repeatedly; only ever moves open -> expired, never touches
 * dismissed/resolved/in_progress rows. Returns the number of rows closed.
 */
export async function closeExpiredMarketingOpportunities(
  supabase: SupabaseClient,
  userId: string,
  now: Date = new Date()
): Promise<number> {
  const { data, error } = await supabase
    .from("marketing_opportunities")
    .update({ status: "expired" })
    .eq("user_id", userId)
    .eq("status", "open")
    // SQL NULL comparisons are never true, so .lt() already excludes rows with a null
    // expires_at (an opportunity with no time window never auto-expires) with no need
    // for a separate "is not null" filter.
    .lt("expires_at", now.toISOString())
    .select("id");

  if (error) {
    throw new Error(`closeExpiredMarketingOpportunities: failed to close expired rows (${error.message})`);
  }

  return data?.length ?? 0;
}

/**
 * Opportunities eligible for the Marketing Decision Engine to act on: "open" or
 * "in_progress" only. Explicitly excludes dismissed, resolved, and expired
 * opportunities — the decision engine (lib/marketing-decisions/) must never generate a
 * recommendation from an opportunity the user already dismissed/resolved or that's no
 * longer relevant.
 */
export async function getActiveMarketingOpportunitiesForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<MarketingOpportunity[]> {
  const { data, error } = await supabase
    .from("marketing_opportunities")
    .select("*")
    .eq("user_id", userId)
    .in("status", ["open", "in_progress"]);

  if (error) {
    throw new Error(`getActiveMarketingOpportunitiesForUser: failed to read opportunities (${error.message})`);
  }

  return (data ?? []).map((row) => mapOpportunity(row as Record<string, unknown>));
}

export async function getMarketingOpportunitiesForUser(
  supabase: SupabaseClient,
  userId: string,
  options?: { status?: OpportunityStatus; limit?: number }
): Promise<MarketingOpportunity[]> {
  let query = supabase
    .from("marketing_opportunities")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(options?.limit ?? 100);

  if (options?.status) {
    query = query.eq("status", options.status);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`getMarketingOpportunitiesForUser: failed to read opportunities (${error.message})`);
  }

  return (data ?? []).map((row) => mapOpportunity(row as Record<string, unknown>));
}

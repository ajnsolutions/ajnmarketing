/**
 * Batched Supabase access for marketing_memory_decision_links.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  DecisionSnapshotStatus,
  IgnoredEvidenceEntry,
  MarketingDirectorDecisionSnapshot,
} from "@/lib/decision-intelligence/types";
import type { MarketingDirectorDecisionType } from "@/lib/marketing-director/types";
import type { HeadOfMarketingPrimaryActionKind } from "@/lib/head-of-marketing/types";

const UNIQUE_VIOLATION = "23505";

export type DecisionSnapshotDraft = {
  decision_type: MarketingDirectorDecisionType;
  title: string;
  customer_summary: string;
  priority_rank: number;
  action_type: HeadOfMarketingPrimaryActionKind | null;
  source_recommendation_id: string | null;
  source_campaign_id: string | null;
  consulted_learning_ids: string[];
  consulted_preference_ids: string[];
  ignored_evidence: IgnoredEvidenceEntry[];
  was_cold_start: boolean;
  input_fingerprint: string;
  evaluated_at: string;
  supersedes_decision_id: string | null;
};

function mapSnapshotRow(row: Record<string, unknown>): MarketingDirectorDecisionSnapshot {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    business_profile_id: String(row.business_profile_id),
    decision_type: row.decision_type as MarketingDirectorDecisionType,
    title: String(row.title),
    customer_summary: String(row.customer_summary),
    priority_rank: Number(row.priority_rank ?? 0),
    action_type: (row.action_type as HeadOfMarketingPrimaryActionKind | null) ?? null,
    source_recommendation_id: row.source_recommendation_id ? String(row.source_recommendation_id) : null,
    source_campaign_id: row.source_campaign_id ? String(row.source_campaign_id) : null,
    consulted_learning_ids: (row.consulted_learning_ids as string[]) ?? [],
    consulted_preference_ids: (row.consulted_preference_ids as string[]) ?? [],
    ignored_evidence: (row.ignored_evidence as IgnoredEvidenceEntry[]) ?? [],
    was_cold_start: Boolean(row.was_cold_start),
    decision_status: row.decision_status as DecisionSnapshotStatus,
    evidence_version: Number(row.evidence_version ?? 1),
    input_fingerprint: String(row.input_fingerprint),
    supersedes_decision_id: row.supersedes_decision_id ? String(row.supersedes_decision_id) : null,
    evaluated_at: String(row.evaluated_at),
    created_at: String(row.created_at),
  };
}

/**
 * Idempotent insert: identical (business_profile_id, input_fingerprint) returns the
 * already-existing row rather than erroring or duplicating — matching the "get-or-create
 * reused per business" pattern established for marketing_memory_context_snapshots.
 */
export async function recordDecisionSnapshot(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
  draft: DecisionSnapshotDraft,
): Promise<{ snapshot: MarketingDirectorDecisionSnapshot | null; error: { message?: string } | null }> {
  const { data, error } = await supabase
    .from("marketing_memory_decision_links")
    .insert({
      user_id: userId,
      business_profile_id: businessProfileId,
      decision_type: draft.decision_type,
      title: draft.title,
      customer_summary: draft.customer_summary,
      priority_rank: draft.priority_rank,
      action_type: draft.action_type,
      source_recommendation_id: draft.source_recommendation_id,
      source_campaign_id: draft.source_campaign_id,
      consulted_learning_ids: draft.consulted_learning_ids,
      consulted_preference_ids: draft.consulted_preference_ids,
      ignored_evidence: draft.ignored_evidence,
      was_cold_start: draft.was_cold_start,
      input_fingerprint: draft.input_fingerprint,
      evaluated_at: draft.evaluated_at,
      supersedes_decision_id: draft.supersedes_decision_id,
    })
    .select("*")
    .single();

  if (!error && data) {
    return { snapshot: mapSnapshotRow(data as Record<string, unknown>), error: null };
  }

  if (error && (error as { code?: string }).code === UNIQUE_VIOLATION) {
    const { data: existing, error: lookupError } = await supabase
      .from("marketing_memory_decision_links")
      .select("*")
      .eq("business_profile_id", businessProfileId)
      .eq("input_fingerprint", draft.input_fingerprint)
      .maybeSingle();
    if (existing) {
      return { snapshot: mapSnapshotRow(existing as Record<string, unknown>), error: null };
    }
    return { snapshot: null, error: lookupError ?? { message: "Duplicate fingerprint but lookup failed" } };
  }

  return { snapshot: null, error: error ?? { message: "No row returned" } };
}

export async function getLatestActiveDecisionSnapshot(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
): Promise<MarketingDirectorDecisionSnapshot | null> {
  const { data, error } = await supabase
    .from("marketing_memory_decision_links")
    .select("*")
    .eq("user_id", userId)
    .eq("business_profile_id", businessProfileId)
    .eq("decision_status", "active")
    .order("evaluated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return mapSnapshotRow(data as Record<string, unknown>);
}

const MAX_HISTORY_LIMIT = 200;

export async function listDecisionSnapshotsForBusiness(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
  options: { start?: string; end?: string; limit?: number } = {},
): Promise<MarketingDirectorDecisionSnapshot[]> {
  let query = supabase
    .from("marketing_memory_decision_links")
    .select("*")
    .eq("user_id", userId)
    .eq("business_profile_id", businessProfileId)
    .order("evaluated_at", { ascending: false })
    .limit(Math.min(options.limit ?? 50, MAX_HISTORY_LIMIT));

  if (options.start) query = query.gte("evaluated_at", options.start);
  if (options.end) query = query.lte("evaluated_at", options.end);

  const { data, error } = await query;
  if (error || !data) return [];
  return data.map((row: Record<string, unknown>) => mapSnapshotRow(row));
}

export async function getDecisionSnapshotForUser(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
  snapshotId: string,
): Promise<MarketingDirectorDecisionSnapshot | null> {
  const { data, error } = await supabase
    .from("marketing_memory_decision_links")
    .select("*")
    .eq("user_id", userId)
    .eq("business_profile_id", businessProfileId)
    .eq("id", snapshotId)
    .maybeSingle();

  if (error || !data) return null;
  return mapSnapshotRow(data as Record<string, unknown>);
}

/** The snapshot immediately before the given one, by evaluated_at — for "current vs previous". */
export async function getPreviousDecisionSnapshot(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
  beforeEvaluatedAt: string,
): Promise<MarketingDirectorDecisionSnapshot | null> {
  const { data, error } = await supabase
    .from("marketing_memory_decision_links")
    .select("*")
    .eq("user_id", userId)
    .eq("business_profile_id", businessProfileId)
    .lt("evaluated_at", beforeEvaluatedAt)
    .order("evaluated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return mapSnapshotRow(data as Record<string, unknown>);
}

export async function supersedeDecisionSnapshot(
  supabase: SupabaseClient,
  userId: string,
  snapshotId: string,
): Promise<void> {
  await supabase
    .from("marketing_memory_decision_links")
    .update({ decision_status: "superseded" })
    .eq("id", snapshotId)
    .eq("user_id", userId)
    .eq("decision_status", "active");
}

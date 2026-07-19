import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { buildOverrideIdempotencyKey } from "@/lib/marketing-memory/preferenceIdempotency";
import type {
  MarketingMemoryOverride,
  OverrideType,
  RecordOverrideInput,
} from "@/lib/marketing-memory/preferenceTypes";

function mapOverrideRow(row: Record<string, unknown>): MarketingMemoryOverride {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    business_profile_id: String(row.business_profile_id),
    decision_link_id: row.decision_link_id == null ? null : String(row.decision_link_id),
    override_type: row.override_type as OverrideType,
    related_learning_id: row.related_learning_id == null ? null : String(row.related_learning_id),
    factor_type: row.factor_type == null ? null : String(row.factor_type),
    factor_value: row.factor_value == null ? null : String(row.factor_value),
    is_permanent: Boolean(row.is_permanent),
    promoted_to_preference_id: row.promoted_to_preference_id
      ? String(row.promoted_to_preference_id)
      : null,
    notes: row.notes == null ? null : String(row.notes),
    created_by: String(row.created_by),
    idempotency_key: String(row.idempotency_key),
    created_at: String(row.created_at),
  };
}

export async function listOverridesForBusiness(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string
): Promise<MarketingMemoryOverride[]> {
  const { data, error } = await supabase
    .from("marketing_memory_overrides")
    .select("*")
    .eq("user_id", userId)
    .eq("business_profile_id", businessProfileId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(mapOverrideRow);
}

export async function findOverrideByIdempotencyKey(
  supabase: SupabaseClient,
  userId: string,
  idempotencyKey: string
): Promise<MarketingMemoryOverride | null> {
  const { data, error } = await supabase
    .from("marketing_memory_overrides")
    .select("*")
    .eq("user_id", userId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (error || !data) return null;
  return mapOverrideRow(data as Record<string, unknown>);
}

export async function insertOverride(
  supabase: SupabaseClient,
  params: {
    userId: string;
    businessProfileId: string;
    actorUserId: string;
    input: RecordOverrideInput;
    createdAt?: Date;
  }
): Promise<MarketingMemoryOverride | null> {
  const createdAt = params.createdAt ?? new Date();
  const createdAtIso = createdAt.toISOString();
  const idempotencyKey = buildOverrideIdempotencyKey({
    businessProfileId: params.businessProfileId,
    overrideType: params.input.overrideType,
    decisionLinkId: params.input.decisionLinkId,
    relatedLearningId: params.input.relatedLearningId,
    factorType: params.input.factorType,
    factorValue: params.input.factorValue,
    clientRequestId: params.input.clientRequestId,
    createdAtIso,
  });

  const existing = await findOverrideByIdempotencyKey(supabase, params.userId, idempotencyKey);
  if (existing) return existing;

  const row = {
    user_id: params.userId,
    business_profile_id: params.businessProfileId,
    decision_link_id: params.input.decisionLinkId ?? null,
    override_type: params.input.overrideType,
    related_learning_id: params.input.relatedLearningId ?? null,
    factor_type: params.input.factorType ?? null,
    factor_value: params.input.factorValue ?? null,
    is_permanent: params.input.isPermanent ?? false,
    promoted_to_preference_id: null,
    notes: params.input.notes ?? null,
    created_by: params.actorUserId,
    idempotency_key: idempotencyKey,
    created_at: createdAtIso,
  };

  const { data, error } = await supabase
    .from("marketing_memory_overrides")
    .insert(row)
    .select("*")
    .single();

  if (error || !data) {
    // Unique race: another writer won — return the existing row if present.
    const raced = await findOverrideByIdempotencyKey(supabase, params.userId, idempotencyKey);
    return raced;
  }

  return mapOverrideRow(data as Record<string, unknown>);
}

export async function linkOverrideToPreference(
  supabase: SupabaseClient,
  userId: string,
  overrideId: string,
  preferenceId: string
): Promise<MarketingMemoryOverride | null> {
  const { data, error } = await supabase
    .from("marketing_memory_overrides")
    .update({ promoted_to_preference_id: preferenceId })
    .eq("id", overrideId)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();

  // Overrides are append-only by RLS policy — update may be denied under anon RLS.
  // Service-role / owner policies in this app use the user-scoped client which has
  // select+insert only. Promotion linking is therefore done only when an update policy
  // exists; if update is blocked, we still keep promoted_from_override_id on the
  // preference row as the authoritative promotion audit link.
  if (error || !data) return null;
  return mapOverrideRow(data as Record<string, unknown>);
}

/**
 * Optional contradicting evidence citation when a customer marks a Learning incorrect.
 * Best-effort: failure never blocks override recording. Uses learning-anchored
 * evidence_links shape from Phase 2.
 */
export async function linkOverrideAsContradictingEvidence(
  supabase: SupabaseClient,
  params: {
    userId: string;
    businessProfileId: string;
    learningId: string;
    overrideId: string;
  }
): Promise<boolean> {
  const idempotencyKey = `${params.learningId}:override:${params.overrideId}`;
  const { error } = await supabase.from("marketing_memory_evidence_links").upsert(
    {
      user_id: params.userId,
      business_profile_id: params.businessProfileId,
      observation_id: null,
      learning_id: params.learningId,
      source_type: "override",
      source_id: params.overrideId,
      link_type: null,
      contribution: "contradicting",
      idempotency_key: idempotencyKey,
    },
    { onConflict: "idempotency_key", ignoreDuplicates: true }
  );

  return !error;
}

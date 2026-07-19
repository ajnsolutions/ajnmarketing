import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  MarketingMemoryPreference,
  MarketingMemoryPreferenceSummary,
  PreferenceSource,
  PreferenceType,
  UpsertPreferenceInput,
} from "@/lib/marketing-memory/preferenceTypes";
import { PreferenceSources } from "@/lib/marketing-memory/preferenceTypes";
import { defaultInstructionText } from "@/lib/marketing-memory/preferenceValidation";

function mapPreferenceRow(row: Record<string, unknown>): MarketingMemoryPreference {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    business_profile_id: String(row.business_profile_id),
    preference_type: row.preference_type as PreferenceType,
    factor_type: row.factor_type == null ? null : String(row.factor_type),
    factor_value: row.factor_value == null ? null : String(row.factor_value),
    instruction_text: String(row.instruction_text),
    is_active: Boolean(row.is_active),
    active_until: row.active_until == null ? null : String(row.active_until),
    source: row.source as PreferenceSource,
    promoted_from_override_id: row.promoted_from_override_id
      ? String(row.promoted_from_override_id)
      : null,
    supersedes_preference_id: row.supersedes_preference_id
      ? String(row.supersedes_preference_id)
      : null,
    created_by: String(row.created_by),
    updated_by: row.updated_by == null ? null : String(row.updated_by),
    schema_version: Number(row.schema_version ?? 1),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export function toPreferenceSummary(
  preference: MarketingMemoryPreference
): MarketingMemoryPreferenceSummary {
  return {
    id: preference.id,
    preferenceType: preference.preference_type,
    factorType: preference.factor_type,
    factorValue: preference.factor_value,
    instructionText: preference.instruction_text,
    source: preference.source,
    isActive: preference.is_active,
    activeUntil: preference.active_until,
    confidenceLabel: "confirmed_preference",
  };
}

export async function listPreferencesForBusiness(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
  options: { activeOnly?: boolean } = {}
): Promise<MarketingMemoryPreference[]> {
  let query = supabase
    .from("marketing_memory_preferences")
    .select("*")
    .eq("user_id", userId)
    .eq("business_profile_id", businessProfileId)
    .order("created_at", { ascending: false });

  if (options.activeOnly) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(mapPreferenceRow);
}

export async function findActivePreferenceByIdentity(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
  preferenceType: PreferenceType,
  factorType: string | null,
  factorValue: string | null
): Promise<MarketingMemoryPreference | null> {
  let query = supabase
    .from("marketing_memory_preferences")
    .select("*")
    .eq("user_id", userId)
    .eq("business_profile_id", businessProfileId)
    .eq("preference_type", preferenceType)
    .eq("is_active", true)
    .limit(1);

  if (factorType == null) {
    query = query.is("factor_type", null);
  } else {
    query = query.eq("factor_type", factorType);
  }

  if (factorValue == null) {
    query = query.is("factor_value", null);
  } else {
    query = query.eq("factor_value", factorValue);
  }

  const { data, error } = await query.maybeSingle();
  if (error || !data) return null;
  return mapPreferenceRow(data as Record<string, unknown>);
}

export async function deactivatePreference(
  supabase: SupabaseClient,
  userId: string,
  preferenceId: string,
  updatedBy: string,
  activeUntilIso?: string | null
): Promise<MarketingMemoryPreference | null> {
  const { data, error } = await supabase
    .from("marketing_memory_preferences")
    .update({
      is_active: false,
      updated_by: updatedBy,
      ...(activeUntilIso !== undefined ? { active_until: activeUntilIso } : {}),
    })
    .eq("id", preferenceId)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();

  if (error || !data) return null;
  return mapPreferenceRow(data as Record<string, unknown>);
}

export type InsertPreferenceParams = {
  userId: string;
  businessProfileId: string;
  actorUserId: string;
  input: UpsertPreferenceInput;
  source?: PreferenceSource;
  promotedFromOverrideId?: string | null;
  supersedesPreferenceId?: string | null;
};

export async function insertPreference(
  supabase: SupabaseClient,
  params: InsertPreferenceParams
): Promise<MarketingMemoryPreference | null> {
  const instructionText = defaultInstructionText(params.input);
  // custom preferences are not "one of a kind" — give each a unique factor_value so the
  // live partial unique index can hold multiple active custom instructions.
  const factorValue =
    params.input.preferenceType === "custom"
      ? params.input.factorValue ?? `custom:${crypto.randomUUID()}`
      : params.input.factorValue ?? null;
  const row = {
    user_id: params.userId,
    business_profile_id: params.businessProfileId,
    preference_type: params.input.preferenceType,
    factor_type: params.input.factorType ?? null,
    factor_value: factorValue,
    instruction_text: instructionText,
    is_active: true,
    active_until: params.input.activeUntil ?? null,
    source: params.source ?? PreferenceSources.EXPLICIT_STATEMENT,
    promoted_from_override_id: params.promotedFromOverrideId ?? null,
    supersedes_preference_id: params.supersedesPreferenceId ?? null,
    created_by: params.actorUserId,
    updated_by: params.actorUserId,
    schema_version: 1,
  };

  const { data, error } = await supabase
    .from("marketing_memory_preferences")
    .insert(row)
    .select("*")
    .single();

  if (error || !data) return null;
  return mapPreferenceRow(data as Record<string, unknown>);
}

/**
 * Soft-supersede: deactivate the live preference of the same identity (if any), then
 * insert a new active row linked via supersedes_preference_id. Preserves audit history
 * of the prior instruction_text instead of rewriting it in place.
 */
export async function upsertPreferenceWithSupersession(
  supabase: SupabaseClient,
  params: InsertPreferenceParams
): Promise<{ preference: MarketingMemoryPreference | null; supersededId: string | null }> {
  // custom rows do not supersede each other by identity — each statement is additive.
  if (params.input.preferenceType === "custom") {
    const preference = await insertPreference(supabase, params);
    return { preference, supersededId: null };
  }

  const existing = await findActivePreferenceByIdentity(
    supabase,
    params.userId,
    params.businessProfileId,
    params.input.preferenceType,
    params.input.factorType ?? null,
    params.input.factorValue ?? null
  );

  let supersededId: string | null = null;
  if (existing) {
    // Identical active instruction — idempotent no-op (no duplicate row).
    if (
      existing.instruction_text === defaultInstructionText(params.input) &&
      (existing.active_until ?? null) === (params.input.activeUntil ?? null) &&
      (params.source ?? PreferenceSources.EXPLICIT_STATEMENT) === existing.source
    ) {
      return { preference: existing, supersededId: null };
    }

    const deactivated = await deactivatePreference(
      supabase,
      params.userId,
      existing.id,
      params.actorUserId,
      params.input.activeUntil ?? existing.active_until
    );
    if (!deactivated) {
      return { preference: null, supersededId: null };
    }
    supersededId = existing.id;
  }

  const preference = await insertPreference(supabase, {
    ...params,
    supersedesPreferenceId: supersededId ?? params.supersedesPreferenceId ?? null,
  });

  return { preference, supersededId };
}

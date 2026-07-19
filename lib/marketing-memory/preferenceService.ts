import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  listDisabledContextCategories,
  sortPreferenceSummariesForPrecedence,
} from "@/lib/marketing-memory/preferencePrecedence";
import {
  deactivatePreference,
  listPreferencesForBusiness,
  toPreferenceSummary,
  upsertPreferenceWithSupersession,
} from "@/lib/marketing-memory/preferencePersistence";
import type {
  MarketingMemoryPreference,
  MarketingMemoryPreferenceSummary,
  UpsertPreferenceInput,
} from "@/lib/marketing-memory/preferenceTypes";
import {
  defaultInstructionText,
  validateUpsertPreferenceInput,
} from "@/lib/marketing-memory/preferenceValidation";

export type PreferenceServiceResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; status: number };

async function resolveClient(supabaseClient?: SupabaseClient): Promise<SupabaseClient> {
  return supabaseClient ?? (await createClient());
}

/**
 * Lists preferences for a business. Active-first precedence sort is applied to the
 * summary view used by APIs — not consulted by Marketing Director in this phase.
 */
export async function getPreferencesForBusiness(
  userId: string,
  businessProfileId: string,
  options: { activeOnly?: boolean; supabaseClient?: SupabaseClient } = {}
): Promise<{
  preferences: MarketingMemoryPreference[];
  summaries: MarketingMemoryPreferenceSummary[];
  disabledContextCategories: string[];
}> {
  const supabase = await resolveClient(options.supabaseClient);
  const preferences = await listPreferencesForBusiness(
    supabase,
    userId,
    businessProfileId,
    { activeOnly: options.activeOnly }
  );
  const summaries = sortPreferenceSummariesForPrecedence(preferences.map(toPreferenceSummary));
  return {
    preferences,
    summaries,
    disabledContextCategories: listDisabledContextCategories(summaries),
  };
}

export async function upsertPreferenceForBusiness(
  userId: string,
  businessProfileId: string,
  body: unknown,
  options: { supabaseClient?: SupabaseClient; actorUserId?: string } = {}
): Promise<PreferenceServiceResult<MarketingMemoryPreference>> {
  const parsed = validateUpsertPreferenceInput(body);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error, status: 400 };
  }

  const input: UpsertPreferenceInput = {
    ...parsed.value,
    instructionText: defaultInstructionText(parsed.value),
  };

  const supabase = await resolveClient(options.supabaseClient);
  const actorUserId = options.actorUserId ?? userId;

  const { preference } = await upsertPreferenceWithSupersession(supabase, {
    userId,
    businessProfileId,
    actorUserId,
    input,
  });

  if (!preference) {
    return { ok: false, error: "Failed to save preference", status: 500 };
  }

  return { ok: true, value: preference };
}

export async function deactivatePreferenceForBusiness(
  userId: string,
  preferenceId: string,
  options: { supabaseClient?: SupabaseClient; actorUserId?: string; activeUntil?: string | null } = {}
): Promise<PreferenceServiceResult<MarketingMemoryPreference>> {
  if (!preferenceId.trim()) {
    return { ok: false, error: "preference id is required", status: 400 };
  }

  const supabase = await resolveClient(options.supabaseClient);
  const actorUserId = options.actorUserId ?? userId;
  const preference = await deactivatePreference(
    supabase,
    userId,
    preferenceId.trim(),
    actorUserId,
    options.activeUntil
  );

  if (!preference) {
    return { ok: false, error: "Preference not found", status: 404 };
  }

  return { ok: true, value: preference };
}

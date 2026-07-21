/**
 * Persistence for non-derivable customer setup preferences only.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isSetupStepKey } from "@/lib/customer-setup/steps";
import type {
  CustomerSetupPreferences,
  SetupStepKey,
} from "@/lib/customer-setup/types";

function normalizeStepKeys(keys: unknown): SetupStepKey[] {
  if (!Array.isArray(keys)) return [];
  const unique = new Set<SetupStepKey>();
  for (const key of keys) {
    if (typeof key === "string" && isSetupStepKey(key)) {
      unique.add(key);
    }
  }
  return [...unique];
}

function mapRow(row: Record<string, unknown>): CustomerSetupPreferences {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    business_profile_id: String(row.business_profile_id),
    skipped_step_keys: normalizeStepKeys(row.skipped_step_keys),
    acknowledged_step_keys: normalizeStepKeys(row.acknowledged_step_keys),
    onboarding_dismissed_at:
      typeof row.onboarding_dismissed_at === "string" ? row.onboarding_dismissed_at : null,
    setup_completed_acknowledged_at:
      typeof row.setup_completed_acknowledged_at === "string"
        ? row.setup_completed_acknowledged_at
        : null,
    last_visited_step_key:
      typeof row.last_visited_step_key === "string" && isSetupStepKey(row.last_visited_step_key)
        ? row.last_visited_step_key
        : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function getCustomerSetupPreferences(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
): Promise<CustomerSetupPreferences | null> {
  const { data, error } = await supabase
    .from("customer_setup_preferences")
    .select("*")
    .eq("user_id", userId)
    .eq("business_profile_id", businessProfileId)
    .maybeSingle();

  if (error || !data) return null;
  return mapRow(data as Record<string, unknown>);
}

async function upsertPreferences(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
  patch: {
    skipped_step_keys?: SetupStepKey[];
    acknowledged_step_keys?: SetupStepKey[];
    onboarding_dismissed_at?: string | null;
    setup_completed_acknowledged_at?: string | null;
    last_visited_step_key?: SetupStepKey | null;
  },
): Promise<{ ok: true; value: CustomerSetupPreferences } | { ok: false; error: string; status: number }> {
  const existing = await getCustomerSetupPreferences(supabase, userId, businessProfileId);
  const payload = {
    user_id: userId,
    business_profile_id: businessProfileId,
    skipped_step_keys: patch.skipped_step_keys ?? existing?.skipped_step_keys ?? [],
    acknowledged_step_keys:
      patch.acknowledged_step_keys ?? existing?.acknowledged_step_keys ?? [],
    onboarding_dismissed_at:
      patch.onboarding_dismissed_at !== undefined
        ? patch.onboarding_dismissed_at
        : (existing?.onboarding_dismissed_at ?? null),
    setup_completed_acknowledged_at:
      patch.setup_completed_acknowledged_at !== undefined
        ? patch.setup_completed_acknowledged_at
        : (existing?.setup_completed_acknowledged_at ?? null),
    last_visited_step_key:
      patch.last_visited_step_key !== undefined
        ? patch.last_visited_step_key
        : (existing?.last_visited_step_key ?? null),
  };

  const { data, error } = await supabase
    .from("customer_setup_preferences")
    .upsert(payload, { onConflict: "business_profile_id" })
    .select("*")
    .single();

  if (error || !data) {
    return { ok: false, error: "Unable to save setup preferences.", status: 500 };
  }

  return { ok: true, value: mapRow(data as Record<string, unknown>) };
}

export async function skipSetupStep(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
  stepKey: SetupStepKey,
): Promise<{ ok: true; value: CustomerSetupPreferences } | { ok: false; error: string; status: number }> {
  const existing = await getCustomerSetupPreferences(supabase, userId, businessProfileId);
  const skipped = new Set(existing?.skipped_step_keys ?? []);
  skipped.add(stepKey);
  return upsertPreferences(supabase, userId, businessProfileId, {
    skipped_step_keys: [...skipped],
    last_visited_step_key: stepKey,
  });
}

export async function acknowledgeSetupStep(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
  stepKey: SetupStepKey,
): Promise<{ ok: true; value: CustomerSetupPreferences } | { ok: false; error: string; status: number }> {
  const existing = await getCustomerSetupPreferences(supabase, userId, businessProfileId);
  const acknowledged = new Set(existing?.acknowledged_step_keys ?? []);
  acknowledged.add(stepKey);
  return upsertPreferences(supabase, userId, businessProfileId, {
    acknowledged_step_keys: [...acknowledged],
    last_visited_step_key: stepKey,
  });
}

export async function updateCustomerSetupPreferences(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
  patch: {
    dismissOnboarding?: boolean;
    acknowledgeCompletion?: boolean;
    lastVisitedStepKey?: SetupStepKey | null;
    clearDismiss?: boolean;
  },
): Promise<{ ok: true; value: CustomerSetupPreferences } | { ok: false; error: string; status: number }> {
  const now = new Date().toISOString();
  return upsertPreferences(supabase, userId, businessProfileId, {
    onboarding_dismissed_at: patch.clearDismiss
      ? null
      : patch.dismissOnboarding
        ? now
        : undefined,
    setup_completed_acknowledged_at: patch.acknowledgeCompletion ? now : undefined,
    last_visited_step_key: patch.lastVisitedStepKey,
  });
}

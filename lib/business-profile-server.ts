import type { BusinessProfile, BusinessProfileUpsert } from "@/lib/business-profile";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Explicit userId + injected-client variant. Despite the name of the
 * `*ForUser` sibling below, that one is actually current-session-bound —
 * this is the one to call from anywhere that already has a userId and a
 * client in hand (including privileged/scheduled execution), so the same
 * user isn't re-authenticated a second time via a second client.
 */
export async function getBusinessProfileForUserId(
  supabase: SupabaseClient,
  userId: string
): Promise<BusinessProfile | null> {
  const { data, error } = await supabase
    .from("business_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;

  return data as BusinessProfile;
}

export async function getBusinessProfileForUser(): Promise<BusinessProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return getBusinessProfileForUserId(supabase, user.id);
}

export async function isOnboardingCompleteForUser(): Promise<boolean> {
  const profile = await getBusinessProfileForUser();
  return profile?.onboarding_completed === true;
}

/**
 * Updates a narrow set of existing columns on an existing business_profiles
 * row (never a full-row upsert — this exists specifically for the snapshot
 * continuation flow's confirmed-fact persistence, see
 * lib/business-discovery/continuation/applyConfirmations.ts, which only ever
 * durably maps one field, primary_services, onto this table).
 *
 * Deliberately an UPDATE, not an upsert: if no profile row exists yet for
 * this user, this is a harmless no-op (0 rows affected) rather than an
 * attempt to insert a partial row that could violate other NOT NULL
 * constraints on this table.
 */
export async function updateBusinessProfileFieldsForUserId(
  supabase: SupabaseClient,
  userId: string,
  fields: Partial<BusinessProfileUpsert>
): Promise<{ error: string | null }> {
  if (Object.keys(fields).length === 0) return { error: null };

  const { error } = await supabase.from("business_profiles").update(fields).eq("user_id", userId);
  return { error: error?.message ?? null };
}

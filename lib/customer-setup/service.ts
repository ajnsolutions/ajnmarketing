/**
 * Customer setup orchestration — compose facts + preferences into a snapshot.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getBusinessProfileForUserId } from "@/lib/business-profile-server";
import {
  computeCustomerSetupSnapshot,
  shouldShowDashboardSetupCard,
} from "@/lib/customer-setup/progress";
import {
  acknowledgeSetupStep,
  getCustomerSetupPreferences,
  skipSetupStep,
  updateCustomerSetupPreferences,
} from "@/lib/customer-setup/persistence";
import {
  assertStepCanAcknowledge,
  assertStepCanSkip,
  parseSetupPreferencesBody,
  parseSetupStepKeyBody,
} from "@/lib/customer-setup/request";
import { gatherCustomerSetupFacts } from "@/lib/customer-setup/sources";
import type { CustomerSetupSnapshot } from "@/lib/customer-setup/types";
import { createClient } from "@/lib/supabase/server";

export { shouldShowDashboardSetupCard };

export async function getCustomerSetupSnapshotForUser(
  userId: string,
  options?: { supabaseClient?: SupabaseClient },
): Promise<CustomerSetupSnapshot | null> {
  const supabase = options?.supabaseClient ?? (await createClient());
  const profile = await getBusinessProfileForUserId(supabase, userId);
  if (!profile) return null;

  const [{ facts, warnings }, preferences] = await Promise.all([
    gatherCustomerSetupFacts(supabase, userId, profile),
    getCustomerSetupPreferences(supabase, userId, profile.id),
  ]);

  return computeCustomerSetupSnapshot({
    businessProfileId: profile.id,
    facts,
    preferences,
    warnings,
  });
}

export async function getCustomerSetupSnapshotForCurrentUser(): Promise<CustomerSetupSnapshot | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return getCustomerSetupSnapshotForUser(user.id, { supabaseClient: supabase });
}

export async function skipCustomerSetupStepForCurrentUser(
  body: unknown,
): Promise<
  | { ok: true; snapshot: CustomerSetupSnapshot }
  | { ok: false; error: string; status: number }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized", status: 401 };

  const parsed = parseSetupStepKeyBody(body);
  if (!parsed.ok) return { ok: false, error: parsed.error, status: 400 };

  const canSkip = assertStepCanSkip(parsed.stepKey);
  if (!canSkip.ok) return { ok: false, error: canSkip.error, status: 400 };

  const profile = await getBusinessProfileForUserId(supabase, user.id);
  if (!profile) return { ok: false, error: "Business profile not found", status: 404 };

  const write = await skipSetupStep(supabase, user.id, profile.id, parsed.stepKey);
  if (!write.ok) return write;

  const snapshot = await getCustomerSetupSnapshotForUser(user.id, { supabaseClient: supabase });
  if (!snapshot) return { ok: false, error: "Unable to load setup status.", status: 500 };
  return { ok: true, snapshot };
}

export async function acknowledgeCustomerSetupStepForCurrentUser(
  body: unknown,
): Promise<
  | { ok: true; snapshot: CustomerSetupSnapshot }
  | { ok: false; error: string; status: number }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized", status: 401 };

  const parsed = parseSetupStepKeyBody(body);
  if (!parsed.ok) return { ok: false, error: parsed.error, status: 400 };

  const canAck = assertStepCanAcknowledge(parsed.stepKey);
  if (!canAck.ok) return { ok: false, error: canAck.error, status: 400 };

  const profile = await getBusinessProfileForUserId(supabase, user.id);
  if (!profile) return { ok: false, error: "Business profile not found", status: 404 };

  const write = await acknowledgeSetupStep(supabase, user.id, profile.id, parsed.stepKey);
  if (!write.ok) return write;

  const snapshot = await getCustomerSetupSnapshotForUser(user.id, { supabaseClient: supabase });
  if (!snapshot) return { ok: false, error: "Unable to load setup status.", status: 500 };
  return { ok: true, snapshot };
}

export async function updateCustomerSetupPreferencesForCurrentUser(
  body: unknown,
): Promise<
  | { ok: true; snapshot: CustomerSetupSnapshot }
  | { ok: false; error: string; status: number }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized", status: 401 };

  const parsed = parseSetupPreferencesBody(body);
  if (!parsed.ok) return { ok: false, error: parsed.error, status: 400 };

  const profile = await getBusinessProfileForUserId(supabase, user.id);
  if (!profile) return { ok: false, error: "Business profile not found", status: 404 };

  const write = await updateCustomerSetupPreferences(supabase, user.id, profile.id, {
    dismissOnboarding: parsed.dismissOnboarding,
    acknowledgeCompletion: parsed.acknowledgeCompletion,
    lastVisitedStepKey: parsed.lastVisitedStepKey,
    clearDismiss: parsed.clearDismiss,
  });
  if (!write.ok) return write;

  const snapshot = await getCustomerSetupSnapshotForUser(user.id, { supabaseClient: supabase });
  if (!snapshot) return { ok: false, error: "Unable to load setup status.", status: 500 };
  return { ok: true, snapshot };
}

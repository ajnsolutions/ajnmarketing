import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * TRUST BOUNDARY: this is a cross-tenant, privileged query — it reads every onboarded
 * business's user_id regardless of who (if anyone) is signed in. It must only ever be
 * called with an explicitly supplied privileged client (see lib/supabase/service.ts).
 * There is deliberately no default/fallback client here: unlike the request-scoped
 * *ForUser functions elsewhere in this codebase, silently constructing a client inside
 * this function would either (a) accidentally use a privileged client somewhere that
 * shouldn't have one, or (b) accidentally use a request-scoped client that RLS would
 * limit to a single user, making the "cross-tenant" query silently return only one
 * tenant's data with no error — the same silent-failure mode documented in the ADR.
 */

export type AnalyticsEligibilityReason = "never_captured" | "stale_snapshot";

export type AnalyticsEligibleTenant = {
  userId: string;
  businessProfileId: string;
  /**
   * The most recent analytics_snapshots.snapshot_date found for this tenant within the
   * lookback window (see options.lookbackDays), or null if none was found in that window.
   * A null value means "not captured within the lookback window" — for a tenant that was
   * captured further in the past than the window covers, this is functionally equivalent
   * to "not recently captured," which is what matters for scheduling; it is not a claim
   * that the tenant has literally never had a snapshot in its full history.
   */
  lastCapturedAt: string | null;
  reason: AnalyticsEligibilityReason;
};

export type AnalyticsEligibilityOptions = {
  /** Max number of results to return, applied after deterministic sorting. Default 100. */
  limit?: number;
  /**
   * How far back to look for existing snapshots when determining "last captured."
   * Bounded and index-backed (analytics_snapshots' existing unique (user_id, snapshot_date)
   * index) rather than scanning the whole table — stays efficient regardless of how much
   * history has accumulated. Default 14 days.
   */
  lookbackDays?: number;
  /** Override "now" for deterministic testing. Defaults to `new Date()`. */
  now?: Date;
};

const DEFAULT_LIMIT = 100;
const DEFAULT_LOOKBACK_DAYS = 14;

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Returns onboarded businesses due for an analytics capture, oldest-due-first,
 * deterministically ordered. Cadence: a tenant is due if it has no analytics_snapshots
 * row dated today (daily cadence, matching the product's stated cadence for analytics
 * collection). Eligibility requires only `business_profiles.onboarding_completed = true`
 * — a disconnected/revoked/missing-scope Google Business Profile connection does NOT
 * exclude a tenant, because captureSnapshotForUser already degrades gracefully (a
 * zero-filled GBP section) rather than failing when there's no working GBP connection;
 * excluding those tenants here would contradict what the capture path itself already
 * does successfully today.
 *
 * Read-only: never inserts, updates, or deletes any row.
 */
export async function getBusinessesDueForAnalyticsCapture(
  supabase: SupabaseClient,
  options?: AnalyticsEligibilityOptions
): Promise<AnalyticsEligibleTenant[]> {
  const limit = options?.limit ?? DEFAULT_LIMIT;
  const lookbackDays = options?.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
  const now = options?.now ?? new Date();
  const today = toIsoDate(now);

  const lookbackStart = new Date(now);
  lookbackStart.setUTCDate(lookbackStart.getUTCDate() - lookbackDays);
  const lookbackStartIso = toIsoDate(lookbackStart);

  const { data: profiles, error: profilesError } = await supabase
    .from("business_profiles")
    .select("id, user_id")
    .eq("onboarding_completed", true);

  // A query error (bad/insufficiently privileged client, RLS block, network failure) must
  // never be swallowed into "zero tenants are due" — that's indistinguishable from a
  // legitimately quiet day and is exactly the silent-failure mode this function exists to
  // avoid. Only an empty, error-free result means "no one is due."
  if (profilesError) {
    throw new Error(
      `getBusinessesDueForAnalyticsCapture: failed to read business_profiles (${profilesError.message ?? profilesError}). This usually means the supplied client is not privileged enough to bypass RLS for a cross-tenant read.`
    );
  }

  if (!profiles || profiles.length === 0) {
    return [];
  }

  const { data: recentSnapshots, error: snapshotsError } = await supabase
    .from("analytics_snapshots")
    .select("user_id, snapshot_date")
    .gte("snapshot_date", lookbackStartIso)
    .order("snapshot_date", { ascending: false });

  if (snapshotsError) {
    throw new Error(
      `getBusinessesDueForAnalyticsCapture: failed to read analytics_snapshots (${snapshotsError.message ?? snapshotsError}).`
    );
  }

  // Ordered descending, so the first occurrence per user_id within the window is the latest.
  const latestCaptureByUserId = new Map<string, string>();
  for (const row of recentSnapshots ?? []) {
    const userId = String((row as { user_id: unknown }).user_id);
    if (!latestCaptureByUserId.has(userId)) {
      latestCaptureByUserId.set(userId, String((row as { snapshot_date: unknown }).snapshot_date));
    }
  }

  const due: AnalyticsEligibleTenant[] = [];
  for (const profile of profiles as Array<{ id: string; user_id: string }>) {
    const lastCapturedAt = latestCaptureByUserId.get(profile.user_id) ?? null;
    if (lastCapturedAt === today) continue; // already captured today — not due

    due.push({
      userId: profile.user_id,
      businessProfileId: profile.id,
      lastCapturedAt,
      reason: lastCapturedAt ? "stale_snapshot" : "never_captured",
    });
  }

  due.sort((a, b) => {
    // Unknown (never captured within the window) sorts first — most urgent.
    if (a.lastCapturedAt === null && b.lastCapturedAt !== null) return -1;
    if (a.lastCapturedAt !== null && b.lastCapturedAt === null) return 1;
    if (a.lastCapturedAt !== b.lastCapturedAt) {
      return (a.lastCapturedAt ?? "").localeCompare(b.lastCapturedAt ?? "");
    }
    // Deterministic tie-break so equal dates always produce the same order.
    return a.userId.localeCompare(b.userId);
  });

  return due.slice(0, limit);
}

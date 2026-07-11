import "server-only";

import type { AnalyticsEligibleTenant } from "@/lib/analytics/analyticsEligibility";

/**
 * Pure mapping/key-construction logic for fanning a due-tenant list out into per-tenant
 * Trigger.dev task triggers. Deliberately has no dependency on the Trigger.dev SDK, so it
 * can be unit tested without a real API key or network access — the SDK calls themselves
 * (idempotencyKeys.create, batchTrigger) are one-line pass-throughs in trigger/analyticsCapture.ts.
 */

export type AnalyticsCaptureTaskPayload = {
  userId: string;
  businessProfileId: string;
  /**
   * "manual_trigger" is used only by the admin debugging endpoint
   * (app/api/admin/trigger-analytics-capture) — not a due-query outcome, so it lives
   * here rather than widening AnalyticsEligibleTenant["reason"] itself.
   */
  reason: AnalyticsEligibleTenant["reason"] | "manual_trigger";
};

/**
 * Maps due tenants to task payloads, preserving the due-query's own deterministic
 * ordering and limit (this function does not re-sort or re-limit).
 */
export function buildAnalyticsCaptureTaskPayloads(
  due: AnalyticsEligibleTenant[]
): AnalyticsCaptureTaskPayload[] {
  return due.map((tenant) => ({
    userId: tenant.userId,
    businessProfileId: tenant.businessProfileId,
    reason: tenant.reason,
  }));
}

/**
 * One Trigger.dev concurrency key per tenant, so two in-flight captures for the same
 * business can never run simultaneously (see the analyticsCaptureQueue's concurrencyLimit
 * of 1 in trigger/analyticsCapture.ts — the key partitions that queue per tenant).
 */
export function buildAnalyticsCaptureConcurrencyKey(userId: string): string {
  return userId;
}

/**
 * Idempotency key parts for one tenant's capture on one calendar day. Passed through
 * idempotencyKeys.create(..., { scope: "global" }) by the caller — global scope is
 * required here because the default "run" scope only dedupes within a single parent
 * (sweep) run, and the whole point of this key is to prevent two *separate* sweep runs
 * (e.g. a manual retrigger, or an overlapping scheduled run) from double-capturing the
 * same tenant on the same day. Including the date means the key naturally stops blocking
 * once a new day's cadence begins, with no manual reset needed.
 */
export function buildAnalyticsCaptureIdempotencyKeyParts(
  userId: string,
  todayIsoDate: string
): string[] {
  return [userId, "analytics-capture", todayIsoDate];
}

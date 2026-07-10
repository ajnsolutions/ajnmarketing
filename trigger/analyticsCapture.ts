import { task, queue, logger, idempotencyKeys } from "@trigger.dev/sdk";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getBusinessesDueForAnalyticsCapture } from "@/lib/analytics/analyticsEligibility";
import { captureSnapshotForUser } from "@/lib/analytics/analyticsEngine";
import { logAuditEvent, auditErrorMetadata } from "@/lib/audit-log/service";
import { AuditActions } from "@/lib/audit-log/types";
import {
  buildAnalyticsCaptureTaskPayloads,
  buildAnalyticsCaptureConcurrencyKey,
  buildAnalyticsCaptureIdempotencyKeyParts,
  type AnalyticsCaptureTaskPayload,
} from "@/lib/trigger/analyticsCaptureBatch";

/**
 * SCOPE: this file exists to prove out the Trigger.dev integration for exactly one
 * subsystem — analytics capture — per the ADR's Phase 1 plan. It does not schedule
 * itself (schedules.task() is intentionally NOT used here — see analyticsCaptureSweepTask
 * below), does not touch Market Context / Publishing / Reviews / Recommendation
 * generation, and does not remove or modify the existing after()-based execution path
 * (lib/background-jobs/scheduler.ts is untouched). Both paths coexist.
 */

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * concurrencyLimit: 1 on this queue, combined with a per-tenant concurrencyKey (see
 * buildAnalyticsCaptureConcurrencyKey) when triggering, guarantees at most one capture
 * in flight per business at a time — Trigger.dev creates one copy of this queue per
 * distinct key, each inheriting the limit of 1.
 */
const analyticsCaptureQueue = queue({
  name: "analytics-capture",
  concurrencyLimit: 1,
});

/**
 * Captures one tenant's analytics snapshot. Reuses captureSnapshotForUser exactly as-is
 * (no duplicated logic) with an explicitly injected privileged client — the same
 * function every existing caller (background job worker) uses, just with a different
 * client source. Retry policy matches the ADR's stated policy for idempotent
 * reads/syncs: a few quick retries, no aggressive backoff, since re-running a capture is
 * cheap and safe.
 */
export const analyticsCaptureForTenantTask = task({
  id: "analytics-capture-for-tenant",
  queue: analyticsCaptureQueue,
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 2_000,
    maxTimeoutInMs: 10_000,
    factor: 2,
    randomize: true,
  },
  run: async (payload: AnalyticsCaptureTaskPayload) => {
    logger.info("analytics-capture: starting", {
      userId: payload.userId,
      businessProfileId: payload.businessProfileId,
      reason: payload.reason,
    });

    const supabase = createServiceRoleClient();
    const result = await captureSnapshotForUser(payload.userId, supabase);

    logger.info("analytics-capture: completed", {
      userId: payload.userId,
      snapshotId: result.snapshot?.id ?? null,
      contentPerformanceCount: result.contentPerformanceCount,
    });

    return result;
  },
  onFailure: async ({ payload, error }) => {
    logger.error("analytics-capture: failed after exhausting retries", {
      userId: payload.userId,
      businessProfileId: payload.businessProfileId,
      error: error instanceof Error ? error.message : String(error),
    });

    // captureSnapshotForUser only logs on success (see analyticsEngine.ts) — this is the
    // one place a failed capture becomes visible in the same user-facing audit_logs
    // record used everywhere else in this codebase, matching the {started/success/failure}
    // convention already established for other subsystems.
    const supabase = createServiceRoleClient();
    await logAuditEvent(supabase, {
      userId: payload.userId,
      businessProfileId: payload.businessProfileId,
      action: AuditActions.ANALYTICS_SNAPSHOT_CAPTURE_FAILED,
      entityType: "analytics_snapshot",
      status: "failure",
      metadata: auditErrorMetadata(error, "Analytics capture failed"),
    });
  },
});

/**
 * Sweeps for tenants due for analytics capture and fans out one
 * analyticsCaptureForTenantTask trigger per tenant. Deliberately a plain task(), not
 * schedules.task() — per the task scope, no schedule may be attached/activated yet, so
 * this can only run when manually triggered (CLI, dashboard "Test" page, or a future
 * schedules.create() call once explicitly approved). A scheduled task with no schedule
 * attached would not run at all; using a plain task keeps it testable right now via
 * manual triggering without implying any schedule already exists.
 */
export const analyticsCaptureSweepTask = task({
  id: "analytics-capture-sweep",
  run: async () => {
    const supabase = createServiceRoleClient();
    const due = await getBusinessesDueForAnalyticsCapture(supabase);
    const today = todayIsoDate();

    logger.info("analytics-capture-sweep: found due tenants", { count: due.length });

    if (due.length === 0) {
      return { evaluated: 0, triggered: 0 };
    }

    const payloads = buildAnalyticsCaptureTaskPayloads(due);
    const items = await Promise.all(
      payloads.map(async (payload) => {
        const idempotencyKey = await idempotencyKeys.create(
          buildAnalyticsCaptureIdempotencyKeyParts(payload.userId, today),
          { scope: "global" }
        );

        return {
          payload,
          options: {
            concurrencyKey: buildAnalyticsCaptureConcurrencyKey(payload.userId),
            idempotencyKey,
            // Slightly under 24h so a legitimately-due next-day capture is never
            // blocked by today's key, while still preventing two sweeps triggered on
            // the same day from double-capturing the same tenant.
            idempotencyKeyTTL: "20h",
          },
        };
      })
    );

    const batch = await analyticsCaptureForTenantTask.batchTrigger(items);

    logger.info("analytics-capture-sweep: triggered batch", {
      evaluated: due.length,
      triggered: batch.runCount,
    });

    return { evaluated: due.length, triggered: batch.runCount };
  },
});

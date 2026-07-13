import { task, schedules, queue, logger, idempotencyKeys } from "@trigger.dev/sdk";
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
import { declarativeProductionCron } from "@/lib/trigger/scheduleActivation";

/**
 * Analytics capture — per-tenant task + nightly scheduled sweep (Phase 2D).
 *
 * Intended schedule (gated — see lib/trigger/scheduleActivation.ts):
 *   cron 0 6 * * * timezone UTC (06:00 UTC nightly), PRODUCTION only.
 * Staggered away from recommendation-pipeline-sweep (14:00 UTC) and publishing (:05).
 * Declarative cron is omitted until ATTACH_DECLARATIVE_PRODUCTION_CRONS is flipped on.
 */

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

const analyticsCaptureQueue = queue({
  name: "analytics-capture",
  concurrencyLimit: 1,
});

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
 * Nightly reconciliation sweep. Also manually triggerable via dashboard Test /
 * admin route. Day-scoped idempotency prevents double-capture on the same calendar day.
 */
export const analyticsCaptureSweepTask = schedules.task({
  id: "analytics-capture-sweep",
  // No declarative cron unless scheduleActivation gate is open (manual Test still works).
  ...declarativeProductionCron("analytics-capture-sweep"),
  ttl: "6h",
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 2_000,
    maxTimeoutInMs: 10_000,
    factor: 2,
    randomize: true,
  },
  run: async (payload) => {
    const supabase = createServiceRoleClient();
    const due = await getBusinessesDueForAnalyticsCapture(supabase);
    const today = todayIsoDate();

    logger.info("analytics-capture-sweep: found due tenants", {
      count: due.length,
      scheduleId: payload.scheduleId,
      timestamp: payload.timestamp.toISOString(),
    });

    if (due.length === 0) {
      return { evaluated: 0, triggered: 0 };
    }

    const payloads = buildAnalyticsCaptureTaskPayloads(due);
    const items = await Promise.all(
      payloads.map(async (tenantPayload) => {
        const idempotencyKey = await idempotencyKeys.create(
          buildAnalyticsCaptureIdempotencyKeyParts(tenantPayload.userId, today),
          { scope: "global" }
        );

        return {
          payload: tenantPayload,
          options: {
            concurrencyKey: buildAnalyticsCaptureConcurrencyKey(tenantPayload.userId),
            idempotencyKey,
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

    return {
      evaluated: due.length,
      triggered: batch.runCount,
      upcoming: payload.upcoming.map((d) => d.toISOString()),
    };
  },
});

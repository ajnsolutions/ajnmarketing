import { task, schedules, queue, logger, idempotencyKeys, AbortTaskRunError } from "@trigger.dev/sdk";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getDueScheduledPublishingJobs } from "@/lib/publishing/publishingHistory";
import { executePublishingJobById } from "@/lib/publishing/publishingEngine";
import { logAuditEvent, auditErrorMetadata } from "@/lib/audit-log/service";
import { AuditActions } from "@/lib/audit-log/types";
import {
  buildPublishingExecuteConcurrencyKey,
  buildPublishingExecuteIdempotencyKeyParts,
  buildPublishingExecuteTaskPayloads,
  publishingHourIsoKey,
  type PublishingExecuteTaskPayload,
} from "@/lib/trigger/publishingDueKeys";

/**
 * Phase 2D — hourly due publishing sweep.
 *
 * Only scheduled/retrying jobs with scheduled_for <= now (getDueScheduledPublishingJobs).
 * Execution uses the existing publishing engine + provider safety checks with an injected
 * service-role client. GET /api/publishing is read-only; this is the sole autonomous path.
 *
 * Schedule: cron 5 * * * * timezone UTC (:05 every hour) — staggered off :00.
 */

const publishingDueSweepQueue = queue({
  name: "publishing-due-sweep",
  concurrencyLimit: 1,
});

const publishingExecuteQueue = queue({
  name: "publishing-execute",
  concurrencyLimit: 1,
});

export const publishingExecuteJobTask = task({
  id: "publishing-execute-job",
  queue: publishingExecuteQueue,
  maxDuration: 120,
  retry: {
    // Publishing already has engine-level retry/backoff (max 3). Keep Trigger retries
    // tight so we don't multiply side effects beyond the engine's own budget.
    maxAttempts: 2,
    minTimeoutInMs: 5_000,
    maxTimeoutInMs: 30_000,
    factor: 2,
    randomize: true,
  },
  run: async (payload: PublishingExecuteTaskPayload, { ctx }) => {
    logger.info("publishing-execute: starting", {
      publishingJobId: payload.publishingJobId,
      userId: payload.userId,
      attempt: ctx.attempt.number,
    });

    const supabase = createServiceRoleClient();
    const { job, error } = await executePublishingJobById(
      payload.publishingJobId,
      payload.userId,
      supabase
    );

    if (error) {
      // Not-due / cancelled / missing are terminal for this attempt — do not burn retries.
      const terminal =
        error.includes("not due") ||
        error.includes("cancelled") ||
        error.includes("not found");
      if (terminal) {
        throw new AbortTaskRunError(error);
      }
      throw new Error(error);
    }

    logger.info("publishing-execute: completed", {
      publishingJobId: payload.publishingJobId,
      status: job?.status ?? null,
      attempt: ctx.attempt.number,
    });

    return {
      publishingJobId: payload.publishingJobId,
      userId: payload.userId,
      status: job?.status ?? null,
      providerPostId: job?.provider_post_id ?? null,
    };
  },
  onFailure: async ({ payload, error, ctx }) => {
    logger.error("publishing-execute: failed after exhausting retries", {
      publishingJobId: payload.publishingJobId,
      userId: payload.userId,
      attempt: ctx.attempt.number,
      error: error instanceof Error ? error.message : String(error),
    });

    const supabase = createServiceRoleClient();
    await logAuditEvent(supabase, {
      userId: payload.userId,
      businessProfileId: payload.businessProfileId,
      action: AuditActions.PUBLISHING_FAILED,
      entityType: "publishing_job",
      entityId: payload.publishingJobId,
      status: "failure",
      metadata: {
        ...auditErrorMetadata(error, "Publishing execute task failed"),
        source: "trigger.dev",
        attempt: ctx.attempt.number,
      },
    });
  },
});

export const publishingDueSweepTask = schedules.task({
  id: "publishing-due-sweep",
  /**
   * ACTIVATION GATE: deploy only after explicit approval.
   * 5 * * * * UTC = :05 every hour — avoids colliding with :00 batch work.
   */
  cron: {
    pattern: "5 * * * *",
    timezone: "UTC",
    environments: ["PRODUCTION"],
  },
  queue: publishingDueSweepQueue,
  ttl: "50m",
  retry: {
    maxAttempts: 2,
    minTimeoutInMs: 2_000,
    maxTimeoutInMs: 10_000,
    factor: 2,
    randomize: true,
  },
  run: async (payload) => {
    logger.info("publishing-due-sweep: starting", {
      scheduleId: payload.scheduleId,
      timestamp: payload.timestamp.toISOString(),
      upcoming: payload.upcoming.map((d) => d.toISOString()),
    });

    const supabase = createServiceRoleClient();
    const dueJobs = await getDueScheduledPublishingJobs(supabase);
    const hourKey = publishingHourIsoKey(payload.timestamp);

    logger.info("publishing-due-sweep: found due jobs", { count: dueJobs.length });

    if (dueJobs.length === 0) {
      return { evaluated: 0, triggered: 0 };
    }

    const payloads = buildPublishingExecuteTaskPayloads(dueJobs);
    const items = await Promise.all(
      payloads.map(async (jobPayload) => {
        const idempotencyKey = await idempotencyKeys.create(
          buildPublishingExecuteIdempotencyKeyParts(jobPayload.publishingJobId, hourKey),
          { scope: "global" }
        );

        return {
          payload: jobPayload,
          options: {
            concurrencyKey: buildPublishingExecuteConcurrencyKey(jobPayload.publishingJobId),
            idempotencyKey,
            idempotencyKeyTTL: "55m",
          },
        };
      })
    );

    const batch = await publishingExecuteJobTask.batchTrigger(items);

    logger.info("publishing-due-sweep: triggered batch", {
      evaluated: dueJobs.length,
      triggered: batch.runCount,
    });

    return {
      evaluated: dueJobs.length,
      triggered: batch.runCount,
      upcoming: payload.upcoming.map((d) => d.toISOString()),
    };
  },
});

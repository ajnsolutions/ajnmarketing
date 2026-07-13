import { task, schedules, queue, logger, idempotencyKeys } from "@trigger.dev/sdk";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { runRecommendationPipelineForUser } from "@/lib/recommendation-pipeline/orchestrator";
import { PipelineOverallStatuses } from "@/lib/recommendation-pipeline/types";
import { logAuditEvent, auditErrorMetadata } from "@/lib/audit-log/service";
import { AuditActions } from "@/lib/audit-log/types";
import { getOnboardedBusinessesForPipeline } from "@/lib/trigger/recommendationPipelineEligibility";
import {
  buildRecommendationPipelineConcurrencyKey,
  buildRecommendationPipelineIdempotencyKeyParts,
  buildRecommendationPipelineTaskPayloads,
  RECOMMENDATION_PIPELINE_SWEEP_LIMIT,
  type RecommendationPipelineTaskPayload,
} from "@/lib/trigger/recommendationPipelineKeys";
import { declarativeProductionCron } from "@/lib/trigger/scheduleActivation";

/**
 * Phase 2D — autonomous daily recommendation pipeline.
 *
 * Per-tenant execution reuses runRecommendationPipelineForUser (skip rules handle
 * freshness / OpenAI avoidance). The sweep fans out with concurrency + day idempotency.
 * As of the Recommendation Execution Engine, the orchestrator's last stage
 * ("content_execution") also turns eligible recommendations into content_approvals
 * drafts via the existing recommendation-to-content workflow -- no changes were needed
 * in this file for that: result.stages already logs every stage generically below, and
 * drafts only ever land in the existing Approval Center, never published automatically.
 *
 * Intended schedule (gated — see lib/trigger/scheduleActivation.ts):
 *   cron 0 14 * * *  timezone UTC  → 14:00 UTC daily
 * Staggered away from analytics (06:00 UTC) and publishing (:05 every hour).
 * Declarative cron is omitted until ATTACH_DECLARATIVE_PRODUCTION_CRONS is flipped on.
 */

const recommendationPipelineQueue = queue({
  name: "recommendation-pipeline",
  concurrencyLimit: 1,
});

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export const recommendationPipelineForTenantTask = task({
  id: "recommendation-pipeline-for-tenant",
  queue: recommendationPipelineQueue,
  maxDuration: 600,
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 2_000,
    maxTimeoutInMs: 10_000,
    factor: 2,
    randomize: true,
  },
  run: async (payload: RecommendationPipelineTaskPayload, { ctx }) => {
    const attempt = ctx.attempt.number;

    logger.info("recommendation-pipeline: starting", {
      userId: payload.userId,
      reason: payload.reason,
      attempt,
    });

    const supabase = createServiceRoleClient();
    const result = await runRecommendationPipelineForUser(payload.userId, supabase);

    for (const stage of result.stages) {
      logger.info("recommendation-pipeline: stage", {
        userId: payload.userId,
        attempt,
        stage: stage.stage,
        status: stage.status,
        reason: stage.reason,
      });
    }

    logger.info("recommendation-pipeline: completed", {
      userId: payload.userId,
      attempt,
      pipelineStatus: result.status,
      summary: result.summary.label,
      durationMs: result.durationMs,
      businessProfileId: result.businessProfileId,
      completed: result.summary.completed,
      skipped: result.summary.skipped,
      failed: result.summary.failed,
    });

    if (result.status === PipelineOverallStatuses.FAILURE) {
      logger.error("recommendation-pipeline: overall failure (will retry if attempts remain)", {
        userId: payload.userId,
        attempt,
        summary: result.summary.label,
        failedStages: result.summary.failedStages,
      });
      throw new Error(result.summary.label);
    }

    return {
      userId: result.userId,
      businessProfileId: result.businessProfileId,
      status: result.status,
      summary: result.summary.label,
      completed: result.summary.completed,
      skipped: result.summary.skipped,
      failed: result.summary.failed,
      durationMs: result.durationMs,
      startedAt: result.startedAt,
      finishedAt: result.finishedAt,
      stages: result.stages,
    };
  },
  onFailure: async ({ payload, error, ctx }) => {
    logger.error("recommendation-pipeline: failed after exhausting retries", {
      userId: payload.userId,
      attempt: ctx.attempt.number,
      error: error instanceof Error ? error.message : String(error),
    });

    const supabase = createServiceRoleClient();
    await logAuditEvent(supabase, {
      userId: payload.userId,
      action: AuditActions.RECOMMENDATION_PIPELINE_FAILED,
      entityType: "recommendation_pipeline",
      status: "failure",
      metadata: {
        ...auditErrorMetadata(error, "Recommendation pipeline failed"),
        source: "trigger.dev",
        reason: payload.reason,
        attempt: ctx.attempt.number,
      },
    });
  },
});

/**
 * Daily sweep: list onboarded tenants and fan out per-tenant pipeline runs.
 * Manual Test / tasks.trigger still work without attaching an imperative schedule.
 */
export const recommendationPipelineSweepTask = schedules.task({
  id: "recommendation-pipeline-sweep",
  // No declarative cron unless scheduleActivation gate is open (manual Test still works).
  ...declarativeProductionCron("recommendation-pipeline-sweep"),
  ttl: "6h",
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 2_000,
    maxTimeoutInMs: 10_000,
    factor: 2,
    randomize: true,
  },
  run: async (payload) => {
    logger.info("recommendation-pipeline-sweep: starting", {
      scheduleId: payload.scheduleId,
      timestamp: payload.timestamp.toISOString(),
      lastTimestamp: payload.lastTimestamp?.toISOString() ?? null,
      upcoming: payload.upcoming.map((d) => d.toISOString()),
    });

    const supabase = createServiceRoleClient();
    const tenants = await getOnboardedBusinessesForPipeline(supabase, {
      limit: RECOMMENDATION_PIPELINE_SWEEP_LIMIT,
    });
    const today = todayIsoDate();

    logger.info("recommendation-pipeline-sweep: found tenants", { count: tenants.length });

    if (tenants.length === 0) {
      return { evaluated: 0, triggered: 0 };
    }

    const payloads = buildRecommendationPipelineTaskPayloads(tenants, "scheduled_daily");
    const items = await Promise.all(
      payloads.map(async (tenantPayload) => {
        const idempotencyKey = await idempotencyKeys.create(
          buildRecommendationPipelineIdempotencyKeyParts(tenantPayload.userId, today),
          { scope: "global" }
        );

        return {
          payload: tenantPayload,
          options: {
            concurrencyKey: buildRecommendationPipelineConcurrencyKey(tenantPayload.userId),
            idempotencyKey,
            idempotencyKeyTTL: "20h",
          },
        };
      })
    );

    const batch = await recommendationPipelineForTenantTask.batchTrigger(items);

    logger.info("recommendation-pipeline-sweep: triggered batch", {
      evaluated: tenants.length,
      triggered: batch.runCount,
    });

    return {
      evaluated: tenants.length,
      triggered: batch.runCount,
      upcoming: payload.upcoming.map((d) => d.toISOString()),
    };
  },
});

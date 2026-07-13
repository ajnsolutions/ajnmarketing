import { task, queue, logger } from "@trigger.dev/sdk";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { runRecommendationPipelineForUser } from "@/lib/recommendation-pipeline/orchestrator";
import { PipelineOverallStatuses } from "@/lib/recommendation-pipeline/types";
import { logAuditEvent, auditErrorMetadata } from "@/lib/audit-log/service";
import { AuditActions } from "@/lib/audit-log/types";
import type { RecommendationPipelineTaskPayload } from "@/lib/trigger/recommendationPipelineKeys";

/**
 * SCOPE: Phase 2C — connect the existing Recommendation Pipeline Orchestrator to
 * Trigger.dev for *manual* execution only. This file does not schedule itself
 * (schedules.task() / cron are intentionally NOT used), does not auto-trigger on
 * events, and does not duplicate any stage business logic — it only injects the
 * service-role client and calls runRecommendationPipelineForUser.
 *
 * Idempotency of opportunities / recommendations / market context / drafts remains the
 * orchestrator's + persistence layers' responsibility (skip rules + upserts). This task
 * adds per-tenant concurrency so two pipeline runs for the same user never execute at
 * once.
 */

/**
 * concurrencyLimit: 1 on this queue, combined with a per-tenant concurrencyKey (see
 * buildRecommendationPipelineConcurrencyKey) when triggering, guarantees at most one
 * pipeline run in flight per user at a time — Trigger.dev creates one copy of this
 * queue per distinct key, each inheriting the limit of 1.
 */
const recommendationPipelineQueue = queue({
  name: "recommendation-pipeline",
  concurrencyLimit: 1,
});

/**
 * Runs the full recommendation pipeline for one tenant. Reuses
 * runRecommendationPipelineForUser exactly as-is with an explicitly injected privileged
 * client — the same function the background-job worker and admin sync path use.
 *
 * maxDuration is raised above the project default (60s): a cold pipeline can include
 * website analysis + AI profile + market context OpenAI calls in one attempt.
 *
 * Retry policy matches analytics-capture (idempotent reads/writes): a few quick retries.
 * Total pipeline `failure` throws so Trigger.dev retries; `partial_success` / `success`
 * complete the run (mirrors lib/background-jobs/worker.ts).
 */
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

    // Align Trigger.dev run outcome with pipeline overall status (same as worker.ts):
    // success / partial_success → run succeeds; failure → throw so retries apply.
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

    // Orchestrator already writes RECOMMENDATION_PIPELINE_FAILED when it returns
    // status === failure. This covers crashes / unexpected throws that bypassed that
    // path, matching analytics-capture's onFailure audit convention.
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

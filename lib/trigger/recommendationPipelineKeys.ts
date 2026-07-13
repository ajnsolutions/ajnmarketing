import "server-only";

/**
 * Pure payload/key-construction helpers for the recommendation-pipeline Trigger.dev
 * task. Deliberately has no dependency on the Trigger.dev SDK, so it can be unit tested
 * without a real API key or network access — the SDK calls themselves (queue, logger,
 * idempotencyKeys) stay in trigger/recommendationPipeline.ts.
 *
 * Mirrors lib/trigger/analyticsCaptureBatch.ts.
 */

export type RecommendationPipelineTaskPayload = {
  userId: string;
  /**
   * "manual_trigger" is used by the admin debugging endpoint and by Trigger.dev
   * dashboard / CLI Test runs. No due-query / sweep exists yet for this pipeline
   * (schedules are explicitly out of scope for Phase 2C).
   */
  reason: "manual_trigger";
};

/**
 * One Trigger.dev concurrency key per tenant, so two in-flight recommendation-pipeline
 * runs for the same user can never execute simultaneously (see the
 * recommendationPipelineQueue's concurrencyLimit of 1 in trigger/recommendationPipeline.ts
 * — the key partitions that queue per tenant). Matches the analytics-capture convention
 * of keying on userId (business_profiles is 1:1 with user_id).
 */
export function buildRecommendationPipelineConcurrencyKey(userId: string): string {
  return userId;
}

/**
 * Idempotency key parts for one tenant's pipeline run on one calendar day. Passed through
 * idempotencyKeys.create(..., { scope: "global" }) by callers that want day-scoped
 * dedupe (e.g. a future sweep). Global scope is required because the default "run" scope
 * only dedupes within a single parent run.
 *
 * Manual dashboard / admin triggers intentionally omit the idempotency key so operators
 * can re-run the pipeline on demand; data-layer idempotency (orchestrator skip rules +
 * upserts) still prevents duplicate opportunities / recommendations / market-context
 * briefs / drafts across those intentional re-runs.
 */
export function buildRecommendationPipelineIdempotencyKeyParts(
  userId: string,
  todayIsoDate: string
): string[] {
  return [userId, "recommendation-pipeline", todayIsoDate];
}

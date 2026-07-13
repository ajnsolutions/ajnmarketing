import "server-only";

/**
 * Pure mapping/key helpers for recommendation-pipeline sweep fan-out.
 * No Trigger.dev SDK dependency — unit-testable in isolation.
 */

import type { PipelineEligibleTenant } from "@/lib/trigger/recommendationPipelineEligibility";

export type RecommendationPipelineTaskReason = "manual_trigger" | "scheduled_daily";

export type RecommendationPipelineTaskPayload = {
  userId: string;
  reason: RecommendationPipelineTaskReason;
};

export function buildRecommendationPipelineTaskPayloads(
  tenants: PipelineEligibleTenant[],
  reason: RecommendationPipelineTaskReason = "scheduled_daily"
): RecommendationPipelineTaskPayload[] {
  return tenants.map((tenant) => ({
    userId: tenant.userId,
    reason,
  }));
}

export function buildRecommendationPipelineConcurrencyKey(userId: string): string {
  return userId;
}

/**
 * Day-scoped idempotency parts for scheduled fan-out. Manual triggers omit the key so
 * operators can re-run on demand without waiting for TTL expiry.
 */
export function buildRecommendationPipelineIdempotencyKeyParts(
  userId: string,
  todayIsoDate: string
): string[] {
  return [userId, "recommendation-pipeline", todayIsoDate];
}

/** Default batch cap for one sweep — matches analytics eligibility default. */
export const RECOMMENDATION_PIPELINE_SWEEP_LIMIT = 100;

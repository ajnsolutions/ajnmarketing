import "server-only";

/**
 * Pure request-body validation for the admin manual-evaluation endpoint
 * (app/api/admin/trigger-marketing-memory-learning-evaluation). Mirrors
 * lib/admin/triggerRecommendationOutcomeReconciliationRequest.ts.
 */

export type ParsedTriggerMarketingMemoryLearningEvaluationRequest =
  | { ok: true; userId: string; businessProfileId: string }
  | { ok: false; error: string };

export function parseTriggerMarketingMemoryLearningEvaluationRequestBody(
  body: unknown
): ParsedTriggerMarketingMemoryLearningEvaluationRequest {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "userId and businessProfileId are both required" };
  }

  const record = body as Record<string, unknown>;
  const userId = typeof record.userId === "string" ? record.userId.trim() : "";
  const businessProfileId =
    typeof record.businessProfileId === "string" ? record.businessProfileId.trim() : "";

  if (!userId || !businessProfileId) {
    return { ok: false, error: "userId and businessProfileId are both required" };
  }

  return { ok: true, userId, businessProfileId };
}

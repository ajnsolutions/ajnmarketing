import "server-only";

/**
 * Pure request-body validation for the admin manual-reconciliation endpoint
 * (app/api/admin/trigger-recommendation-outcome-reconciliation). Mirrors
 * lib/admin/triggerRecommendationExecutionRequest.ts.
 */

export type ParsedTriggerRecommendationOutcomeReconciliationRequest =
  | { ok: true; userId: string; businessProfileId: string }
  | { ok: false; error: string };

export function parseTriggerRecommendationOutcomeReconciliationRequestBody(
  body: unknown
): ParsedTriggerRecommendationOutcomeReconciliationRequest {
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

import "server-only";

/**
 * Pure request-body validation for the admin manual-trigger endpoint
 * (app/api/admin/trigger-recommendation-execution). Kept separate from the route handler
 * so the validation rules are unit-testable without a real Supabase session or
 * service-role client. Mirrors lib/admin/triggerRecommendationPipelineRequest.ts.
 */

export type ParsedTriggerRecommendationExecutionRequest =
  | { ok: true; userId: string; recommendationId: string }
  | { ok: false; error: string };

export function parseTriggerRecommendationExecutionRequestBody(
  body: unknown
): ParsedTriggerRecommendationExecutionRequest {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "userId and recommendationId are both required" };
  }

  const record = body as Record<string, unknown>;
  const userId = typeof record.userId === "string" ? record.userId.trim() : "";
  const recommendationId =
    typeof record.recommendationId === "string" ? record.recommendationId.trim() : "";

  if (!userId || !recommendationId) {
    return { ok: false, error: "userId and recommendationId are both required" };
  }

  return { ok: true, userId, recommendationId };
}

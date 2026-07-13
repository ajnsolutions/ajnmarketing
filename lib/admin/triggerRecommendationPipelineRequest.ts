import "server-only";

/**
 * Pure request-body validation for the admin manual-trigger endpoint
 * (app/api/admin/trigger-recommendation-pipeline), which fire-and-forgets
 * recommendationPipelineForTenantTask. Kept separate from the route handler so the
 * validation rules are unit-testable without a real Supabase session or Trigger.dev
 * network call. Mirrors lib/admin/triggerAnalyticsCaptureRequest.ts.
 */

export type ParsedTriggerRecommendationPipelineRequest =
  | { ok: true; userId: string }
  | { ok: false; error: string };

export function parseTriggerRecommendationPipelineRequestBody(
  body: unknown
): ParsedTriggerRecommendationPipelineRequest {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "userId is required" };
  }

  const record = body as Record<string, unknown>;
  const userId = typeof record.userId === "string" ? record.userId.trim() : "";

  if (!userId) {
    return { ok: false, error: "userId is required" };
  }

  return { ok: true, userId };
}

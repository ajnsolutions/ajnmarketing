import "server-only";

/**
 * Pure request-body validation for the admin manual-trigger endpoint
 * (app/api/admin/trigger-analytics-capture). Kept separate from the route handler so the
 * validation rules are unit-testable without a real Supabase session, service-role
 * client, or Trigger.dev SDK call.
 */

export type ParsedTriggerAnalyticsCaptureRequest =
  | { ok: true; userId: string; businessProfileId: string }
  | { ok: false; error: string };

export function parseTriggerAnalyticsCaptureRequestBody(
  body: unknown
): ParsedTriggerAnalyticsCaptureRequest {
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

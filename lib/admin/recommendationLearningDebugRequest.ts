import "server-only";

/**
 * Pure query-param validation for the admin debug endpoint
 * (app/api/admin/recommendation-learning-debug). Mirrors the shape of
 * lib/admin/triggerRecommendationOutcomeReconciliationRequest.ts, adapted for a GET
 * route's URLSearchParams instead of a JSON body.
 */

export type ParsedRecommendationLearningDebugRequest =
  | { ok: true; userId: string; businessProfileId: string }
  | { ok: false; error: string };

export function parseRecommendationLearningDebugRequestParams(
  params: URLSearchParams
): ParsedRecommendationLearningDebugRequest {
  const userId = params.get("userId")?.trim() ?? "";
  const businessProfileId = params.get("businessProfileId")?.trim() ?? "";

  if (!userId || !businessProfileId) {
    return { ok: false, error: "userId and businessProfileId are both required" };
  }

  return { ok: true, userId, businessProfileId };
}

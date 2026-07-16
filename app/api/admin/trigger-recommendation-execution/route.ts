import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { requireAdminUser } from "@/lib/admin/requireAdminUser";
import { parseTriggerRecommendationExecutionRequestBody } from "@/lib/admin/triggerRecommendationExecutionRequest";
import { executeRecommendationForUser } from "@/lib/recommendation-execution/engine";
import { toSafeUserErrorMessage } from "@/lib/security/safe-error-message";

/**
 * Admin-only developer utility: manually executes one specific recommendation for one
 * specified tenant, using the same executeRecommendationForUser path the recommendation
 * pipeline's content_execution stage calls. Exists for exercising and debugging the
 * Recommendation Execution Engine directly without waiting for the next daily pipeline
 * run or writing SQL by hand. Mirrors the auth/ownership pattern established by
 * app/api/admin/trigger-recommendation-pipeline/route.ts and
 * app/api/admin/trigger-analytics-capture/route.ts.
 *
 * Runs synchronously (awaited in the request) rather than firing a Trigger.dev task --
 * a single recommendation execution is one OpenAI call, the same cost profile as the
 * existing manual "Generate Draft" button's own route
 * (app/api/marketing-recommendations/create-content/route.ts), which already does this
 * synchronously. No new Trigger.dev task is introduced for this.
 *
 * Only ever creates a content_approvals draft -- never queues or publishes anything.
 */
export async function POST(request: Request) {
  const auth = await requireAdminUser();
  if ("error" in auth) return auth.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseTriggerRecommendationExecutionRequestBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { userId: targetUserId, recommendationId } = parsed;

  const serviceClient = createServiceRoleClient();
  const { data: recommendation, error: lookupError } = await serviceClient
    .from("marketing_recommendations")
    .select("id")
    .eq("id", recommendationId)
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json(
      { error: toSafeUserErrorMessage(lookupError.message, "Failed to verify recommendation") },
      { status: 502 }
    );
  }

  if (!recommendation) {
    return NextResponse.json(
      { error: "No marketing_recommendations row matches that userId and recommendationId" },
      { status: 404 }
    );
  }

  try {
    const result = await executeRecommendationForUser(targetUserId, recommendationId, serviceClient);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: toSafeUserErrorMessage(error, "Failed to execute the recommendation") },
      { status: 502 }
    );
  }
}

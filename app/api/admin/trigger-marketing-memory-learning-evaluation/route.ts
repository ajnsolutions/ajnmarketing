import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { requireAdminUser } from "@/lib/admin/requireAdminUser";
import { parseTriggerMarketingMemoryLearningEvaluationRequestBody } from "@/lib/admin/triggerMarketingMemoryLearningEvaluationRequest";
import { evaluateLearningsForBusiness } from "@/lib/marketing-memory/learningService";
import { toSafeUserErrorMessage } from "@/lib/security/safe-error-message";

/**
 * Admin-only developer utility: evaluates Marketing Memory Phase 2 learnings
 * (timing_performance, recommendation_action_outcome) for one tenant/business from its
 * existing Phase 1 observations. Mirrors the auth/ownership pattern established by
 * app/api/admin/trigger-recommendation-outcome-reconciliation/route.ts exactly.
 *
 * Runs synchronously -- one business's evaluation is bounded (EVALUATION_WINDOW_DAYS,
 * MAX_OBSERVATIONS_PER_EVALUATION, see lib/marketing-memory/learningConfig.ts) and cheap.
 * Never scheduled in production; this route is the only way to invoke it. No
 * Trigger.dev task exists for this in Phase 2 -- this admin route alone satisfies "a
 * safe, manually-invoked, tenant-scoped evaluation entry point" without the added
 * complexity of a scheduled-but-unscheduled task definition.
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

  const parsed = parseTriggerMarketingMemoryLearningEvaluationRequestBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { userId: targetUserId, businessProfileId } = parsed;

  const serviceClient = createServiceRoleClient();
  const { data: businessProfile, error: lookupError } = await serviceClient
    .from("business_profiles")
    .select("id")
    .eq("id", businessProfileId)
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json(
      { error: toSafeUserErrorMessage(lookupError.message, "Failed to verify business profile") },
      { status: 502 }
    );
  }

  if (!businessProfile) {
    return NextResponse.json(
      { error: "No business_profiles row matches that userId and businessProfileId" },
      { status: 404 }
    );
  }

  try {
    const summary = await evaluateLearningsForBusiness(serviceClient, targetUserId, businessProfileId);
    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json(
      { error: toSafeUserErrorMessage(error, "Failed to evaluate marketing memory learnings") },
      { status: 502 }
    );
  }
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { isAdminUserId } from "@/lib/admin/isAdminUser";
import { parseTriggerRecommendationOutcomeReconciliationRequestBody } from "@/lib/admin/triggerRecommendationOutcomeReconciliationRequest";
import { reconcileRecommendationOutcomesForUser } from "@/lib/recommendation-outcomes/reconciliation";
import { toSafeUserErrorMessage } from "@/lib/security/safe-error-message";

/**
 * Admin-only developer utility: backfills missing recommendation_outcome_events for one
 * tenant/business from the existing authoritative tables (content_approvals,
 * publishing_queue, publishing_jobs, content_performance). Mirrors the auth/ownership
 * pattern established by app/api/admin/trigger-recommendation-execution/route.ts.
 *
 * Runs synchronously -- reconciliation over one business's recommendations is cheap
 * (bounded by "at most one active recommendation per action type per business"). Never
 * scheduled in production; this route is the only way to invoke it outside a manual
 * Trigger.dev task run.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdminUserId(user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseTriggerRecommendationOutcomeReconciliationRequestBody(body);
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
    const counts = await reconcileRecommendationOutcomesForUser(
      serviceClient,
      targetUserId,
      businessProfileId
    );
    return NextResponse.json(counts);
  } catch (error) {
    return NextResponse.json(
      { error: toSafeUserErrorMessage(error, "Failed to reconcile recommendation outcomes") },
      { status: 502 }
    );
  }
}

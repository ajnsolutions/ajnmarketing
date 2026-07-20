import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { requireAdminUser } from "@/lib/admin/requireAdminUser";
import { parseTriggerExperimentProposalEvaluationRequestBody } from "@/lib/admin/triggerExperimentProposalEvaluationRequest";
import { evaluateAndPersistExperimentProposalsForBusiness } from "@/lib/marketing-experimentation/proposal-service";
import { toSafeUserErrorMessage } from "@/lib/security/safe-error-message";

/**
 * Admin-only developer utility: manually runs the Marketing Director experiment-proposal
 * eligibility rule for one specified tenant and persists any newly-eligible proposals.
 * Mirrors the auth/ownership pattern established by
 * app/api/admin/trigger-recommendation-execution/route.ts.
 *
 * This is the *only* code path that writes to marketing_experiment_proposals — RLS has
 * no INSERT policy for the authenticated role at all (see migration 029), so this
 * service-role write is the sole way a proposal ever comes into existence. Uses the
 * service-role client deliberately, per lib/supabase/service.ts's trust boundary: this
 * route is an admin/ops action, never a response to the target tenant's own request.
 *
 * Not wired to any schedule or cron — ATTACH_DECLARATIVE_PRODUCTION_CRONS remains false.
 * Manual/admin-triggered only, matching how recommendation generation itself currently
 * runs in this environment.
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

  const parsed = parseTriggerExperimentProposalEvaluationRequestBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { userId, businessProfileId } = parsed;
  const serviceClient = createServiceRoleClient();

  const { data: profile, error: profileError } = await serviceClient
    .from("business_profiles")
    .select("id")
    .eq("id", businessProfileId)
    .eq("user_id", userId)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json(
      { error: toSafeUserErrorMessage(profileError.message, "Failed to verify business profile") },
      { status: 502 },
    );
  }

  if (!profile) {
    return NextResponse.json(
      { error: "No business_profiles row matches that userId and businessProfileId" },
      { status: 404 },
    );
  }

  try {
    const summary = await evaluateAndPersistExperimentProposalsForBusiness(
      serviceClient,
      userId,
      businessProfileId,
    );
    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json(
      { error: toSafeUserErrorMessage(error, "Failed to evaluate experiment proposals") },
      { status: 502 },
    );
  }
}

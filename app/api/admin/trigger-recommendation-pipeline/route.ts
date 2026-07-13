import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { isAdminUserId } from "@/lib/admin/isAdminUser";
import { parseTriggerRecommendationPipelineRequestBody } from "@/lib/admin/triggerRecommendationPipelineRequest";
import { runRecommendationPipelineForUser } from "@/lib/recommendation-pipeline/orchestrator";
import { toSafeUserErrorMessage } from "@/lib/security/safe-error-message";

/**
 * Admin-only developer utility: manually runs the full recommendation pipeline
 * (Website Analysis -> AI Marketing Profile -> Market Context -> Opportunity Detection
 * -> Decision Engine) for one specified tenant. Exists for exercising and debugging the
 * orchestration directly without waiting for a future scheduler or writing SQL by hand.
 * Mirrors app/api/admin/trigger-analytics-capture/route.ts's auth/ownership pattern.
 *
 * Unlike that route, this runs synchronously (awaited in the request) rather than
 * firing a Trigger.dev task -- this is explicitly not the Trigger.dev scheduling phase.
 * Matches the existing precedent of app/api/ai-marketing-profile/route.ts, which already
 * awaits an OpenAI-backed generation step directly in its own handler.
 *
 * Does not create, modify, or activate any schedule -- this only fires a single one-off
 * run, exactly as implemented.
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

  const parsed = parseTriggerRecommendationPipelineRequestBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { userId: targetUserId } = parsed;

  const serviceClient = createServiceRoleClient();
  const { data: profile, error: profileError } = await serviceClient
    .from("business_profiles")
    .select("id")
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json(
      { error: toSafeUserErrorMessage(profileError.message, "Failed to verify business profile") },
      { status: 502 }
    );
  }

  if (!profile) {
    return NextResponse.json({ error: "No business_profiles row matches that userId" }, { status: 404 });
  }

  try {
    const result = await runRecommendationPipelineForUser(targetUserId, serviceClient);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: toSafeUserErrorMessage(error, "Failed to run the recommendation pipeline") },
      { status: 502 }
    );
  }
}

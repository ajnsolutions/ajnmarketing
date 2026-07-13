import { NextResponse } from "next/server";
import { tasks } from "@trigger.dev/sdk";
import type { recommendationPipelineForTenantTask } from "@/trigger/recommendationPipeline";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { isAdminUserId } from "@/lib/admin/isAdminUser";
import { parseTriggerRecommendationPipelineRequestBody } from "@/lib/admin/triggerRecommendationPipelineRequest";
import { buildRecommendationPipelineConcurrencyKey } from "@/lib/trigger/recommendationPipelineKeys";
import { toSafeUserErrorMessage } from "@/lib/security/safe-error-message";

/**
 * Admin-only developer utility: manually triggers recommendationPipelineForTenantTask
 * for one specified tenant. Exists for exercising and debugging the Trigger.dev
 * integration directly (confirming a real run completes, writes the expected audit rows,
 * and behaves correctly) without writing SQL by hand.
 *
 * Deliberately fire-and-forget: this returns the Trigger.dev run handle immediately
 * rather than blocking the request while the pipeline executes, so it can't tie up a
 * Vercel function for the duration of OpenAI-backed stages. Use the returned runId with
 * the Trigger.dev dashboard (or `runs.retrieve`) to check on completion.
 *
 * Does not create, modify, or activate any schedule — this only fires a single one-off
 * run of the existing task via the standard `tasks.trigger()` type-only-import pattern
 * (never importing the task instance itself into app code). Concurrency key is set so
 * two admin triggers for the same tenant cannot run in parallel.
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
    const handle = await tasks.trigger<typeof recommendationPipelineForTenantTask>(
      "recommendation-pipeline-for-tenant",
      { userId: targetUserId, reason: "manual_trigger" },
      {
        concurrencyKey: buildRecommendationPipelineConcurrencyKey(targetUserId),
      }
    );

    return NextResponse.json({ runId: handle.id, taskIdentifier: handle.taskIdentifier });
  } catch (error) {
    return NextResponse.json(
      { error: toSafeUserErrorMessage(error, "Failed to trigger the recommendation pipeline") },
      { status: 502 }
    );
  }
}

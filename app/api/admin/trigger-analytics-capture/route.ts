import { NextResponse } from "next/server";
import { tasks } from "@trigger.dev/sdk";
import type { analyticsCaptureForTenantTask } from "@/trigger/analyticsCapture";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { isAdminUserId } from "@/lib/admin/isAdminUser";
import { parseTriggerAnalyticsCaptureRequestBody } from "@/lib/admin/triggerAnalyticsCaptureRequest";
import { toSafeUserErrorMessage } from "@/lib/security/safe-error-message";

/**
 * Admin-only developer utility: manually triggers analyticsCaptureForTenantTask for one
 * specified tenant, bypassing the due-query entirely. Exists for exercising and
 * debugging the Trigger.dev integration directly (confirming a real run completes,
 * writes the expected rows, and behaves correctly) without waiting for the sweep task or
 * writing SQL by hand.
 *
 * Deliberately fire-and-forget: this returns the Trigger.dev run handle immediately
 * rather than blocking the request while the run executes, so it can't tie up a Vercel
 * function for the duration of a capture. Use the returned runId with the Trigger.dev
 * dashboard (or `runs.retrieve`) to check on completion.
 *
 * Does not create, modify, or activate any schedule — this only fires a single one-off
 * run of the existing task, exactly as implemented, via the standard `tasks.trigger()`
 * type-only-import pattern (never importing the task instance itself into app code).
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

  const parsed = parseTriggerAnalyticsCaptureRequestBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { userId: targetUserId, businessProfileId: targetBusinessProfileId } = parsed;

  const serviceClient = createServiceRoleClient();
  const { data: profile, error: profileError } = await serviceClient
    .from("business_profiles")
    .select("id")
    .eq("id", targetBusinessProfileId)
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json(
      { error: toSafeUserErrorMessage(profileError.message, "Failed to verify business profile") },
      { status: 502 }
    );
  }

  if (!profile) {
    return NextResponse.json(
      { error: "No business_profiles row matches that userId + businessProfileId pair" },
      { status: 404 }
    );
  }

  try {
    const handle = await tasks.trigger<typeof analyticsCaptureForTenantTask>(
      "analytics-capture-for-tenant",
      { userId: targetUserId, businessProfileId: targetBusinessProfileId, reason: "manual_trigger" }
    );

    return NextResponse.json({ runId: handle.id, taskIdentifier: handle.taskIdentifier });
  } catch (error) {
    return NextResponse.json(
      { error: toSafeUserErrorMessage(error, "Failed to trigger analytics capture") },
      { status: 502 }
    );
  }
}

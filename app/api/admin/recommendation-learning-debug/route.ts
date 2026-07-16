import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { requireAdminUser } from "@/lib/admin/requireAdminUser";
import { parseRecommendationLearningDebugRequestParams } from "@/lib/admin/recommendationLearningDebugRequest";
import { getRecommendationLearningDebugForUser } from "@/lib/recommendation-learning/debug";
import { toSafeUserErrorMessage } from "@/lib/security/safe-error-message";

/**
 * Admin/developer-only debug view (Phase 9 of Adaptive Recommendation Intelligence):
 * for every currently-active recommendation belonging to one tenant/business, shows the
 * base (current-market) score, historical adjustment, final score, confidence,
 * historical confidence, top contributing reasons, and historical sample size. Mirrors
 * the auth pattern of every other admin route in this codebase. Read-only -- never
 * mutates a recommendation, never triggers generation or publishing.
 */
export async function GET(request: Request) {
  const auth = await requireAdminUser();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const parsed = parseRecommendationLearningDebugRequestParams(searchParams);
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
    const entries = await getRecommendationLearningDebugForUser(targetUserId, businessProfileId, serviceClient);
    return NextResponse.json({ entries });
  } catch (error) {
    return NextResponse.json(
      { error: toSafeUserErrorMessage(error, "Failed to compute recommendation learning debug data") },
      { status: 502 }
    );
  }
}

import { NextResponse } from "next/server";
import { getBusinessProfileForUser } from "@/lib/business-profile-server";
import { recordRecommendationFeedback } from "@/lib/business-learning-engine/service";
import { RecommendationFeedbackValues } from "@/lib/business-learning-engine/types";
import { createClient } from "@/lib/supabase/server";

/**
 * Explicit customer feedback on a specific recommendation's real-world value
 * (Part 9) — "This helped" / "This wasn't useful," fed directly into the
 * Business Learning Engine.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await getBusinessProfileForUser();
  if (!profile) {
    return NextResponse.json({ error: "Business profile not found" }, { status: 404 });
  }

  const body = (await request.json()) as { recommendationId?: string; feedback?: string; comment?: string };
  const recommendationId = body.recommendationId?.trim();
  const feedback = body.feedback;

  if (!recommendationId) {
    return NextResponse.json({ error: "recommendationId is required" }, { status: 400 });
  }
  if (feedback !== RecommendationFeedbackValues.HELPED && feedback !== RecommendationFeedbackValues.NOT_USEFUL) {
    return NextResponse.json({ error: "feedback must be 'helped' or 'not_useful'" }, { status: 400 });
  }

  const { data: recommendation } = await supabase
    .from("marketing_recommendations")
    .select("id")
    .eq("user_id", user.id)
    .eq("business_profile_id", profile.id)
    .eq("id", recommendationId)
    .maybeSingle();

  if (!recommendation) {
    return NextResponse.json({ error: "Recommendation not found" }, { status: 404 });
  }

  const event = await recordRecommendationFeedback(supabase, {
    userId: user.id,
    businessProfileId: profile.id,
    recommendationId,
    feedback,
    comment: body.comment?.trim() || null,
  });

  if (!event) {
    return NextResponse.json({ error: "Failed to record feedback" }, { status: 500 });
  }

  return NextResponse.json({ event });
}

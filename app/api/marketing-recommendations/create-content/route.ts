import { NextResponse } from "next/server";
import { generateContentDraftForRecommendationForCurrentUser } from "@/lib/marketing-decisions/create-content";

type CreateContentBody = {
  recommendation_id?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as CreateContentBody;
  const recommendationId = body.recommendation_id?.trim();

  if (!recommendationId) {
    return NextResponse.json({ error: "recommendation_id is required" }, { status: 400 });
  }

  const { result, error } = await generateContentDraftForRecommendationForCurrentUser(
    recommendationId
  );

  if (error || !result) {
    return NextResponse.json(
      { error: error ?? "Unable to create a draft from this recommendation" },
      { status: error === "Unauthorized" ? 401 : 502 }
    );
  }

  return NextResponse.json({
    content_approval_id: result.contentApproval.id,
    title: result.contentApproval.title,
    status: result.contentApproval.status,
    recommendation_status: result.recommendation.status,
    reused: result.reused,
  });
}

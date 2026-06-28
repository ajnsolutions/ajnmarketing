import { NextResponse } from "next/server";
import { markGoogleReviewRespondedForCurrentUser } from "@/lib/google-business/service";

export async function POST(request: Request) {
  const body = (await request.json()) as { reviewId?: string };

  if (!body.reviewId) {
    return NextResponse.json({ error: "Review id is required" }, { status: 400 });
  }

  const { review, error } = await markGoogleReviewRespondedForCurrentUser(body.reviewId);

  if (error || !review) {
    return NextResponse.json(
      { error: error ?? "Unable to mark review responded" },
      { status: error === "Unauthorized" ? 401 : 404 }
    );
  }

  return NextResponse.json({ review });
}

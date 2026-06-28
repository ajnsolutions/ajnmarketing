import { NextResponse } from "next/server";
import { draftGoogleReviewReplyForCurrentUser } from "@/lib/google-business/service";

export async function POST(request: Request) {
  const body = (await request.json()) as { reviewId?: string };

  if (!body.reviewId) {
    return NextResponse.json({ error: "Review id is required" }, { status: 400 });
  }

  const { review, error } = await draftGoogleReviewReplyForCurrentUser(body.reviewId);

  if (error || !review) {
    return NextResponse.json(
      { error: error ?? "Unable to draft review reply" },
      { status: error === "Unauthorized" ? 401 : 502 }
    );
  }

  return NextResponse.json({ review });
}

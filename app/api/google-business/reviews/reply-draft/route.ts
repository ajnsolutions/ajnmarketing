import { NextResponse } from "next/server";
import { queueBackgroundJobForCurrentUser } from "@/lib/background-jobs/service";
import { BackgroundJobTypes } from "@/lib/background-jobs/types";

export async function POST(request: Request) {
  const body = (await request.json()) as { reviewId?: string };

  if (!body.reviewId) {
    return NextResponse.json({ error: "Review id is required" }, { status: 400 });
  }

  const { job, duplicate, error } = await queueBackgroundJobForCurrentUser({
    jobType: BackgroundJobTypes.REVIEW_REPLY_GENERATION,
    priority: "normal",
    payload: { reviewId: body.reviewId },
  });

  if (error || !job) {
    return NextResponse.json(
      { error: error ?? "Unable to queue review reply generation" },
      { status: error === "Unauthorized" ? 401 : 502 }
    );
  }

  return NextResponse.json({ job, duplicate: Boolean(duplicate) });
}

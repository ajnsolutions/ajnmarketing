import { NextResponse } from "next/server";
import { queueBackgroundJobForCurrentUser } from "@/lib/background-jobs/service";
import { BackgroundJobTypes } from "@/lib/background-jobs/types";

export async function POST() {
  const { job, duplicate, error } = await queueBackgroundJobForCurrentUser({
    jobType: BackgroundJobTypes.GOOGLE_BUSINESS_SYNC,
    priority: "high",
  });

  if (error || !job) {
    return NextResponse.json(
      { success: false, syncLog: null, error: error ?? "Unable to queue Google Business sync" },
      { status: error === "Unauthorized" ? 401 : 502 }
    );
  }

  return NextResponse.json({
    success: true,
    job,
    duplicate: Boolean(duplicate),
    syncLog: null,
  });
}

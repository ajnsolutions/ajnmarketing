import { NextResponse } from "next/server";
import { queueBackgroundJobForCurrentUser } from "@/lib/background-jobs/service";
import { BackgroundJobTypes } from "@/lib/background-jobs/types";
import type { ContentGenerationRequest } from "@/lib/content-generator/types";

export async function POST(request: Request) {
  const body = (await request.json()) as ContentGenerationRequest;

  if (!body.contentType?.trim()) {
    return NextResponse.json({ error: "Content type is required" }, { status: 400 });
  }

  const { job, duplicate, error } = await queueBackgroundJobForCurrentUser({
    jobType: BackgroundJobTypes.AI_CONTENT_GENERATION,
    priority: "normal",
    payload: body as unknown as Record<string, unknown>,
  });

  if (error || !job) {
    return NextResponse.json(
      { error: error ?? "Unable to queue content generation" },
      { status: error === "Unauthorized" ? 401 : 502 }
    );
  }

  return NextResponse.json({ job, duplicate: Boolean(duplicate) });
}

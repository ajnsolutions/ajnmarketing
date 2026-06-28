import { NextResponse } from "next/server";
import { generateContentForCurrentUser } from "@/lib/content-generator/service";
import type { ContentGenerationRequest } from "@/lib/content-generator/types";

export async function POST(request: Request) {
  const body = (await request.json()) as ContentGenerationRequest;

  if (!body.contentType?.trim()) {
    return NextResponse.json({ error: "Content type is required" }, { status: 400 });
  }

  const { result, error } = await generateContentForCurrentUser(body);

  if (error || !result) {
    return NextResponse.json(
      { error: error ?? "Content generation failed" },
      { status: error === "Unauthorized" ? 401 : 502 }
    );
  }

  return NextResponse.json({ result });
}

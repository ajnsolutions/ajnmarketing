import { NextResponse } from "next/server";
import { createContentFromMarketingPlanItemForCurrentUser } from "@/lib/marketing-planner/create-content";
import type { MarketingPlanCreateContentInput } from "@/lib/marketing-planner/types";

export async function POST(request: Request) {
  const body = (await request.json()) as MarketingPlanCreateContentInput;

  const { result, error } = await createContentFromMarketingPlanItemForCurrentUser(body);

  if (error || !result) {
    return NextResponse.json(
      { error: error ?? "Unable to create content from marketing plan item" },
      { status: error === "Unauthorized" ? 401 : 502 }
    );
  }

  return NextResponse.json(result);
}

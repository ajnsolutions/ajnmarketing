import { NextResponse } from "next/server";
import {
  getMarketingAgentTasksForCurrentUser,
  patchMarketingAgentTaskForCurrentUser,
  regenerateMarketingAgentTasksForCurrentUser,
} from "@/lib/marketing-agent/service";
import type { MarketingAgentTaskPatchInput } from "@/lib/marketing-agent/types";

export async function GET() {
  const data = await getMarketingAgentTasksForCurrentUser();
  return NextResponse.json(data);
}

export async function POST() {
  const { data, error } = await regenerateMarketingAgentTasksForCurrentUser();

  if (error) {
    return NextResponse.json({ ...data, error }, { status: error === "Unauthorized" ? 401 : 502 });
  }

  return NextResponse.json(data);
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as MarketingAgentTaskPatchInput;

  if (!body.id || !body.action) {
    return NextResponse.json({ error: "Task id and action are required" }, { status: 400 });
  }

  const { task, error } = await patchMarketingAgentTaskForCurrentUser(body);

  if (error || !task) {
    return NextResponse.json(
      { error: error ?? "Unable to update task" },
      { status: error === "Unauthorized" ? 401 : 404 }
    );
  }

  return NextResponse.json({ task });
}

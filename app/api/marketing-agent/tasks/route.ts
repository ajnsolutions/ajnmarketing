import { NextResponse } from "next/server";
import {
  getMarketingAgentTasksForCurrentUser,
  patchMarketingAgentTaskForCurrentUser,
} from "@/lib/marketing-agent/service";
import { queueBackgroundJobForCurrentUser } from "@/lib/background-jobs/service";
import { BackgroundJobTypes } from "@/lib/background-jobs/types";
import type { MarketingAgentTaskPatchInput } from "@/lib/marketing-agent/types";

export async function GET() {
  const data = await getMarketingAgentTasksForCurrentUser();
  return NextResponse.json(data);
}

export async function POST() {
  const { job, duplicate, error } = await queueBackgroundJobForCurrentUser({
    jobType: BackgroundJobTypes.AI_TASK_GENERATION,
    priority: "normal",
  });

  if (error || !job) {
    return NextResponse.json(
      {
        tasks: [],
        stats: { dueToday: 0, completedToday: 0, highPriorityPending: 0, topPriority: null },
        error: error ?? "Unable to queue AI task generation",
      },
      { status: error === "Unauthorized" ? 401 : 502 }
    );
  }

  return NextResponse.json({ job, duplicate: Boolean(duplicate) });
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

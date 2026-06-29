import { NextResponse } from "next/server";
import {
  listBackgroundJobsForCurrentUser,
  patchBackgroundJobForCurrentUser,
  queueBackgroundJobForCurrentUser,
} from "@/lib/background-jobs/service";
import type { BackgroundJobPatchInput, BackgroundJobStatus } from "@/lib/background-jobs/types";
import { BackgroundJobTypes } from "@/lib/background-jobs/types";

const VALID_JOB_TYPES = new Set<string>(Object.values(BackgroundJobTypes));

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");
  const status = statusParam ? (statusParam as BackgroundJobStatus) : undefined;
  const jobType = searchParams.get("jobType") ?? undefined;
  const id = searchParams.get("id") ?? undefined;

  const { jobs, job } = await listBackgroundJobsForCurrentUser({
    status,
    jobType,
    id,
    limit: 25,
  });

  if (id) {
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    return NextResponse.json({ job, jobs: [job] });
  }

  return NextResponse.json({ jobs });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    jobType?: string;
    priority?: "high" | "normal" | "low";
    payload?: Record<string, unknown>;
    force?: boolean;
  };

  if (!body.jobType?.trim() || !VALID_JOB_TYPES.has(body.jobType)) {
    return NextResponse.json({ error: "Valid job type is required" }, { status: 400 });
  }

  const { job, duplicate, error } = await queueBackgroundJobForCurrentUser({
    jobType: body.jobType,
    priority: body.priority,
    payload: body.payload,
    force: body.force,
  });

  if (error || !job) {
    return NextResponse.json(
      { error: error ?? "Unable to queue job" },
      { status: error === "Unauthorized" ? 401 : 502 }
    );
  }

  return NextResponse.json({ job, duplicate: Boolean(duplicate) });
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as BackgroundJobPatchInput;

  if (!body.id || !body.action) {
    return NextResponse.json({ error: "Job id and action are required" }, { status: 400 });
  }

  if (body.action !== "retry" && body.action !== "cancel") {
    return NextResponse.json({ error: "Unsupported job action" }, { status: 400 });
  }

  const { job, error } = await patchBackgroundJobForCurrentUser(body);

  if (error || !job) {
    return NextResponse.json(
      { error: error ?? "Unable to update job" },
      { status: error === "Unauthorized" ? 401 : 404 }
    );
  }

  return NextResponse.json({ job });
}

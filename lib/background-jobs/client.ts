import type {
  BackgroundJob,
  BackgroundJobCreateInput,
  BackgroundJobPatchInput,
  BackgroundJobPriority,
  BackgroundJobType,
} from "@/lib/background-jobs/types";

export async function queueBackgroundJob(input: {
  jobType: BackgroundJobType | string;
  priority?: BackgroundJobPriority;
  payload?: Record<string, unknown>;
  force?: boolean;
}): Promise<{ job: BackgroundJob | null; duplicate?: boolean; error?: string }> {
  const response = await fetch("/api/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const payload = (await response.json()) as {
    job?: BackgroundJob | null;
    duplicate?: boolean;
    error?: string;
  };

  if (!response.ok) {
    return { job: null, error: payload.error ?? "Unable to queue job" };
  }

  return { job: payload.job ?? null, duplicate: payload.duplicate };
}

export async function fetchBackgroundJobs(options?: {
  status?: BackgroundJob["status"];
  jobType?: string;
  id?: string;
}): Promise<{ jobs: BackgroundJob[]; job: BackgroundJob | null; error?: string }> {
  const params = new URLSearchParams();
  if (options?.status) params.set("status", options.status);
  if (options?.jobType) params.set("jobType", options.jobType);
  if (options?.id) params.set("id", options.id);

  const query = params.toString();
  const response = await fetch(`/api/jobs${query ? `?${query}` : ""}`, { method: "GET" });
  const payload = (await response.json()) as {
    jobs?: BackgroundJob[];
    job?: BackgroundJob | null;
    error?: string;
  };

  if (!response.ok) {
    return { jobs: [], job: null, error: payload.error ?? "Unable to load jobs" };
  }

  return {
    jobs: payload.jobs ?? [],
    job: payload.job ?? null,
  };
}

export async function patchBackgroundJob(
  input: BackgroundJobPatchInput
): Promise<{ job: BackgroundJob | null; error?: string }> {
  const response = await fetch("/api/jobs", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const payload = (await response.json()) as {
    job?: BackgroundJob | null;
    error?: string;
  };

  if (!response.ok) {
    return { job: null, error: payload.error ?? "Unable to update job" };
  }

  return { job: payload.job ?? null };
}

export async function pollBackgroundJobUntilSettled(
  jobId: string,
  options?: { intervalMs?: number; timeoutMs?: number }
): Promise<{ job: BackgroundJob | null; error?: string }> {
  const intervalMs = options?.intervalMs ?? 2000;
  const timeoutMs = options?.timeoutMs ?? 120000;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const { job, error } = await fetchBackgroundJobs({ id: jobId });

    if (error) {
      return { job: null, error };
    }

    if (!job) {
      return { job: null, error: "Job not found" };
    }

    if (job.status === "completed") {
      return { job };
    }

    if (job.status === "failed" || job.status === "cancelled") {
      return { job, error: job.error ?? "Background job failed" };
    }

    await new Promise((resolve) => window.setTimeout(resolve, intervalMs));
  }

  return { job: null, error: "Background job timed out" };
}

export type { BackgroundJobCreateInput };

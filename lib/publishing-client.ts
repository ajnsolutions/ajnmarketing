import type { PublishingHistoryEntry, PublishingJob } from "@/lib/publishing/publishingTypes";

export async function fetchPublishingJobs(): Promise<{
  jobs: PublishingJob[];
  error?: string;
}> {
  const response = await fetch("/api/publishing", { method: "GET", cache: "no-store" });
  const payload = (await response.json()) as { jobs?: PublishingJob[]; error?: string };

  if (!response.ok) {
    return { jobs: [], error: payload.error ?? "Unable to load publishing jobs" };
  }

  return { jobs: payload.jobs ?? [] };
}

export async function fetchPublishingHistory(publishingJobId: string): Promise<{
  history: PublishingHistoryEntry[];
  error?: string;
}> {
  const response = await fetch(`/api/publishing?historyFor=${encodeURIComponent(publishingJobId)}`);
  const payload = (await response.json()) as {
    history?: PublishingHistoryEntry[];
    error?: string;
  };

  if (!response.ok) {
    return { history: [], error: payload.error ?? "Unable to load publishing history" };
  }

  return { history: payload.history ?? [] };
}

export async function publishNowRequest(publishingQueueId: string): Promise<{
  job: PublishingJob | null;
  error?: string;
}> {
  const response = await fetch("/api/publishing", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "publish_now", publishingQueueId }),
  });

  const payload = (await response.json()) as { job?: PublishingJob | null; error?: string };

  if (!response.ok) {
    return { job: null, error: payload.error ?? "Unable to publish now" };
  }

  return { job: payload.job ?? null };
}

export async function schedulePublishRequest(
  publishingQueueId: string,
  scheduledFor: string
): Promise<{ job: PublishingJob | null; error?: string }> {
  const response = await fetch("/api/publishing", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "schedule", publishingQueueId, scheduledFor }),
  });

  const payload = (await response.json()) as { job?: PublishingJob | null; error?: string };

  if (!response.ok) {
    return { job: null, error: payload.error ?? "Unable to schedule publishing" };
  }

  return { job: payload.job ?? null };
}

export async function retryPublishRequest(publishingJobId: string): Promise<{
  job: PublishingJob | null;
  error?: string;
}> {
  const response = await fetch("/api/publishing", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "retry", publishingJobId }),
  });

  const payload = (await response.json()) as { job?: PublishingJob | null; error?: string };

  if (!response.ok) {
    return { job: null, error: payload.error ?? "Unable to retry publishing" };
  }

  return { job: payload.job ?? null };
}

export async function cancelPublishRequest(publishingJobId: string): Promise<{
  job: PublishingJob | null;
  error?: string;
}> {
  const response = await fetch("/api/publishing", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "cancel", publishingJobId }),
  });

  const payload = (await response.json()) as { job?: PublishingJob | null; error?: string };

  if (!response.ok) {
    return { job: null, error: payload.error ?? "Unable to cancel publishing" };
  }

  return { job: payload.job ?? null };
}

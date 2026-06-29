import type { WebsiteAnalysis } from "@/lib/website-analysis/types";
import {
  pollBackgroundJobUntilSettled,
  queueBackgroundJob,
} from "@/lib/background-jobs/client";
import { BackgroundJobTypes } from "@/lib/background-jobs/types";

export async function fetchWebsiteAnalysis(): Promise<{
  analysis: WebsiteAnalysis | null;
  error?: string;
}> {
  const response = await fetch("/api/website-analysis", { method: "GET" });
  const payload = (await response.json()) as {
    analysis?: WebsiteAnalysis | null;
    error?: string;
  };

  if (!response.ok) {
    return { analysis: null, error: payload.error ?? "Unable to load website analysis" };
  }

  return { analysis: payload.analysis ?? null };
}

export async function queueWebsiteAnalysis(): Promise<{
  analysis: WebsiteAnalysis | null;
  jobId?: string;
  error?: string;
}> {
  const { job, error } = await queueBackgroundJob({
    jobType: BackgroundJobTypes.WEBSITE_ANALYSIS,
    priority: "high",
  });

  if (error || !job) {
    return { analysis: null, error: error ?? "Unable to start website analysis" };
  }

  const { error: pollError } = await pollBackgroundJobUntilSettled(job.id);
  if (pollError) {
    return { analysis: null, jobId: job.id, error: pollError };
  }

  const refreshed = await fetchWebsiteAnalysis();
  return { ...refreshed, jobId: job.id };
}

import type { MarketingPlan } from "@/lib/marketing-planner/types";
import type {
  MarketingPlanCreateContentInput,
  MarketingPlanCreateContentResult,
} from "@/lib/marketing-planner/types";
import {
  pollBackgroundJobUntilSettled,
  queueBackgroundJob,
} from "@/lib/background-jobs/client";
import { BackgroundJobTypes } from "@/lib/background-jobs/types";

export async function fetchMarketingPlan(): Promise<{
  plan: MarketingPlan | null;
  error?: string;
}> {
  const response = await fetch("/api/marketing-plan", { method: "GET" });
  const payload = (await response.json()) as {
    plan?: MarketingPlan | null;
    error?: string;
  };

  if (!response.ok) {
    return { plan: null, error: payload.error ?? "Unable to load marketing plan" };
  }

  return { plan: payload.plan ?? null };
}

export async function refreshMarketingPlan(): Promise<{
  plan: MarketingPlan | null;
  jobId?: string;
  error?: string;
}> {
  const { job, error } = await queueBackgroundJob({
    jobType: BackgroundJobTypes.MARKETING_PLAN_GENERATION,
    priority: "high",
  });

  if (error || !job) {
    return { plan: null, error: error ?? "Unable to generate marketing plan" };
  }

  const { error: pollError } = await pollBackgroundJobUntilSettled(job.id, {
    timeoutMs: 180000,
  });

  if (pollError) {
    return { plan: null, jobId: job.id, error: pollError };
  }

  const refreshed = await fetchMarketingPlan();
  return { ...refreshed, jobId: job.id };
}

export async function createMarketingPlanContent(
  input: MarketingPlanCreateContentInput
): Promise<{ result: MarketingPlanCreateContentResult | null; error?: string }> {
  const response = await fetch("/api/marketing-plan/create-content", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const payload = (await response.json()) as MarketingPlanCreateContentResult & { error?: string };

  if (!response.ok) {
    return {
      result: null,
      error: payload.error ?? "Unable to create content from marketing plan item",
    };
  }

  return {
    result: {
      content_approval_id: payload.content_approval_id,
      title: payload.title,
      status: payload.status,
    },
  };
}

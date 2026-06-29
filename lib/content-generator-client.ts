import type {
  ContentGenerationRequest,
  ContentGenerationResult,
  GeneratedContentVariation,
} from "@/lib/content-generator/types";
import {
  pollBackgroundJobUntilSettled,
  queueBackgroundJob,
} from "@/lib/background-jobs/client";
import { BackgroundJobTypes } from "@/lib/background-jobs/types";

export async function generateContent(
  request: ContentGenerationRequest
): Promise<{ result: ContentGenerationResult | null; jobId?: string; error?: string }> {
  const { job, error } = await queueBackgroundJob({
    jobType: BackgroundJobTypes.AI_CONTENT_GENERATION,
    priority: "normal",
    payload: request as unknown as Record<string, unknown>,
  });

  if (error || !job) {
    return { result: null, error: error ?? "Unable to generate content" };
  }

  const { job: completedJob, error: pollError } = await pollBackgroundJobUntilSettled(job.id, {
    timeoutMs: 120000,
  });

  if (pollError || !completedJob) {
    return { result: null, jobId: job.id, error: pollError ?? "Content generation failed" };
  }

  const variations = completedJob.result?.variations as GeneratedContentVariation[] | undefined;

  if (!variations?.length) {
    return { result: null, jobId: job.id, error: "Content generation returned no results" };
  }

  return { result: { variations }, jobId: job.id };
}

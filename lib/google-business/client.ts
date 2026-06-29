import type {
  GoogleBusinessDashboardData,
  GoogleBusinessReview,
  GoogleBusinessSyncResult,
} from "@/lib/google-business/types";
import {
  pollBackgroundJobUntilSettled,
  queueBackgroundJob,
} from "@/lib/background-jobs/client";
import { BackgroundJobTypes } from "@/lib/background-jobs/types";

export async function syncGoogleBusinessProfile(): Promise<{
  data: GoogleBusinessSyncResult;
  jobId?: string;
  error?: string;
}> {
  const { job, error } = await queueBackgroundJob({
    jobType: BackgroundJobTypes.GOOGLE_BUSINESS_SYNC,
    priority: "high",
  });

  if (error || !job) {
    return {
      data: { success: false, syncLog: null },
      error: error ?? "Unable to sync Google Business Profile data",
    };
  }

  const { job: completedJob, error: pollError } = await pollBackgroundJobUntilSettled(job.id, {
    timeoutMs: 120000,
  });

  if (pollError || completedJob?.status !== "completed") {
    return {
      data: { success: false, syncLog: null },
      jobId: job.id,
      error: pollError ?? "Google Business sync failed",
    };
  }

  return {
    data: {
      success: true,
      syncLog: null,
      error: undefined,
    },
    jobId: job.id,
  };
}

export async function draftGoogleReviewReplyClient(reviewId: string): Promise<{
  review: GoogleBusinessReview | null;
  jobId?: string;
  error?: string;
}> {
  const { job, error } = await queueBackgroundJob({
    jobType: BackgroundJobTypes.REVIEW_REPLY_GENERATION,
    priority: "normal",
    payload: { reviewId },
  });

  if (error || !job) {
    return { review: null, error: error ?? "Unable to draft review reply" };
  }

  const { job: completedJob, error: pollError } = await pollBackgroundJobUntilSettled(job.id);

  if (pollError || completedJob?.status !== "completed") {
    return { review: null, jobId: job.id, error: pollError ?? "Review reply generation failed" };
  }

  return { review: null, jobId: job.id };
}

export async function markGoogleReviewRespondedClient(reviewId: string): Promise<{
  review: GoogleBusinessReview | null;
  error?: string;
}> {
  const response = await fetch("/api/google-business/reviews/mark-responded", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reviewId }),
  });

  const payload = (await response.json()) as {
    review?: GoogleBusinessReview | null;
    error?: string;
  };

  if (!response.ok) {
    return { review: null, error: payload.error ?? "Unable to mark review responded" };
  }

  return { review: payload.review ?? null };
}

export type { GoogleBusinessDashboardData };

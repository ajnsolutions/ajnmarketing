import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { BackgroundJobTypes, MAX_BACKGROUND_JOB_ATTEMPTS } from "@/lib/background-jobs/types";
import type { BackgroundJob, BackgroundJobType } from "@/lib/background-jobs/types";

/**
 * Documented, deterministic thresholds for "stuck" classification. These are
 * intentionally conservative — a job past this age has not been re-queued or
 * completed by the normal request-scoped worker (lib/background-jobs/worker.ts),
 * which strongly suggests it needs operator attention rather than more waiting.
 */
export const STUCK_QUEUED_THRESHOLD_MINUTES = 30;
export const STUCK_RUNNING_THRESHOLD_MINUTES = 15;

export const RetrySafetyClassifications = {
  SAFE_AND_IDEMPOTENT: "safe_and_idempotent",
  SAFE_WITH_DEDUPLICATION: "safe_with_deduplication",
  REQUIRES_OPERATOR_REVIEW: "requires_operator_review",
  NOT_RETRYABLE: "not_retryable",
} as const;

export type RetrySafetyClassification =
  (typeof RetrySafetyClassifications)[keyof typeof RetrySafetyClassifications];

/**
 * Job types that only refresh/regenerate internal state (no external provider side
 * effect that could be duplicated) are safe to retry outright. Publishing is the one
 * job type with a real external side effect (a provider post) and duplicate-publish
 * risk, so it always requires operator review here regardless of attempt count —
 * lib/publishing/retryManager.ts's own backoff already handles the *scheduled* retry
 * path; this classification is specifically about *manual* operator-triggered retry.
 */
const IDEMPOTENT_JOB_TYPES: ReadonlySet<BackgroundJobType> = new Set([
  BackgroundJobTypes.WEBSITE_ANALYSIS,
  BackgroundJobTypes.MARKETING_PLAN_GENERATION,
  BackgroundJobTypes.AI_TASK_GENERATION,
  BackgroundJobTypes.GOOGLE_BUSINESS_SYNC,
  BackgroundJobTypes.AI_CONTENT_GENERATION,
  BackgroundJobTypes.REVIEW_REPLY_GENERATION,
  BackgroundJobTypes.FACEBOOK_SYNC,
  BackgroundJobTypes.INSTAGRAM_SYNC,
  BackgroundJobTypes.LINKEDIN_SYNC,
  BackgroundJobTypes.ANALYTICS_CAPTURE,
  BackgroundJobTypes.OPPORTUNITY_DETECTION,
  BackgroundJobTypes.RECOMMENDATION_PIPELINE,
]);

export function classifyRetrySafety(job: Pick<BackgroundJob, "job_type" | "status" | "attempts">): RetrySafetyClassification {
  if (job.status !== "failed" && job.status !== "cancelled") {
    return RetrySafetyClassifications.NOT_RETRYABLE;
  }
  if (job.job_type === BackgroundJobTypes.PUBLISHING_EXECUTE) {
    return RetrySafetyClassifications.REQUIRES_OPERATOR_REVIEW;
  }
  if (job.attempts >= MAX_BACKGROUND_JOB_ATTEMPTS) {
    // Exhausted the automatic retry budget — a manual retry is still possible but is
    // no longer "safe by default"; surface it for operator review rather than a
    // one-click retry.
    return RetrySafetyClassifications.REQUIRES_OPERATOR_REVIEW;
  }
  if (IDEMPOTENT_JOB_TYPES.has(job.job_type as BackgroundJobType)) {
    return RetrySafetyClassifications.SAFE_AND_IDEMPOTENT;
  }
  return RetrySafetyClassifications.SAFE_WITH_DEDUPLICATION;
}

export type StuckJobSummary = {
  id: string;
  userId: string;
  businessProfileId: string | null;
  jobType: string;
  status: string;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  stuckSinceMinutes: number;
  reason: "queued_too_long" | "running_too_long";
};

/**
 * Deterministic stuck-job detection over background_jobs. Bounded to a recent
 * window (default 7 days) and a result cap — this is an operator diagnostic list,
 * not an unbounded table scan.
 */
export async function findStuckBackgroundJobs(
  supabase: SupabaseClient,
  options?: { withinDays?: number; limit?: number }
): Promise<StuckJobSummary[]> {
  const withinDays = options?.withinDays ?? 7;
  const limit = Math.min(200, Math.max(1, options?.limit ?? 100));
  const since = new Date(Date.now() - withinDays * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("background_jobs")
    .select("id, user_id, business_profile_id, job_type, status, attempts, created_at, updated_at")
    .in("status", ["queued", "running"])
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error || !data) return [];

  const now = Date.now();
  const results: StuckJobSummary[] = [];

  for (const row of data as Array<
    Pick<
      BackgroundJob,
      "id" | "user_id" | "business_profile_id" | "job_type" | "status" | "attempts" | "created_at" | "updated_at"
    >
  >) {
    const referenceTime = new Date(row.updated_at ?? row.created_at).getTime();
    const ageMinutes = Math.round((now - referenceTime) / 60000);

    if (row.status === "queued" && ageMinutes >= STUCK_QUEUED_THRESHOLD_MINUTES) {
      results.push({
        id: row.id,
        userId: row.user_id,
        businessProfileId: row.business_profile_id,
        jobType: row.job_type,
        status: row.status,
        attempts: row.attempts,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        stuckSinceMinutes: ageMinutes,
        reason: "queued_too_long",
      });
    } else if (row.status === "running" && ageMinutes >= STUCK_RUNNING_THRESHOLD_MINUTES) {
      results.push({
        id: row.id,
        userId: row.user_id,
        businessProfileId: row.business_profile_id,
        jobType: row.job_type,
        status: row.status,
        attempts: row.attempts,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        stuckSinceMinutes: ageMinutes,
        reason: "running_too_long",
      });
    }
  }

  return results;
}

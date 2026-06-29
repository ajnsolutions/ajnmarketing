import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BackgroundJob,
  BackgroundJobCreateInput,
  BackgroundJobPriority,
  BackgroundJobStatus,
  BackgroundJobSummary,
} from "@/lib/background-jobs/types";
import { ACTIVE_BACKGROUND_JOB_STATUSES } from "@/lib/background-jobs/types";

const BLOCKED_PAYLOAD_KEYS = new Set([
  "access_token",
  "refresh_token",
  "token",
  "secret",
  "password",
  "prompt",
  "content",
  "website_content",
  "html",
]);

function sanitizePayload(payload: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!payload) return {};

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (BLOCKED_PAYLOAD_KEYS.has(key.toLowerCase())) continue;
    if (value === undefined) continue;
    if (typeof value === "string" && value.length > 2000) {
      sanitized[key] = `${value.slice(0, 2000)}…`;
      continue;
    }
    sanitized[key] = value;
  }
  return sanitized;
}

function sanitizeResult(result: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!result) return null;
  return sanitizePayload(result);
}

export function toBackgroundJobSummary(job: BackgroundJob): BackgroundJobSummary {
  return {
    id: job.id,
    job_type: job.job_type,
    status: job.status,
    priority: job.priority,
    error: job.error,
    attempts: job.attempts,
    created_at: job.created_at,
    completed_at: job.completed_at,
  };
}

export async function findActiveBackgroundJob(
  supabase: SupabaseClient,
  input: {
    userId: string;
    businessProfileId: string | null;
    jobType: string;
  }
): Promise<BackgroundJob | null> {
  let query = supabase
    .from("background_jobs")
    .select("*")
    .eq("user_id", input.userId)
    .eq("job_type", input.jobType)
    .in("status", ACTIVE_BACKGROUND_JOB_STATUSES)
    .order("created_at", { ascending: false })
    .limit(1);

  if (input.businessProfileId) {
    query = query.eq("business_profile_id", input.businessProfileId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error("[BackgroundJobs] Active lookup failed:", error.message);
    return null;
  }

  return (data as BackgroundJob | null) ?? null;
}

export async function insertBackgroundJob(
  supabase: SupabaseClient,
  input: BackgroundJobCreateInput
): Promise<BackgroundJob | null> {
  const { data, error } = await supabase
    .from("background_jobs")
    .insert({
      user_id: input.userId,
      business_profile_id: input.businessProfileId ?? null,
      job_type: input.jobType,
      priority: input.priority ?? "normal",
      payload: sanitizePayload(input.payload),
      status: "queued",
    })
    .select("*")
    .single();

  if (error) {
    console.error("[BackgroundJobs] Insert failed:", error.message);
    return null;
  }

  return data as BackgroundJob;
}

export async function getBackgroundJobById(
  supabase: SupabaseClient,
  userId: string,
  jobId: string
): Promise<BackgroundJob | null> {
  const { data, error } = await supabase
    .from("background_jobs")
    .select("*")
    .eq("user_id", userId)
    .eq("id", jobId)
    .maybeSingle();

  if (error) {
    console.error("[BackgroundJobs] Fetch by id failed:", error.message);
    return null;
  }

  return (data as BackgroundJob | null) ?? null;
}

export async function getBackgroundJobsForUser(
  supabase: SupabaseClient,
  userId: string,
  options?: {
    status?: BackgroundJobStatus;
    jobType?: string;
    limit?: number;
  }
): Promise<BackgroundJob[]> {
  let query = supabase
    .from("background_jobs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(options?.limit ?? 25);

  if (options?.status) {
    query = query.eq("status", options.status);
  }

  if (options?.jobType) {
    query = query.eq("job_type", options.jobType);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[BackgroundJobs] List failed:", error.message);
    return [];
  }

  return (data ?? []) as BackgroundJob[];
}

export async function markBackgroundJobRunning(
  supabase: SupabaseClient,
  jobId: string,
  attempts: number
): Promise<BackgroundJob | null> {
  const { data, error } = await supabase
    .from("background_jobs")
    .update({
      status: "running",
      attempts,
      started_at: new Date().toISOString(),
      error: null,
    })
    .eq("id", jobId)
    .eq("status", "queued")
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("[BackgroundJobs] Mark running failed:", error.message);
    return null;
  }

  return (data as BackgroundJob | null) ?? null;
}

export async function markBackgroundJobCompleted(
  supabase: SupabaseClient,
  jobId: string,
  result: Record<string, unknown> | null
): Promise<BackgroundJob | null> {
  const { data, error } = await supabase
    .from("background_jobs")
    .update({
      status: "completed",
      result: sanitizeResult(result),
      error: null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("[BackgroundJobs] Mark completed failed:", error.message);
    return null;
  }

  return (data as BackgroundJob | null) ?? null;
}

export async function markBackgroundJobFailed(
  supabase: SupabaseClient,
  jobId: string,
  errorMessage: string,
  requeue: boolean
): Promise<BackgroundJob | null> {
  const { data, error } = await supabase
    .from("background_jobs")
    .update({
      status: requeue ? "queued" : "failed",
      error: errorMessage,
      completed_at: requeue ? null : new Date().toISOString(),
      started_at: requeue ? null : undefined,
    })
    .eq("id", jobId)
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("[BackgroundJobs] Mark failed failed:", error.message);
    return null;
  }

  return (data as BackgroundJob | null) ?? null;
}

export async function markBackgroundJobCancelled(
  supabase: SupabaseClient,
  userId: string,
  jobId: string
): Promise<BackgroundJob | null> {
  const { data, error } = await supabase
    .from("background_jobs")
    .update({
      status: "cancelled",
      completed_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .eq("user_id", userId)
    .in("status", ["queued", "running"])
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("[BackgroundJobs] Cancel failed:", error.message);
    return null;
  }

  return (data as BackgroundJob | null) ?? null;
}

export async function resetBackgroundJobForRetry(
  supabase: SupabaseClient,
  userId: string,
  jobId: string
): Promise<BackgroundJob | null> {
  const { data, error } = await supabase
    .from("background_jobs")
    .update({
      status: "queued",
      error: null,
      result: null,
      attempts: 0,
      started_at: null,
      completed_at: null,
    })
    .eq("id", jobId)
    .eq("user_id", userId)
    .in("status", ["failed", "cancelled"])
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("[BackgroundJobs] Retry reset failed:", error.message);
    return null;
  }

  return (data as BackgroundJob | null) ?? null;
}

export async function getBackgroundJobCountsForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<{ queued: number; running: number; failed: number; completed: number }> {
  const { data, error } = await supabase
    .from("background_jobs")
    .select("status")
    .eq("user_id", userId);

  if (error || !data) {
    return { queued: 0, running: 0, failed: 0, completed: 0 };
  }

  return data.reduce(
    (acc, row) => {
      const status = row.status as BackgroundJobStatus;
      if (status === "queued") acc.queued += 1;
      if (status === "running") acc.running += 1;
      if (status === "failed") acc.failed += 1;
      if (status === "completed") acc.completed += 1;
      return acc;
    },
    { queued: 0, running: 0, failed: 0, completed: 0 }
  );
}

export function sortJobsByPriority(jobs: BackgroundJob[]): BackgroundJob[] {
  const priorityRank: Record<BackgroundJobPriority, number> = {
    high: 0,
    normal: 1,
    low: 2,
  };

  return [...jobs].sort((a, b) => {
    const priorityDiff = priorityRank[a.priority] - priorityRank[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

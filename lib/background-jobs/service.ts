import "server-only";

import {
  getBackgroundJobById,
  getBackgroundJobCountsForUser,
  getBackgroundJobsForUser,
  markBackgroundJobCancelled,
  resetBackgroundJobForRetry,
  toBackgroundJobSummary,
} from "@/lib/background-jobs/persistence";
import { enqueueBackgroundJob } from "@/lib/background-jobs/queue";
import {
  processQueuedBackgroundJobsForUser,
  scheduleBackgroundJobProcessing,
} from "@/lib/background-jobs/scheduler";
import type {
  BackgroundJob,
  BackgroundJobCreateInput,
  BackgroundJobDashboardData,
  BackgroundJobPatchInput,
  BackgroundJobQueueResult,
} from "@/lib/background-jobs/types";
import { AuditActions, logAuditEvent } from "@/lib/audit-log-server";
import { getBusinessProfileForUser } from "@/lib/business-profile-server";
import { createClient } from "@/lib/supabase/server";

async function resolveBusinessProfileId(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("business_profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  return data?.id ?? null;
}

export async function queueBackgroundJobForCurrentUser(
  input: Omit<BackgroundJobCreateInput, "userId"> & { userId?: string }
): Promise<BackgroundJobQueueResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { job: null, error: "Unauthorized" };
  }

  const businessProfileId =
    input.businessProfileId ?? (await resolveBusinessProfileId(user.id));

  const result = await enqueueBackgroundJob({
    ...input,
    userId: user.id,
    businessProfileId,
  });

  if (result.job && !result.duplicate) {
    scheduleBackgroundJobProcessing(result.job.id);
  }

  return result;
}

export async function listBackgroundJobsForCurrentUser(options?: {
  status?: BackgroundJob["status"];
  jobType?: string;
  id?: string;
  limit?: number;
}): Promise<{ jobs: BackgroundJob[]; job: BackgroundJob | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { jobs: [], job: null };
  }

  if (options?.id) {
    const job = await getBackgroundJobById(supabase, user.id, options.id);
    return { jobs: job ? [job] : [], job };
  }

  const jobs = await getBackgroundJobsForUser(supabase, user.id, {
    status: options?.status,
    jobType: options?.jobType,
    limit: options?.limit,
  });

  void processQueuedBackgroundJobsForUser(user.id);

  return { jobs, job: null };
}

export async function patchBackgroundJobForCurrentUser(
  input: BackgroundJobPatchInput
): Promise<{ job: BackgroundJob | null; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { job: null, error: "Unauthorized" };
  }

  if (input.action === "cancel") {
    const job = await markBackgroundJobCancelled(supabase, user.id, input.id);

    if (!job) {
      return { job: null, error: "Job not found or cannot be cancelled" };
    }

    await logAuditEvent(supabase, {
      userId: user.id,
      businessProfileId: job.business_profile_id,
      action: AuditActions.BACKGROUND_JOB_CANCELLED,
      entityType: "background_job",
      entityId: job.id,
      status: "success",
      metadata: { jobType: job.job_type },
    });

    return { job };
  }

  const job = await resetBackgroundJobForRetry(supabase, user.id, input.id);

  if (!job) {
    return { job: null, error: "Job not found or cannot be retried" };
  }

  await logAuditEvent(supabase, {
    userId: user.id,
    businessProfileId: job.business_profile_id,
    action: AuditActions.BACKGROUND_JOB_QUEUED,
    entityType: "background_job",
    entityId: job.id,
    status: "started",
    metadata: { jobType: job.job_type, retry: true },
  });

  scheduleBackgroundJobProcessing(job.id);
  return { job };
}

export async function getBackgroundJobDashboardDataForCurrentUser(): Promise<BackgroundJobDashboardData> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      recent: [],
      counts: { queued: 0, running: 0, failed: 0, completed: 0 },
    };
  }

  const [jobs, counts] = await Promise.all([
    getBackgroundJobsForUser(supabase, user.id, { limit: 8 }),
    getBackgroundJobCountsForUser(supabase, user.id),
  ]);

  return {
    recent: jobs.map(toBackgroundJobSummary),
    counts,
  };
}

export async function queueBackgroundJobForProfile(
  userId: string,
  businessProfileId: string,
  input: Omit<BackgroundJobCreateInput, "userId" | "businessProfileId">
): Promise<BackgroundJobQueueResult> {
  const result = await enqueueBackgroundJob({
    ...input,
    userId,
    businessProfileId,
  });

  if (result.job && !result.duplicate) {
    scheduleBackgroundJobProcessing(result.job.id);
  }

  return result;
}

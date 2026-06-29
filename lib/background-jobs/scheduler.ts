import "server-only";

import { after } from "next/server";
import {
  getBackgroundJobById,
  getBackgroundJobsForUser,
  markBackgroundJobCompleted,
  markBackgroundJobFailed,
  markBackgroundJobRunning,
  sortJobsByPriority,
} from "@/lib/background-jobs/persistence";
import { executeBackgroundJob, normalizeBackgroundJobError } from "@/lib/background-jobs/worker";
import type { BackgroundJob } from "@/lib/background-jobs/types";
import { MAX_BACKGROUND_JOB_ATTEMPTS } from "@/lib/background-jobs/types";
import { AuditActions, auditErrorMetadata, logAuditEvent } from "@/lib/audit-log-server";
import { createClient } from "@/lib/supabase/server";

export function scheduleBackgroundJobProcessing(jobId: string): void {
  after(async () => {
    await processBackgroundJobById(jobId);
  });
}

export async function processBackgroundJobById(jobId: string): Promise<BackgroundJob | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const existing = await getBackgroundJobById(supabase, user.id, jobId);
  if (!existing || existing.status !== "queued") {
    return existing;
  }

  const nextAttempt = existing.attempts + 1;
  const running = await markBackgroundJobRunning(supabase, jobId, nextAttempt);

  if (!running) {
    return existing;
  }

  await logAuditEvent(supabase, {
    userId: running.user_id,
    businessProfileId: running.business_profile_id,
    action: AuditActions.BACKGROUND_JOB_STARTED,
    entityType: "background_job",
    entityId: running.id,
    status: "started",
    metadata: {
      jobType: running.job_type,
      attempt: nextAttempt,
    },
  });

  try {
    const result = await executeBackgroundJob(running);
    const completed = await markBackgroundJobCompleted(supabase, running.id, result);

    if (completed) {
      await logAuditEvent(supabase, {
        userId: completed.user_id,
        businessProfileId: completed.business_profile_id,
        action: AuditActions.BACKGROUND_JOB_COMPLETED,
        entityType: "background_job",
        entityId: completed.id,
        status: "success",
        metadata: {
          jobType: completed.job_type,
          attempt: nextAttempt,
        },
      });
    }

    return completed;
  } catch (error) {
    const message = normalizeBackgroundJobError(error, "Background job failed.");
    const shouldRequeue = nextAttempt < MAX_BACKGROUND_JOB_ATTEMPTS;
    const updated = await markBackgroundJobFailed(supabase, running.id, message, shouldRequeue);

    await logAuditEvent(supabase, {
      userId: running.user_id,
      businessProfileId: running.business_profile_id,
      action: AuditActions.BACKGROUND_JOB_FAILED,
      entityType: "background_job",
      entityId: running.id,
      status: "failure",
      metadata: {
        jobType: running.job_type,
        attempt: nextAttempt,
        willRetry: shouldRequeue,
        ...auditErrorMetadata(error, message),
      },
    });

    if (shouldRequeue && updated) {
      scheduleBackgroundJobProcessing(updated.id);
    }

    return updated;
  }
}

export async function processQueuedBackgroundJobsForUser(userId: string): Promise<void> {
  const supabase = await createClient();
  const queued = await getBackgroundJobsForUser(supabase, userId, {
    status: "queued",
    limit: 5,
  });

  const running = await getBackgroundJobsForUser(supabase, userId, {
    status: "running",
    limit: 1,
  });

  if (running.length > 0) return;

  const nextJob = sortJobsByPriority(queued)[0];
  if (!nextJob) return;

  await processBackgroundJobById(nextJob.id);
}

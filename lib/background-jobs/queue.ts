import "server-only";

import {
  findActiveBackgroundJob,
  insertBackgroundJob,
} from "@/lib/background-jobs/persistence";
import type { BackgroundJobCreateInput, BackgroundJobQueueResult } from "@/lib/background-jobs/types";
import { AuditActions, logAuditEvent } from "@/lib/audit-log-server";
import { createClient } from "@/lib/supabase/server";

export async function enqueueBackgroundJob(
  input: BackgroundJobCreateInput
): Promise<BackgroundJobQueueResult> {
  const supabase = await createClient();

  if (!input.force) {
    const existing = await findActiveBackgroundJob(supabase, {
      userId: input.userId,
      businessProfileId: input.businessProfileId ?? null,
      jobType: input.jobType,
    });

    if (existing) {
      return { job: existing, duplicate: true };
    }
  }

  const job = await insertBackgroundJob(supabase, input);

  if (!job) {
    return { job: null, error: "Unable to queue background job" };
  }

  await logAuditEvent(supabase, {
    userId: input.userId,
    businessProfileId: input.businessProfileId ?? null,
    action: AuditActions.BACKGROUND_JOB_QUEUED,
    entityType: "background_job",
    entityId: job.id,
    status: "started",
    metadata: {
      jobType: job.job_type,
      priority: job.priority,
    },
  });

  return { job };
}

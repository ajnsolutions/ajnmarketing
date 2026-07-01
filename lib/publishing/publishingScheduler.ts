import "server-only";

import { executePublishingJobById } from "@/lib/publishing/publishingEngine";
import { getDueScheduledPublishingJobs } from "@/lib/publishing/publishingHistory";
import { createClient } from "@/lib/supabase/server";

export async function processDueScheduledPublishingJobsForUser(
  userId: string
): Promise<number> {
  const supabase = await createClient();
  const dueJobs = await getDueScheduledPublishingJobs(supabase, userId);
  let processed = 0;

  for (const job of dueJobs) {
    const { error } = await executePublishingJobById(job.id, userId);
    if (!error) {
      processed += 1;
    }
  }

  return processed;
}

export async function processDueScheduledPublishingJobs(): Promise<number> {
  const supabase = await createClient();
  const dueJobs = await getDueScheduledPublishingJobs(supabase);
  let processed = 0;

  for (const job of dueJobs) {
    const { error } = await executePublishingJobById(job.id, job.user_id);
    if (!error) {
      processed += 1;
    }
  }

  return processed;
}

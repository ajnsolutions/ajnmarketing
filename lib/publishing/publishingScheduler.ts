import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { executePublishingJobById } from "@/lib/publishing/publishingEngine";
import { getDueScheduledPublishingJobs } from "@/lib/publishing/publishingHistory";
import { createClient } from "@/lib/supabase/server";

/**
 * Processes due scheduled/retrying jobs for one user via the shared
 * executePublishingJobById claim path.
 *
 * Must NOT be called from page loaders or GET handlers. Intended for explicit
 * worker / Trigger.dev / privileged sweeps only.
 */
export async function processDueScheduledPublishingJobsForUser(
  userId: string,
  supabaseClient?: SupabaseClient
): Promise<number> {
  const supabase = supabaseClient ?? (await createClient());
  const dueJobs = await getDueScheduledPublishingJobs(supabase, userId);
  let processed = 0;

  for (const job of dueJobs) {
    const { error } = await executePublishingJobById(job.id, userId, supabase);
    if (!error) {
      processed += 1;
    }
  }

  return processed;
}

/**
 * Cross-tenant due sweep. Prefer a privileged client when used outside a user request.
 * Not wired to any page load or GET route.
 */
export async function processDueScheduledPublishingJobs(
  supabaseClient?: SupabaseClient
): Promise<number> {
  const supabase = supabaseClient ?? (await createClient());
  const dueJobs = await getDueScheduledPublishingJobs(supabase);
  let processed = 0;

  for (const job of dueJobs) {
    const { error } = await executePublishingJobById(job.id, job.user_id, supabase);
    if (!error) {
      processed += 1;
    }
  }

  return processed;
}

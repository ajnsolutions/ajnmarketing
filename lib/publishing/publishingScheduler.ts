import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { executePublishingJobById } from "@/lib/publishing/publishingEngine";
import { getDueScheduledPublishingJobs } from "@/lib/publishing/publishingHistory";
import { createClient } from "@/lib/supabase/server";

/**
 * Processes due scheduled/retrying publishing jobs for one user.
 * Accepts an optional injected Supabase client (service-role for Trigger.dev);
 * defaults to the request-scoped cookie client for authorized Next.js callers.
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
 * Cross-tenant due-job sweep. Must be called with a privileged client when used from
 * Trigger.dev (cookie client would RLS-limit to zero/one tenant). Defaults to the
 * request-scoped client only for legacy/local callers that already expect that.
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

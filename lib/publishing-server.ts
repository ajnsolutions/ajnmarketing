import {
  getPublishingDashboardJobsForUser,
} from "@/lib/publishing/publishingEngine";
import {
  getPublishingQueueForCurrentUser,
  getPublishingQueueStatsForCurrentUser,
} from "@/lib/publishing-queue/service";
import { createClient } from "@/lib/supabase/server";

/**
 * Read-only dashboard data for Publishing / Content / Command Center pages.
 * Never executes due publishing jobs — execution is exclusive to explicit POST
 * actions and the background-job / Trigger.dev worker path via
 * executePublishingJobById (atomic claim).
 */
export async function getPublishingDashboardData() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { items: [], stats: { ready: 0, scheduled: 0, published: 0, failed: 0 }, jobs: [] };
  }

  const [items, stats, jobs] = await Promise.all([
    getPublishingQueueForCurrentUser(),
    getPublishingQueueStatsForCurrentUser(),
    getPublishingDashboardJobsForUser(user.id),
  ]);

  return { items, stats, jobs };
}

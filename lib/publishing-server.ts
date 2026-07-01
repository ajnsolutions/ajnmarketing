import {
  getPublishingDashboardJobsForUser,
} from "@/lib/publishing/publishingEngine";
import { processDueScheduledPublishingJobsForUser } from "@/lib/publishing/publishingScheduler";
import {
  getPublishingQueueForCurrentUser,
  getPublishingQueueStatsForCurrentUser,
} from "@/lib/publishing-queue/service";
import { createClient } from "@/lib/supabase/server";

export async function getPublishingDashboardData() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { items: [], stats: { ready: 0, scheduled: 0, published: 0, failed: 0 }, jobs: [] };
  }

  await processDueScheduledPublishingJobsForUser(user.id);

  const [items, stats, jobs] = await Promise.all([
    getPublishingQueueForCurrentUser(),
    getPublishingQueueStatsForCurrentUser(),
    getPublishingDashboardJobsForUser(user.id),
  ]);

  return { items, stats, jobs };
}

import {
  getPublishingQueueForCurrentUser,
  getPublishingQueueStatsForCurrentUser,
} from "@/lib/publishing-queue/service";

export async function getPublishingDashboardData() {
  const [items, stats] = await Promise.all([
    getPublishingQueueForCurrentUser(),
    getPublishingQueueStatsForCurrentUser(),
  ]);

  return { items, stats };
}

import { ContentPage } from "@/components/dashboard/content-page";
import { getApprovalDashboardData } from "@/lib/content-approval-server";
import { getPublishingDashboardData } from "@/lib/publishing-queue-server";

export const metadata = {
  title: "Library",
  description: "Everything we've created together — content, posts, and brand assets.",
};

/**
 * Library destination — presentation alias over the existing content hub.
 * No publishing or approval engine changes.
 */
export default async function LibraryRoute() {
  const [{ items, stats }, approvalData] = await Promise.all([
    getPublishingDashboardData(),
    getApprovalDashboardData(),
  ]);

  return (
    <ContentPage
      experience="library"
      publishingItems={items}
      publishingStats={stats}
      approvalStats={approvalData.stats}
      pendingApprovals={approvalData.approvals.filter((item) => item.status === "pending")}
    />
  );
}

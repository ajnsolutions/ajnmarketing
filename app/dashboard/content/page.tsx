import { ContentPage } from "@/components/dashboard/content-page";
import { getApprovalDashboardData } from "@/lib/content-approval-server";
import { getPublishingDashboardData } from "@/lib/publishing-queue-server";

export const metadata = {
  title: "Content",
  description:
    "Review, approve, and schedule AI-generated content for your Google Business Profile.",
};

export default async function ContentRoute() {
  const [{ items, stats }, approvalData] = await Promise.all([
    getPublishingDashboardData(),
    getApprovalDashboardData(),
  ]);

  return (
    <ContentPage
      publishingItems={items}
      publishingStats={stats}
      approvalStats={approvalData.stats}
      pendingApprovals={approvalData.approvals.filter((item) => item.status === "pending")}
    />
  );
}

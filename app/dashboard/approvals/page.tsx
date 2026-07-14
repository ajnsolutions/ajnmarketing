import { ApprovalsPage } from "@/components/dashboard/approvals-page";
import { getApprovalDashboardData } from "@/lib/content-approval-server";

export const metadata = {
  title: "Approval Center",
  description:
    "Review and approve everything AJN AI has prepared for your business.",
};

export default async function ApprovalsRoute() {
  const { approvals, stats, recommendationPackagesByApprovalId } = await getApprovalDashboardData();

  return (
    <ApprovalsPage
      approvals={approvals}
      stats={stats}
      recommendationPackagesByApprovalId={recommendationPackagesByApprovalId}
    />
  );
}

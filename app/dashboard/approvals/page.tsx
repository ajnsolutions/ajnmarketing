import { ApprovalsPage } from "@/components/dashboard/approvals-page";
import { getApprovalDashboardData } from "@/lib/content-approval-server";

export const metadata = {
  title: "This Week",
  description: "Review what your Head of Marketing prepared for your opinion this week.",
};

export default async function ApprovalsRoute({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; focus?: string }>;
}) {
  const [{ approvals, stats, recommendationPackagesByApprovalId }, params] = await Promise.all([
    getApprovalDashboardData(),
    searchParams,
  ]);

  const focus = params.focus?.trim() || null;
  const initialFilter = params.view === "pending" ? "pending" : "all";

  return (
    <ApprovalsPage
      approvals={approvals}
      stats={stats}
      recommendationPackagesByApprovalId={recommendationPackagesByApprovalId}
      initialFilter={initialFilter}
      focusApprovalId={focus}
    />
  );
}

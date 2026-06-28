import {
  getContentApprovalStatsForCurrentUser,
  getContentApprovalsForCurrentUser,
} from "@/lib/content-approval/service";

export async function getApprovalDashboardData() {
  const [approvals, stats] = await Promise.all([
    getContentApprovalsForCurrentUser(),
    getContentApprovalStatsForCurrentUser(),
  ]);

  return { approvals, stats };
}

import { DashboardHome } from "@/components/dashboard/dashboard-home";
import { getApprovalDashboardData } from "@/lib/content-approval-server";
import {
  getAnalysisDisplayMeta,
  getWebsiteAnalysisForCurrentUser,
} from "@/lib/website-analysis-server";

export default async function DashboardPage() {
  const [analysis, approvalData] = await Promise.all([
    getWebsiteAnalysisForCurrentUser(),
    getApprovalDashboardData(),
  ]);
  const analysisMeta = getAnalysisDisplayMeta(analysis);

  return <DashboardHome analysisMeta={analysisMeta} approvalStats={approvalData.stats} />;
}

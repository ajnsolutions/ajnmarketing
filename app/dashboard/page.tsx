import { DashboardHome } from "@/components/dashboard/dashboard-home";
import { getApprovalDashboardData } from "@/lib/content-approval-server";
import { getMarketingAgentDashboardData } from "@/lib/marketing-agent-server";
import {
  getAnalysisDisplayMeta,
  getWebsiteAnalysisForCurrentUser,
} from "@/lib/website-analysis-server";

export default async function DashboardPage() {
  const [analysis, approvalData, taskData] = await Promise.all([
    getWebsiteAnalysisForCurrentUser(),
    getApprovalDashboardData(),
    getMarketingAgentDashboardData(),
  ]);
  const analysisMeta = getAnalysisDisplayMeta(analysis);

  return (
    <DashboardHome
      analysisMeta={analysisMeta}
      approvalStats={approvalData.stats}
      taskStats={taskData.stats}
    />
  );
}

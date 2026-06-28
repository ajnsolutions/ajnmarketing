import { MarketingAgentTasksPage } from "@/components/dashboard/marketing-agent-tasks-page";
import { getMarketingAgentDashboardData } from "@/lib/marketing-agent-server";

export const metadata = {
  title: "Today's Marketing Tasks",
  description:
    "AI-recommended daily marketing tasks based on your marketing plan, approvals, and publishing queue.",
};

export default async function MarketingAgentTasksRoute() {
  const data = await getMarketingAgentDashboardData();

  return <MarketingAgentTasksPage data={data} />;
}

import {
  getMarketingAgentTasksForCurrentUser,
  regenerateMarketingAgentTasksForCurrentUser,
} from "@/lib/marketing-agent/service";

export async function getMarketingAgentDashboardData() {
  return getMarketingAgentTasksForCurrentUser();
}

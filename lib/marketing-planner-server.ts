import { getMarketingPlanPageDataForCurrentUser } from "@/lib/marketing-planner/service";

export async function getMarketingPlanPageData() {
  return getMarketingPlanPageDataForCurrentUser();
}

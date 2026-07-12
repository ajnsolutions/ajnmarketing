import { getMarketingRecommendationsPageDataForCurrentUser } from "@/lib/marketing-decisions/page-data";

export async function getMarketingRecommendationsPageData() {
  return getMarketingRecommendationsPageDataForCurrentUser();
}

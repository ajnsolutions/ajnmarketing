import { AnalyticsPage } from "@/components/dashboard/analytics-page";
import { getAnalyticsPageData } from "@/lib/analytics-server";

export const metadata = {
  title: "Results",
  description:
    "What's improving for your business — visibility, reviews, engagement, and Marketing Health.",
};

/**
 * Results destination — presentation alias over existing analytics data.
 * No analytics engine changes.
 */
export default async function ResultsRoute() {
  const pageData = await getAnalyticsPageData();

  return <AnalyticsPage pageData={pageData} experience="results" />;
}

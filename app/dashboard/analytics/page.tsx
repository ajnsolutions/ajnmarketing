import { AnalyticsPage } from "@/components/dashboard/analytics-page";
import { getAnalyticsPageData } from "@/lib/analytics-server";

export const metadata = {
  title: "Analytics",
  description:
    "Google Business Profile analytics intelligence that feeds your AI marketing planner and content generator.",
};

export default async function AnalyticsRoute() {
  const pageData = await getAnalyticsPageData();

  return <AnalyticsPage pageData={pageData} />;
}

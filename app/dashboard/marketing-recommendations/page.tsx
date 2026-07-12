import { MarketingRecommendationsPage } from "@/components/dashboard/marketing-recommendations-page";
import { DashboardEmptyState } from "@/components/dashboard/ui/dashboard-states";
import { getMarketingRecommendationsPageData } from "@/lib/marketing-decisions-server";

export const metadata = {
  title: "Marketing Recommendations",
  description:
    "Prioritized marketing recommendations with draft generation into Approval Center.",
};

export default async function MarketingRecommendationsRoute() {
  const data = await getMarketingRecommendationsPageData();

  if (!data) {
    return (
      <DashboardEmptyState
        title="Sign in required"
        description="Sign in to view your marketing recommendations."
        actionLabel="Go to login"
        actionHref="/login"
      />
    );
  }

  return <MarketingRecommendationsPage data={data} />;
}

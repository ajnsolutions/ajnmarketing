import { MarketingPlanPage } from "@/components/dashboard/marketing-plan-page";
import { getMarketingPlanPageData } from "@/lib/marketing-planner-server";

export const metadata = {
  title: "Marketing Plan",
  description:
    "AI-generated monthly marketing strategy built from your business intelligence and AI Marketing Profile.",
};

export default async function MarketingPlanRoute() {
  const pageData = await getMarketingPlanPageData();

  return <MarketingPlanPage {...pageData} />;
}

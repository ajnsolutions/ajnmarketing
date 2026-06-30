import { MarketContextPage } from "@/components/dashboard/market-context-page";
import { getMarketContextPageData } from "@/lib/market-context-server";

export const metadata = {
  title: "Market Context",
  description:
    "Local and industry market signals that inform your AI marketing plan and content.",
};

export default async function MarketContextRoute() {
  const pageData = await getMarketContextPageData();

  return <MarketContextPage {...pageData} />;
}

import { MarketContextPage } from "@/components/dashboard/market-context-page";

export const metadata = {
  title: "Market Context",
  description:
    "AI monitors your local market and competitors to uncover opportunities for growth.",
};

export default function MarketContextRoute() {
  return <MarketContextPage />;
}

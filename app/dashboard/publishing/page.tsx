import { PublishingPage } from "@/components/dashboard/publishing-page";
import { getPublishingDashboardData } from "@/lib/publishing-queue-server";

export const metadata = {
  title: "Publishing",
  description:
    "Organize approved content into a publishing queue for Google Business Profile and other channels.",
};

export default async function PublishingRoute() {
  const { items, stats } = await getPublishingDashboardData();

  return <PublishingPage items={items} stats={stats} />;
}

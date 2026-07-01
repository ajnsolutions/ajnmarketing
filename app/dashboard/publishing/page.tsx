import { PublishingPage } from "@/components/dashboard/publishing-page";
import { getPublishingDashboardData } from "@/lib/publishing-server";

export const metadata = {
  title: "Publishing",
  description:
    "Organize approved content into a publishing queue and publish autonomously to Google Business Profile.",
};

export default async function PublishingRoute() {
  const { items, stats, jobs } = await getPublishingDashboardData();

  return <PublishingPage items={items} stats={stats} jobs={jobs} />;
}

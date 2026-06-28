import { ContentPage } from "@/components/dashboard/content-page";
import { getPublishingDashboardData } from "@/lib/publishing-queue-server";

export const metadata = {
  title: "Content",
  description:
    "Review, approve, and schedule AI-generated content for your Google Business Profile.",
};

export default async function ContentRoute() {
  const { items, stats } = await getPublishingDashboardData();

  return <ContentPage publishingItems={items} publishingStats={stats} />;
}

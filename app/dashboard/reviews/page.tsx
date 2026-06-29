import { ReviewsHubPage } from "@/components/dashboard/reviews-hub-page";
import { getGoogleBusinessDashboardData } from "@/lib/google-business/server";

export const metadata = {
  title: "Reviews",
  description:
    "Monitor customer feedback, respond faster, and improve your online reputation.",
};

export default async function ReviewsRoute() {
  const data = await getGoogleBusinessDashboardData();
  return <ReviewsHubPage data={data} />;
}

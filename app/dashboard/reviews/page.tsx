import { ReviewsHubPage } from "@/components/dashboard/reviews-hub-page";
import { getGoogleBusinessDashboardData } from "@/lib/google-business/server";

export const metadata = {
  title: "Reviews",
  description:
    "Monitor customer feedback, respond faster, and improve your online reputation.",
};

export default async function ReviewsRoute({
  searchParams,
}: {
  searchParams: Promise<{ focus?: string }>;
}) {
  const [data, params] = await Promise.all([getGoogleBusinessDashboardData(), searchParams]);
  return <ReviewsHubPage data={data} focusReviewId={params.focus?.trim() || null} />;
}

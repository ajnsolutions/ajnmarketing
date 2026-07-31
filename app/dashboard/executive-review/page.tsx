import { redirect } from "next/navigation";
import { ExecutiveReviewPage } from "@/components/dashboard/executive-review-page";
import { getExecutiveReviewAllCadencesForCurrentUser } from "@/lib/head-of-marketing-orchestrator/service";
import { getBusinessProfileForUser } from "@/lib/business-profile-server";

export const metadata = {
  title: "Executive Review",
  description: "One coherent daily plan, composed from what AJN Marketing already knows about your business.",
};

export default async function ExecutiveReviewRoute() {
  const profile = await getBusinessProfileForUser();
  if (!profile) {
    redirect("/dashboard/setup");
  }

  const reviewsByCadence = await getExecutiveReviewAllCadencesForCurrentUser();
  if (!reviewsByCadence) {
    redirect("/dashboard/setup");
  }

  return <ExecutiveReviewPage reviewsByCadence={reviewsByCadence} />;
}

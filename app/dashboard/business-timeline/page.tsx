import { redirect } from "next/navigation";
import { BusinessTimelinePage } from "@/components/dashboard/business-timeline-page";
import { getBusinessTimelineForCurrentUser } from "@/lib/business-timeline/service";
import { getBusinessProfileForUser } from "@/lib/business-profile-server";

export const metadata = {
  title: "Business Timeline",
  description: "A chronological view of what's happened and what the Business Brain has learned.",
};

export default async function BusinessTimelineRoute() {
  const profile = await getBusinessProfileForUser();
  if (!profile) {
    redirect("/dashboard/setup");
  }

  const timeline = await getBusinessTimelineForCurrentUser();
  if (!timeline) {
    redirect("/dashboard/setup");
  }

  return <BusinessTimelinePage entries={timeline} />;
}

import { redirect } from "next/navigation";
import { BusinessBrainPage } from "@/components/dashboard/business-brain-page";
import { getBusinessBrainSnapshotForCurrentUser } from "@/lib/business-brain-inspector/service";
import { getBusinessProfileForUser } from "@/lib/business-profile-server";

export const metadata = {
  title: "Business Brain",
  description: "What AJN Marketing knows about your business, how confident it is, and where that knowledge came from.",
};

export default async function BusinessBrainRoute() {
  const profile = await getBusinessProfileForUser();
  if (!profile) {
    redirect("/dashboard/setup");
  }

  const snapshot = await getBusinessBrainSnapshotForCurrentUser();
  if (!snapshot) {
    redirect("/dashboard/setup");
  }

  return <BusinessBrainPage snapshot={snapshot} />;
}

import { redirect } from "next/navigation";
import { BusinessConnectionsPage } from "@/components/dashboard/business-connections-page";
import { getBusinessConnectionsSnapshotForCurrentUser } from "@/lib/business-connections/service";
import { getBusinessProfileForUser } from "@/lib/business-profile-server";

export const metadata = {
  title: "Business Connections",
  description: "Connect the sources that teach the Business Brain about your business.",
};

export default async function BusinessConnectionsRoute() {
  const profile = await getBusinessProfileForUser();
  if (!profile) {
    redirect("/dashboard/setup");
  }

  const snapshot = await getBusinessConnectionsSnapshotForCurrentUser();
  if (!snapshot) {
    redirect("/dashboard/setup");
  }

  return <BusinessConnectionsPage snapshot={snapshot} />;
}

import { Suspense } from "react";
import { GbpConnectPage } from "@/components/dashboard/gbp-connect-page";
import { getGoogleBusinessProfileConnectPageData } from "@/lib/google-business-profile-server";

export const metadata = {
  title: "Connect Google Business Profile",
  description:
    "Connect your Google Business Profile so AJN can monitor visibility, reviews, and optimization opportunities.",
};

export default async function GbpConnectRoute() {
  const initialStatus = await getGoogleBusinessProfileConnectPageData();

  return (
    <Suspense fallback={null}>
      <GbpConnectPage initialStatus={initialStatus} />
    </Suspense>
  );
}

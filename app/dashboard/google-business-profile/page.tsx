import { GoogleBusinessProfilePage } from "@/components/dashboard/google-business-profile-page";
import { getGoogleBusinessDashboardData } from "@/lib/google-business-server";

export const metadata = {
  title: "Google Business Profile",
  description:
    "Track your Google Business Profile visibility, reviews, calls, and optimization progress.",
};

export default async function GoogleBusinessProfileRoute() {
  const data = await getGoogleBusinessDashboardData();
  return <GoogleBusinessProfilePage data={data} />;
}

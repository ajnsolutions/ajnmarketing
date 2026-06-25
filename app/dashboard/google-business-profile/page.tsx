import { GoogleBusinessProfilePage } from "@/components/dashboard/google-business-profile-page";

export const metadata = {
  title: "Google Business Profile",
  description:
    "Track your Google Business Profile visibility, reviews, calls, and optimization progress.",
};

export default function GoogleBusinessProfileRoute() {
  return <GoogleBusinessProfilePage />;
}

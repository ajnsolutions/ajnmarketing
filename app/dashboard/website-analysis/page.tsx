import { WebsiteAnalysisPage } from "@/components/dashboard/website-analysis-page";
import { getBusinessProfileForUser } from "@/lib/business-profile-server";
import { getWebsiteAnalysisForCurrentUser } from "@/lib/website-analysis-server";

export const metadata = {
  title: "Website Analysis",
  description: "AI-powered website audit and marketing profile for your business.",
};

export default async function WebsiteAnalysisRoute() {
  const [profile, analysis] = await Promise.all([
    getBusinessProfileForUser(),
    getWebsiteAnalysisForCurrentUser(),
  ]);

  return <WebsiteAnalysisPage profile={profile} analysis={analysis} />;
}

import { AiMarketingProfilePage } from "@/components/dashboard/ai-marketing-profile-page";
import { getAiMarketingProfileForUserPage } from "@/lib/ai-marketing-profile-server";

export const metadata = {
  title: "AI Profile",
  description: "Centralized AI marketing brain and strategy profile for your business.",
};

export default async function AiMarketingProfileRoute() {
  const profile = await getAiMarketingProfileForUserPage();

  return <AiMarketingProfilePage profile={profile} />;
}

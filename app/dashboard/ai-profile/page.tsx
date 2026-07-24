import { AiMarketingProfilePage } from "@/components/dashboard/ai-marketing-profile-page";
import { getAiMarketingProfileForUserPage } from "@/lib/ai-marketing-profile-server";

export const metadata = {
  title: "Marketing profile",
  description: "Reusable business summary that feeds plans and drafts.",
};

export default async function AiMarketingProfileRoute() {
  const profile = await getAiMarketingProfileForUserPage();

  return <AiMarketingProfilePage profile={profile} />;
}

import { getAiMarketingProfileForCurrentUser } from "@/lib/ai-marketing-profile/service";

export async function getAiMarketingProfileForUserPage() {
  return getAiMarketingProfileForCurrentUser();
}

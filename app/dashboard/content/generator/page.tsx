import { ContentGeneratorPage } from "@/components/dashboard/content-generator-page";
import { getBusinessProfileForUser } from "@/lib/business-profile-server";
import { getCustomerVoiceIntelligenceForCurrentUser } from "@/lib/customer-voice/service";
import { buildContentGeneratorSuggestion } from "@/lib/content-generator/suggestions";

export const metadata = {
  title: "AI Content Generator",
  description:
    "Generate ready-to-review marketing content using your business profile, brand voice, and local market context.",
};

export default async function ContentGeneratorRoute() {
  const profile = await getBusinessProfileForUser().catch(() => null);
  const customerVoice = profile
    ? await getCustomerVoiceIntelligenceForCurrentUser(profile.id).catch(() => null)
    : null;

  const suggestion = buildContentGeneratorSuggestion({ customerVoice });

  return <ContentGeneratorPage suggestion={suggestion} />;
}

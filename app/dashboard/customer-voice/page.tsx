import { redirect } from "next/navigation";
import { CustomerVoiceExperiencePage } from "@/components/dashboard/customer-voice-page";
import { getBusinessProfileForUser } from "@/lib/business-profile-server";
import { buildCustomerVoicePageModel } from "@/lib/customer-voice/presentation";
import { getCustomerVoiceIntelligence } from "@/lib/customer-voice/service";

export const metadata = {
  title: "Customer Voice",
  description: "How customers talk about your business — insights for authentic marketing.",
};

export default async function CustomerVoiceRoute() {
  const profile = await getBusinessProfileForUser();
  if (!profile) {
    redirect("/dashboard/setup");
  }

  const intelligence = await getCustomerVoiceIntelligence({
    userId: profile.user_id,
    businessProfileId: profile.id,
    knownServices: [
      profile.primary_services,
      profile.emergency_services,
      profile.specialty_services,
    ]
      .filter(Boolean)
      .flatMap((value) => String(value).split(/[\n,;|]/))
      .map((s) => s.trim())
      .filter(Boolean),
  });

  const model = buildCustomerVoicePageModel({
    intelligence,
    businessName: profile.business_name?.trim() || "your business",
  });

  return <CustomerVoiceExperiencePage model={model} />;
}

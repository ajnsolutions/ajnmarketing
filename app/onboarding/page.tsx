import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { isOnboardingCompleteForUser } from "@/lib/business-profile-server";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Meet Your Head of Marketing",
  description: "Introduce your business to your AJN Marketing Head of Marketing.",
};

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const onboardingComplete = await isOnboardingCompleteForUser();

  if (onboardingComplete) {
    redirect("/dashboard");
  }

  return <OnboardingWizard />;
}

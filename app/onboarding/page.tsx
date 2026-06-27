import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Onboarding",
  description: "Set up your AJN Marketing workspace.",
};

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <OnboardingWizard />;
}

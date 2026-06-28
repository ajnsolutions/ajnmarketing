import type { BusinessProfile } from "@/lib/business-profile";
import { createClient } from "@/lib/supabase/server";

export async function getBusinessProfileForUser(): Promise<BusinessProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("business_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) return null;

  return data as BusinessProfile;
}

export async function isOnboardingCompleteForUser(): Promise<boolean> {
  const profile = await getBusinessProfileForUser();
  return profile?.onboarding_completed === true;
}

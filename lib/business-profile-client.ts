import type { BusinessProfile, BusinessProfileUpsert } from "@/lib/business-profile";
import type { OnboardingData } from "@/lib/onboarding-storage";
import { onboardingDataToProfileRow } from "@/lib/business-profile";
import { createClient } from "@/lib/supabase/client";

export async function fetchBusinessProfile(): Promise<{
  profile: BusinessProfile | null;
  error: string | null;
}> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { profile: null, error: authError?.message ?? "Not authenticated" };
  }

  const { data, error } = await supabase
    .from("business_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return { profile: null, error: error.message };
  }

  return { profile: (data as BusinessProfile | null) ?? null, error: null };
}

export async function upsertBusinessProfile(
  row: BusinessProfileUpsert
): Promise<{ error: string | null }> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: authError?.message ?? "Not authenticated" };
  }

  const { error } = await supabase.from("business_profiles").upsert(
    {
      ...row,
      user_id: user.id,
    },
    { onConflict: "user_id" }
  );

  return { error: error?.message ?? null };
}

export async function saveOnboardingProgress(
  data: OnboardingData,
  onboardingCompleted = false
): Promise<{ error: string | null }> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: authError?.message ?? "Not authenticated" };
  }

  return upsertBusinessProfile(onboardingDataToProfileRow(user.id, data, onboardingCompleted));
}

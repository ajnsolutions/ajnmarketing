import { getBusinessProfileForUser } from "@/lib/business-profile-server";
import {
  buildFirstDaysHomeModel,
  type FirstDaysHomeModel,
} from "@/lib/dashboard/first-days-home";
import { getDashboardSessionContext } from "@/lib/dashboard/session-context";
import { getGoogleBusinessProfileConnectionStatusForCurrentUser } from "@/lib/google-business-profile/service";
import { createClient } from "@/lib/supabase/server";

async function countOpenRecommendationsForCurrentUser(): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const profile = await getBusinessProfileForUser();
  if (!profile) return 0;

  const { count, error } = await supabase
    .from("marketing_recommendations")
    .select("id", { count: "exact", head: true })
    .eq("business_profile_id", profile.id)
    .in("status", ["open", "in_progress"]);

  if (error) {
    // Read-only probe — treat missing table/status as zero without changing engines.
    return 0;
  }

  return count ?? 0;
}

export async function getFirstDaysHomeForCurrentUser(): Promise<FirstDaysHomeModel | null> {
  const [session, profile, gbp] = await Promise.all([
    getDashboardSessionContext(),
    getBusinessProfileForUser(),
    getGoogleBusinessProfileConnectionStatusForCurrentUser(),
  ]);

  if (!profile?.onboarding_completed) return null;

  const recommendationCount = await countOpenRecommendationsForCurrentUser();

  return buildFirstDaysHomeModel({
    userName: session.userName,
    businessName: session.businessName,
    websiteUrl: profile.website,
    voiceNotes: profile.voice_notes,
    gbpConnected: gbp.connected,
    recommendationCount,
  });
}

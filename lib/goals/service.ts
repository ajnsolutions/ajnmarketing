import "server-only";

import { createClient } from "@/lib/supabase/server";
import { decodeBusinessGoalsFromMarketingGoals } from "@/lib/goals/persistence";
import type { BusinessGoal } from "@/lib/goals/types";

/** Load structured business goals for the signed-in user (empty when none). */
export async function getBusinessGoalsForCurrentUser(): Promise<BusinessGoal[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("business_profiles")
    .select("marketing_goals")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) return [];
  return decodeBusinessGoalsFromMarketingGoals(
    (data as { marketing_goals: string[] | null }).marketing_goals,
  );
}

import { redirect } from "next/navigation";
import { BusinessPulsePage } from "@/components/dashboard/business-pulse-page";
import { getBusinessProfileForUser } from "@/lib/business-profile-server";
import { listCompetitorObservationsForUser } from "@/lib/competitor-observations/persistence";
import { listMarketRadarEntriesForUser } from "@/lib/market-radar/persistence";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Business Pulse",
  description: "Verified, source-backed changes among the competitors and benchmarks you're tracking.",
};

export default async function BusinessPulseRoute() {
  const profile = await getBusinessProfileForUser();
  if (!profile) {
    redirect("/dashboard/setup");
  }

  const supabase = await createClient();
  const [observations, entries] = await Promise.all([
    listCompetitorObservationsForUser(supabase, profile.user_id, profile.id),
    listMarketRadarEntriesForUser(supabase, profile.user_id, profile.id),
  ]);

  return <BusinessPulsePage observations={observations} entries={entries} />;
}

import { redirect } from "next/navigation";
import { MarketRadarPage } from "@/components/dashboard/market-radar-page";
import { getBusinessProfileForUser } from "@/lib/business-profile-server";
import { listMarketRadarEntriesForUser } from "@/lib/market-radar/persistence";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Market Radar",
  description: "The competitors and benchmark businesses you're tracking, in your own words.",
};

export default async function MarketRadarRoute() {
  const profile = await getBusinessProfileForUser();
  if (!profile) {
    redirect("/dashboard/setup");
  }

  const supabase = await createClient();
  const entries = await listMarketRadarEntriesForUser(supabase, profile.user_id, profile.id);

  return <MarketRadarPage initialEntries={entries} />;
}

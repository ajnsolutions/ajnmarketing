import { NextResponse } from "next/server";
import { getDecisionIntelligenceSummaryForBusiness } from "@/lib/decision-intelligence/service";
import { getBusinessProfileForUser } from "@/lib/business-profile-server";
import { createClient } from "@/lib/supabase/server";

/**
 * Decision Intelligence — read-only summary: current decision, evidence trace, current
 * vs. previous comparison, learning impact, and a bounded timeline. GET only.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await getBusinessProfileForUser();
  if (!profile) {
    return NextResponse.json({ error: "Business profile not found" }, { status: 404 });
  }

  const summary = await getDecisionIntelligenceSummaryForBusiness(supabase, user.id, profile.id);

  return NextResponse.json({ summary });
}

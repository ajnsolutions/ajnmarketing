import { NextResponse } from "next/server";
import { getDecisionHistoryForBusiness } from "@/lib/decision-intelligence/service";
import { parseHistoryQuery } from "@/lib/decision-intelligence/request";
import { getBusinessProfileForUser } from "@/lib/business-profile-server";
import { createClient } from "@/lib/supabase/server";

/** Bounded decision-snapshot history for the Decision Intelligence timeline. GET only. */
export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url);
  const parsed = parseHistoryQuery(searchParams);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const history = await getDecisionHistoryForBusiness(supabase, user.id, profile.id, {
    start: parsed.start,
    end: parsed.end,
    limit: parsed.limit,
  });

  return NextResponse.json({ history });
}

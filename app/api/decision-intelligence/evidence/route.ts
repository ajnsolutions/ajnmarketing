import { NextResponse } from "next/server";
import { getEvidenceForDecision } from "@/lib/decision-intelligence/service";
import { parseEvidenceQuery } from "@/lib/decision-intelligence/request";
import { getBusinessProfileForUser } from "@/lib/business-profile-server";
import { createClient } from "@/lib/supabase/server";

/** Evidence trace for one specific historical decision. GET only. */
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
  const parsed = parseEvidenceQuery(searchParams);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const evidence = await getEvidenceForDecision(supabase, user.id, profile.id, parsed.decisionId);
  if (evidence === null) {
    return NextResponse.json({ error: "Decision not found for this business" }, { status: 404 });
  }

  return NextResponse.json({ evidence });
}

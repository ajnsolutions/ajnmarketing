import { NextResponse } from "next/server";
import { getBusinessProfileForUser } from "@/lib/business-profile-server";
import { addMarketRadarEntryForUser } from "@/lib/market-radar/persistence";
import { MarketRadarEntryKinds, type MarketRadarEntryKind } from "@/lib/market-radar/types";
import { createClient } from "@/lib/supabase/server";

const VALID_KINDS = new Set<string>(Object.values(MarketRadarEntryKinds));

export async function POST(request: Request) {
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

  const body = (await request.json().catch(() => null)) as {
    kind?: string;
    name?: string;
    notes?: string;
  } | null;

  if (!body?.kind || !VALID_KINDS.has(body.kind)) {
    return NextResponse.json({ error: "kind must be one of competitor, benchmark" }, { status: 400 });
  }
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const entry = await addMarketRadarEntryForUser(supabase, user.id, profile.id, {
    kind: body.kind as MarketRadarEntryKind,
    name: body.name.trim(),
    notes: body.notes?.trim() || null,
  });

  if (!entry) {
    return NextResponse.json({ error: "Failed to save entry" }, { status: 500 });
  }

  return NextResponse.json({ entry });
}

import { NextResponse } from "next/server";
import {
  getLatestMarketContextBriefForCurrentUser,
  refreshMarketContextBriefForCurrentUser,
} from "@/lib/market-context/marketContextService";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const briefWithItems = await getLatestMarketContextBriefForCurrentUser();
  return NextResponse.json({ briefWithItems });
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { briefWithItems, error } = await refreshMarketContextBriefForCurrentUser();

  if (error || !briefWithItems) {
    return NextResponse.json(
      { error: error ?? "Unable to generate market context brief" },
      { status: error === "Unauthorized" ? 401 : 502 }
    );
  }

  return NextResponse.json({ briefWithItems });
}

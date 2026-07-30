import { NextResponse } from "next/server";
import {
  listSearchConsolePropertiesForCurrentUser,
  refreshSearchConsolePropertiesForCurrentUser,
} from "@/lib/google-search-console/service";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const properties = await listSearchConsolePropertiesForCurrentUser();
  return NextResponse.json({ properties });
}

/** Re-fetches the connected account's sites from Google (property discovery refresh). */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await refreshSearchConsolePropertiesForCurrentUser();
  if (!result.success) {
    return NextResponse.json({ error: result.error ?? "Unable to refresh properties" }, { status: 502 });
  }

  return NextResponse.json({ properties: result.properties });
}

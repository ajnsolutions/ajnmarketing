import { NextResponse } from "next/server";
import { disconnectSearchConsoleForCurrentUser } from "@/lib/google-search-console/service";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await disconnectSearchConsoleForCurrentUser();
  if (!result.success) {
    return NextResponse.json({ error: result.error ?? "Unable to disconnect" }, { status: 502 });
  }

  return NextResponse.json({ success: true });
}

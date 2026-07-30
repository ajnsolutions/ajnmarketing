import { NextResponse } from "next/server";
import { selectSearchConsolePropertyForCurrentUser } from "@/lib/google-search-console/service";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let siteUrl: unknown;
  try {
    const body = (await request.json()) as { siteUrl?: unknown };
    siteUrl = body.siteUrl;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (typeof siteUrl !== "string" || !siteUrl.trim()) {
    return NextResponse.json({ error: "siteUrl is required" }, { status: 400 });
  }

  const result = await selectSearchConsolePropertyForCurrentUser(siteUrl);
  if (!result.success) {
    return NextResponse.json({ error: result.error ?? "Unable to select property" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}

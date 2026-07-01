import { NextResponse } from "next/server";
import { getAnalyticsPageData, refreshAnalyticsForCurrentUser } from "@/lib/analytics-server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pageData = await getAnalyticsPageData();
  return NextResponse.json({ pageData });
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { pageData, error } = await refreshAnalyticsForCurrentUser();

  if (error || !pageData) {
    return NextResponse.json(
      { error: error ?? "Unable to refresh analytics intelligence" },
      { status: error === "Unauthorized" ? 401 : 502 }
    );
  }

  return NextResponse.json({ pageData });
}

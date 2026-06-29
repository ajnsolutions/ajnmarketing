import { NextResponse } from "next/server";
import type { BusinessProfile } from "@/lib/business-profile";
import { getWebsiteAnalysisForUser } from "@/lib/website-analysis/persistence";
import { runWebsiteAnalysisForUser } from "@/lib/website-analysis/service";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const analysis = await getWebsiteAnalysisForUser(supabase, user.id);
  return NextResponse.json({ analysis });
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("business_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return NextResponse.json({ error: "Business profile not found" }, { status: 404 });
  }

  if (!(profile as BusinessProfile).website?.trim()) {
    return NextResponse.json({ error: "No website configured" }, { status: 400 });
  }

  const analysis = await runWebsiteAnalysisForUser(user.id);
  return NextResponse.json({ analysis });
}

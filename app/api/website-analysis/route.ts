import { NextResponse } from "next/server";
import type { BusinessProfile } from "@/lib/business-profile";
import { queueBackgroundJobForCurrentUser } from "@/lib/background-jobs/service";
import { BackgroundJobTypes } from "@/lib/background-jobs/types";
import { getWebsiteAnalysisForUser } from "@/lib/website-analysis/persistence";
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

  const { job, duplicate, error } = await queueBackgroundJobForCurrentUser({
    jobType: BackgroundJobTypes.WEBSITE_ANALYSIS,
    priority: "high",
  });

  if (error || !job) {
    return NextResponse.json(
      { error: error ?? "Unable to queue website analysis" },
      { status: error === "Unauthorized" ? 401 : 502 }
    );
  }

  return NextResponse.json({ job, duplicate: Boolean(duplicate) });
}

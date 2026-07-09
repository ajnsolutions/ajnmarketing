import { NextResponse } from "next/server";
import { getBusinessProfileForUser } from "@/lib/business-profile-server";
import { generateAiMarketingProfileForUser, getAiMarketingProfileForCurrentUser } from "@/lib/ai-marketing-profile/service";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await getAiMarketingProfileForCurrentUser();
  return NextResponse.json({ profile });
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const businessProfile = await getBusinessProfileForUser();
  if (!businessProfile) {
    return NextResponse.json({ error: "Business profile not found" }, { status: 404 });
  }

  const { profile, error } = await generateAiMarketingProfileForUser(user.id);

  if (error) {
    return NextResponse.json({ profile, error }, { status: 502 });
  }

  return NextResponse.json({ profile });
}

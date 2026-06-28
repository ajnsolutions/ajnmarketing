import { NextResponse } from "next/server";
import { getGoogleBusinessProfileConnectionStatusForCurrentUser } from "@/lib/google-business-profile/service";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = await getGoogleBusinessProfileConnectionStatusForCurrentUser();
  return NextResponse.json({ status });
}

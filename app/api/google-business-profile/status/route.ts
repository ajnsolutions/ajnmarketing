import { NextResponse } from "next/server";
import { inspectGoogleBusinessServerConfig } from "@/lib/google-business-profile/config";
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
  const serverConfig = inspectGoogleBusinessServerConfig();

  return NextResponse.json({
    status,
    serverConfig: {
      oauthConfigured: serverConfig.oauthConfigured,
      connectionStorageConfigured: serverConfig.connectionStorageConfigured,
      present: serverConfig.present,
      missing: serverConfig.missing,
      invalid: serverConfig.invalid,
    },
  });
}

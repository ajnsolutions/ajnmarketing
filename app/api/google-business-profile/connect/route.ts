import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  buildGoogleBusinessOAuthUrl,
  getGoogleBusinessOAuthSetupMessage,
  isGoogleBusinessOAuthConfigured,
} from "@/lib/google-business-profile/oauth";
import {
  createGoogleBusinessOAuthState,
  getGoogleConnectionStorageSetupMessage,
  GBP_OAUTH_STATE_COOKIE,
  isGoogleConnectionStorageConfigured,
} from "@/lib/google-business-profile/service";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isGoogleBusinessOAuthConfigured()) {
    return NextResponse.json(
      { error: getGoogleBusinessOAuthSetupMessage() },
      { status: 503 }
    );
  }

  if (!isGoogleConnectionStorageConfigured()) {
    return NextResponse.json(
      { error: getGoogleConnectionStorageSetupMessage() },
      { status: 503 }
    );
  }

  const state = createGoogleBusinessOAuthState(user.id);
  const cookieStore = await cookies();

  cookieStore.set(GBP_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });

  const authorizationUrl = buildGoogleBusinessOAuthUrl(state);
  return NextResponse.redirect(authorizationUrl);
}

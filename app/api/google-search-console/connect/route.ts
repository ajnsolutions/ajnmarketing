import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  buildGoogleSearchConsoleOAuthUrl,
  getGoogleSearchConsoleOAuthSetupMessage,
  isGoogleSearchConsoleOAuthConfigured,
} from "@/lib/google-search-console/oauth";
import {
  createSearchConsoleOAuthState,
  getSearchConsoleConnectionStorageSetupMessage,
  isSearchConsoleConnectionStorageConfigured,
  SEARCH_CONSOLE_OAUTH_STATE_COOKIE,
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

  if (!isGoogleSearchConsoleOAuthConfigured()) {
    return NextResponse.json({ error: getGoogleSearchConsoleOAuthSetupMessage() }, { status: 503 });
  }

  if (!isSearchConsoleConnectionStorageConfigured()) {
    return NextResponse.json({ error: getSearchConsoleConnectionStorageSetupMessage() }, { status: 503 });
  }

  const state = createSearchConsoleOAuthState(user.id);
  const cookieStore = await cookies();

  cookieStore.set(SEARCH_CONSOLE_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });

  const authorizationUrl = buildGoogleSearchConsoleOAuthUrl(state);
  return NextResponse.redirect(authorizationUrl);
}

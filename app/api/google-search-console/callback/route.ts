import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  completeSearchConsoleOAuthCallback,
  parseSearchConsoleOAuthState,
  SEARCH_CONSOLE_OAUTH_STATE_COOKIE,
} from "@/lib/google-search-console/service";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  const redirectBase = `${origin}/dashboard/search-console/connect`;

  if (oauthError) {
    return NextResponse.redirect(`${redirectBase}?error=${encodeURIComponent(oauthError)}`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=auth_required`);
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get(SEARCH_CONSOLE_OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(SEARCH_CONSOLE_OAUTH_STATE_COOKIE);

  if (!code || !state || !savedState || state !== savedState) {
    return NextResponse.redirect(`${redirectBase}?error=invalid_oauth_state`);
  }

  const stateUserId = parseSearchConsoleOAuthState(state);
  if (stateUserId !== user.id) {
    return NextResponse.redirect(`${redirectBase}?error=invalid_oauth_user`);
  }

  const { success, error } = await completeSearchConsoleOAuthCallback(user.id, code);

  if (!success) {
    return NextResponse.redirect(`${redirectBase}?error=${encodeURIComponent(error ?? "google_oauth_failed")}`);
  }

  return NextResponse.redirect(`${redirectBase}?connected=1`);
}

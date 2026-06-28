import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  completeGoogleBusinessOAuthCallback,
  GBP_OAUTH_STATE_COOKIE,
  parseGoogleBusinessOAuthState,
} from "@/lib/google-business-profile/service";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  const redirectBase = `${origin}/dashboard/google-business-profile/connect`;

  if (oauthError) {
    return NextResponse.redirect(
      `${redirectBase}?error=${encodeURIComponent(oauthError)}`
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=auth_required`);
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get(GBP_OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(GBP_OAUTH_STATE_COOKIE);

  if (!code || !state || !savedState || state !== savedState) {
    return NextResponse.redirect(`${redirectBase}?error=invalid_oauth_state`);
  }

  const stateUserId = parseGoogleBusinessOAuthState(state);
  if (stateUserId !== user.id) {
    return NextResponse.redirect(`${redirectBase}?error=invalid_oauth_user`);
  }

  const { success, error } = await completeGoogleBusinessOAuthCallback(user.id, code);

  if (!success) {
    return NextResponse.redirect(
      `${redirectBase}?error=${encodeURIComponent(error ?? "google_oauth_failed")}`
    );
  }

  return NextResponse.redirect(`${redirectBase}?connected=1`);
}

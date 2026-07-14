import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBusinessProfileForUserId } from "@/lib/business-profile-server";
import {
  WeeklyPackageLinkError,
  resolveApprovalCenterRedirect,
  verifyWeeklyPackageSignedToken,
} from "@/lib/weekly-approval-package/signedLinks";

/**
 * Verifies a signed weekly-package link, then routes the signed-in tenant into
 * the existing Approval Center. Never approves or publishes.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Missing approval link token." }, { status: 400 });
  }

  let payload;
  try {
    payload = verifyWeeklyPackageSignedToken(token);
  } catch (error) {
    const message =
      error instanceof WeeklyPackageLinkError ? error.message : "Invalid approval link.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Return to this verified open URL after login so tenant checks still run.
    const login = new URL("/login", url.origin);
    login.searchParams.set("next", `${url.pathname}${url.search}`);
    return NextResponse.redirect(login);
  }

  if (user.id !== payload.userId) {
    return NextResponse.json(
      { error: "This approval link belongs to a different account." },
      { status: 403 }
    );
  }

  const profile = await getBusinessProfileForUserId(supabase, user.id);
  if (!profile || profile.id !== payload.businessProfileId) {
    return NextResponse.json(
      { error: "This approval link does not match your business profile." },
      { status: 403 }
    );
  }

  const destination = new URL(resolveApprovalCenterRedirect(payload), url.origin);
  return NextResponse.redirect(destination);
}

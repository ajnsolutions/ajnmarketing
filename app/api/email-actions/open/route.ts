import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBusinessProfileForUserId } from "@/lib/business-profile-server";
import { EmailActionTokenError, verifyEmailActionToken } from "@/lib/email-actions/tokens";
import { EmailActionTypes } from "@/lib/email-actions/types";
import {
  renderConfirmApprovePage,
  renderRejectReasonPage,
  renderResultPage,
} from "@/lib/email-actions/renderPages";

const APPROVAL_CENTER_URL = "/dashboard/approvals?view=pending";
const EXECUTE_URL = "/api/email-actions/execute";

function htmlResponse(html: string, status = 200): NextResponse {
  return new NextResponse(html, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

/**
 * GET only ever verifies the token and renders a confirmation page -- it NEVER mutates
 * state. This is deliberate: email security scanners (Microsoft Defender Safe Links,
 * Proofpoint, Mimecast, etc.) pre-fetch links in emails via automated GET requests, so a
 * bare click/prefetch must be safe to repeat. The actual approve/reject mutation only
 * happens via the POST to /api/email-actions/execute, triggered by a real button
 * click/form submit on the page this route renders.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Missing approval action token." }, { status: 400 });
  }

  let payload;
  try {
    payload = verifyEmailActionToken(token);
  } catch (error) {
    if (error instanceof EmailActionTokenError && error.reason === "expired") {
      return htmlResponse(
        renderResultPage({
          title: "Link expired",
          message: "This approval link has expired. Generate a new Weekly Approval Package to continue.",
          tone: "error",
          approvalCenterUrl: APPROVAL_CENTER_URL,
        }),
        410
      );
    }

    return htmlResponse(
      renderResultPage({
        title: "Link not valid",
        message: "This approval link is invalid or could not be verified. Generate a new Weekly Approval Package to continue.",
        tone: "error",
        approvalCenterUrl: APPROVAL_CENTER_URL,
      }),
      400
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Preserve this exact verified URL (token included) as the post-login destination,
    // reusing the same pattern already established by the weekly-package "open" route --
    // tenant/expiry checks below still run again after login, nothing executes here.
    const login = new URL("/login", url.origin);
    login.searchParams.set("next", `${url.pathname}${url.search}`);
    return NextResponse.redirect(login);
  }

  if (user.id !== payload.userId) {
    return htmlResponse(
      renderResultPage({
        title: "Not your link",
        message: "This approval link belongs to a different account.",
        tone: "error",
      }),
      403
    );
  }

  const profile = await getBusinessProfileForUserId(supabase, user.id);
  if (!profile || profile.id !== payload.businessProfileId) {
    return htmlResponse(
      renderResultPage({
        title: "Business mismatch",
        message: "This approval link does not match your business profile.",
        tone: "error",
      }),
      403
    );
  }

  if (user.email && payload.emailRecipient && user.email.toLowerCase() !== payload.emailRecipient.toLowerCase()) {
    return htmlResponse(
      renderResultPage({
        title: "Recipient mismatch",
        message: "This approval link was issued for a different recipient.",
        tone: "error",
      }),
      403
    );
  }

  const businessName = profile.business_name?.trim() || "your business";

  if (payload.action === EmailActionTypes.REJECT) {
    return htmlResponse(
      renderRejectReasonPage({
        businessName,
        token,
        executeUrl: EXECUTE_URL,
        approvalCenterUrl: APPROVAL_CENTER_URL,
      })
    );
  }

  return htmlResponse(
    renderConfirmApprovePage({
      action: payload.action === EmailActionTypes.APPROVE_ALL ? "approve_all" : "approve",
      itemCount: payload.contentApprovalIds?.length,
      businessName,
      token,
      executeUrl: EXECUTE_URL,
      approvalCenterUrl: APPROVAL_CENTER_URL,
    })
  );
}

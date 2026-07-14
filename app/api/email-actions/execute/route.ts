import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBusinessProfileForUserId } from "@/lib/business-profile-server";
import { AuditActions, getAuditRequestContext, logAuditEvent } from "@/lib/audit-log-server";
import { EmailActionTokenError, verifyEmailActionToken } from "@/lib/email-actions/tokens";
import { EmailActionTypes } from "@/lib/email-actions/types";
import type { EmailActionItemOutcome } from "@/lib/email-actions/types";
import {
  executeApproveAllForUser,
  executeApproveForUser,
  executeRejectForUser,
} from "@/lib/email-actions/service";
import {
  renderExecutionResultPage,
  renderResultPage,
} from "@/lib/email-actions/renderPages";

const APPROVAL_CENTER_URL = "/dashboard/approvals?view=pending";

function htmlResponse(html: string, status = 200): NextResponse {
  return new NextResponse(html, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

function singleOutcomeCopy(action: "approve" | "reject", outcome: EmailActionItemOutcome): {
  title: string;
  message: string;
  tone: "success" | "neutral" | "error";
  status: number;
} {
  const verb = action === "approve" ? "approved" : "rejected";

  switch (outcome) {
    case "done":
      return {
        title: action === "approve" ? "Approved" : "Rejected",
        message:
          action === "approve"
            ? "This recommendation has been approved. It's ready for publishing after your normal workflow."
            : "This recommendation has been rejected.",
        tone: "success",
        status: 200,
      };
    case "already_done":
      return {
        title: `Already ${verb}`,
        message: "Nothing else to do.",
        tone: "neutral",
        status: 200,
      };
    case "not_found":
      return {
        title: "Not found",
        message: "This recommendation could not be found for your account.",
        tone: "error",
        status: 404,
      };
    case "not_pending":
      return {
        title: "No longer pending",
        message: "This recommendation is no longer awaiting review, so it can't be actioned from this link.",
        tone: "neutral",
        status: 409,
      };
    case "invalid_reason":
      return {
        title: "Invalid reason",
        message: "Please choose a valid rejection reason and try again.",
        tone: "error",
        status: 400,
      };
    default:
      return {
        title: "Something went wrong",
        message: "This action could not be completed. Please try again from the Approval Center.",
        tone: "error",
        status: 500,
      };
  }
}

/**
 * The ONLY route in this feature that mutates state. Every authorization fact
 * (userId, businessProfileId, contentApprovalId(s), action, emailRecipient) is taken
 * from the re-verified signed token -- form fields other than `token` (and, for reject,
 * the reason/comment text) are never trusted for authorization.
 */
export async function POST(request: Request) {
  const form = await request.formData();
  const token = form.get("token");

  if (typeof token !== "string" || !token) {
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

  // Unauthenticated POSTs never execute anything -- there is no pending-action restore
  // here by design; the user must re-open the link (GET, which redirects through login
  // and re-verifies) before any mutation can run.
  if (!user) {
    return htmlResponse(
      renderResultPage({
        title: "Please sign in",
        message: "Your session has expired. Reopen the link from the email to sign in and try again.",
        tone: "error",
      }),
      401
    );
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

  const { ipAddress, userAgent } = await getAuditRequestContext();

  if (payload.action === EmailActionTypes.APPROVE_ALL) {
    const contentApprovalIds = payload.contentApprovalIds ?? [];
    const result = await executeApproveAllForUser(
      supabase,
      payload.userId,
      payload.businessProfileId,
      contentApprovalIds,
      payload.nonce
    );

    const anySucceeded = result.items.some((i) => i.outcome === "done" || i.outcome === "already_done");
    await logAuditEvent(supabase, {
      userId: payload.userId,
      businessProfileId: payload.businessProfileId,
      action: AuditActions.EMAIL_ACTION_EXECUTED,
      entityType: "email_action_approve_all",
      entityId: null,
      status: anySucceeded ? "success" : "failure",
      metadata: {
        contentApprovalIds,
        outcomes: result.items,
        emailRecipient: payload.emailRecipient,
        nonce: payload.nonce,
      },
      ipAddress,
      userAgent,
    });

    return htmlResponse(
      renderExecutionResultPage({ result, approvalCenterUrl: APPROVAL_CENTER_URL }),
      anySucceeded ? 200 : 409
    );
  }

  if (payload.action === EmailActionTypes.APPROVE) {
    const contentApprovalId = payload.contentApprovalId!;
    const outcome = await executeApproveForUser(
      supabase,
      payload.userId,
      payload.businessProfileId,
      contentApprovalId,
      payload.nonce
    );

    await logAuditEvent(supabase, {
      userId: payload.userId,
      businessProfileId: payload.businessProfileId,
      action: AuditActions.EMAIL_ACTION_EXECUTED,
      entityType: "content_approval",
      entityId: contentApprovalId,
      status: outcome === "done" || outcome === "already_done" ? "success" : "failure",
      metadata: { outcome, emailRecipient: payload.emailRecipient, nonce: payload.nonce },
      ipAddress,
      userAgent,
    });

    const copy = singleOutcomeCopy("approve", outcome);
    return htmlResponse(
      renderResultPage({ title: copy.title, message: copy.message, tone: copy.tone, approvalCenterUrl: APPROVAL_CENTER_URL }),
      copy.status
    );
  }

  // reject
  const contentApprovalId = payload.contentApprovalId!;
  const reasonCode = form.get("reasonCode");
  const comment = form.get("comment");

  const outcome = await executeRejectForUser(
    supabase,
    payload.userId,
    payload.businessProfileId,
    contentApprovalId,
    typeof reasonCode === "string" ? reasonCode : undefined,
    typeof comment === "string" && comment.trim() ? comment.trim() : undefined,
    payload.nonce
  );

  await logAuditEvent(supabase, {
    userId: payload.userId,
    businessProfileId: payload.businessProfileId,
    action: AuditActions.EMAIL_ACTION_REJECTED,
    entityType: "content_approval",
    entityId: contentApprovalId,
    status: outcome === "done" || outcome === "already_done" ? "success" : "failure",
    metadata: {
      outcome,
      reasonProvided: typeof reasonCode === "string" && Boolean(reasonCode),
      emailRecipient: payload.emailRecipient,
      nonce: payload.nonce,
    },
    ipAddress,
    userAgent,
  });

  const copy = singleOutcomeCopy("reject", outcome);
  return htmlResponse(
    renderResultPage({ title: copy.title, message: copy.message, tone: copy.tone, approvalCenterUrl: APPROVAL_CENTER_URL }),
    copy.status
  );
}

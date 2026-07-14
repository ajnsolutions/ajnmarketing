import "server-only";

import { RejectionReasonCodes } from "@/lib/recommendation-outcomes/types";
import type { EmailActionExecutionResult } from "@/lib/email-actions/types";

/**
 * Lightweight, brand-consistent HTML pages served by the email-action routes
 * (confirm / reject-reason / result). These are plain server-rendered pages, not
 * emails -- no table-layout/inline-CSS email-client constraints apply, but the
 * palette matches lib/weekly-approval-package/renderHtml.ts so the experience feels
 * continuous from inbox to browser.
 */

const COLORS = {
  navy: "#0f172a",
  deepNavy: "#0b1426",
  brand: "#2563eb",
  muted: "#64748b",
  surface: "#f8fafc",
  border: "#e2e8f0",
  white: "#ffffff",
  body: "#334155",
  danger: "#b91c1c",
  dangerSurface: "#fef2f2",
};

const REASON_LABELS: Record<string, string> = {
  [RejectionReasonCodes.TOO_PROMOTIONAL]: "Too promotional",
  [RejectionReasonCodes.WRONG_TONE]: "Wrong tone",
  [RejectionReasonCodes.INCORRECT_INFORMATION]: "Incorrect information",
  [RejectionReasonCodes.OFF_BRAND_TOPIC]: "Off-brand topic",
  [RejectionReasonCodes.POOR_TIMING]: "Poor timing",
  [RejectionReasonCodes.DUPLICATE_CONTENT]: "Duplicate content",
  [RejectionReasonCodes.OTHER]: "Other",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function pageShell(input: { title: string; bodyHtml: string }): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(input.title)}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.surface};color:${COLORS.navy};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:32px 16px;">
    <div style="background:${COLORS.white};border:1px solid ${COLORS.border};border-radius:16px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,${COLORS.deepNavy},${COLORS.navy});padding:24px;">
        <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#94a3b8;">AJN Marketing</p>
      </div>
      <div style="padding:28px 24px;">
        ${input.bodyHtml}
      </div>
    </div>
  </div>
</body>
</html>`;
}

function approvalCenterLink(approvalCenterUrl: string): string {
  return `<p style="margin:20px 0 0;font-size:13px;line-height:1.55;color:${COLORS.muted};">
    <a href="${escapeHtml(approvalCenterUrl)}" style="color:${COLORS.brand};font-weight:700;text-decoration:none;">Open Approval Center</a>
  </p>`;
}

export function renderConfirmApprovePage(input: {
  action: "approve" | "approve_all";
  itemCount?: number;
  businessName: string;
  token: string;
  executeUrl: string;
  approvalCenterUrl: string;
}): string {
  const isAll = input.action === "approve_all";
  const heading = isAll ? "Approve all pending items?" : "Approve this recommendation?";
  const description = isAll
    ? `This approves ${input.itemCount ?? "the"} recommendation${input.itemCount === 1 ? "" : "s"} included in this week's package for ${escapeHtml(
        input.businessName
      )}. Nothing new created after this package was generated will be affected.`
    : `This approves the recommendation draft for ${escapeHtml(input.businessName)}.`;

  const body = `
    <h1 style="margin:0;font-size:20px;font-weight:700;color:${COLORS.navy};">${escapeHtml(heading)}</h1>
    <p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:${COLORS.body};">${description}</p>
    <p style="margin:12px 0 0;font-size:13px;line-height:1.55;color:${COLORS.muted};">
      This does not publish anything. Publishing still follows your normal workflow after approval.
    </p>
    <form method="POST" action="${escapeHtml(input.executeUrl)}" style="margin-top:20px;">
      <input type="hidden" name="token" value="${escapeHtml(input.token)}" />
      <button type="submit" style="display:inline-block;background:${COLORS.deepNavy};color:${COLORS.white};font-size:15px;font-weight:700;border:none;cursor:pointer;padding:14px 28px;border-radius:999px;">
        ${isAll ? "Approve All" : "Approve"}
      </button>
    </form>
    ${approvalCenterLink(input.approvalCenterUrl)}`;

  return pageShell({ title: heading, bodyHtml: body });
}

export function renderRejectReasonPage(input: {
  businessName: string;
  token: string;
  executeUrl: string;
  approvalCenterUrl: string;
}): string {
  const options = Object.values(RejectionReasonCodes)
    .map((code) => `<option value="${escapeHtml(code)}">${escapeHtml(REASON_LABELS[code] ?? code)}</option>`)
    .join("");

  const body = `
    <h1 style="margin:0;font-size:20px;font-weight:700;color:${COLORS.navy};">Reject this recommendation?</h1>
    <p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:${COLORS.body};">
      Let us know why so future recommendations for ${escapeHtml(input.businessName)} can improve.
    </p>
    <form method="POST" action="${escapeHtml(input.executeUrl)}" style="margin-top:20px;">
      <input type="hidden" name="token" value="${escapeHtml(input.token)}" />
      <label style="display:block;font-size:13px;font-weight:700;color:${COLORS.navy};margin-bottom:6px;" for="reasonCode">Reason</label>
      <select id="reasonCode" name="reasonCode" required style="width:100%;padding:10px 12px;font-size:14px;border:1px solid ${COLORS.border};border-radius:8px;color:${COLORS.navy};background:${COLORS.white};margin-bottom:16px;">
        ${options}
      </select>
      <label style="display:block;font-size:13px;font-weight:700;color:${COLORS.navy};margin-bottom:6px;" for="comment">Additional detail (optional)</label>
      <textarea id="comment" name="comment" rows="3" style="width:100%;padding:10px 12px;font-size:14px;border:1px solid ${COLORS.border};border-radius:8px;color:${COLORS.navy};margin-bottom:20px;font-family:inherit;"></textarea>
      <button type="submit" style="display:inline-block;background:${COLORS.danger};color:${COLORS.white};font-size:15px;font-weight:700;border:none;cursor:pointer;padding:14px 28px;border-radius:999px;">
        Reject
      </button>
    </form>
    ${approvalCenterLink(input.approvalCenterUrl)}`;

  return pageShell({ title: "Reject recommendation", bodyHtml: body });
}

export function renderResultPage(input: {
  title: string;
  message: string;
  tone?: "success" | "neutral" | "error";
  approvalCenterUrl?: string;
}): string {
  const tone = input.tone ?? "neutral";
  const color = tone === "error" ? COLORS.danger : COLORS.navy;

  const body = `
    <h1 style="margin:0;font-size:20px;font-weight:700;color:${color};">${escapeHtml(input.title)}</h1>
    <p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:${COLORS.body};">${escapeHtml(input.message)}</p>
    ${input.approvalCenterUrl ? approvalCenterLink(input.approvalCenterUrl) : ""}`;

  return pageShell({ title: input.title, bodyHtml: body });
}

const OUTCOME_LABELS: Record<string, string> = {
  done: "approved",
  already_done: "already handled",
  not_found: "not found",
  not_pending: "no longer pending",
  invalid_reason: "invalid reason",
  failed: "failed",
};

/**
 * Approve-All result summary: reports partial success rather than an all-or-nothing
 * verdict, per Phase 4's "continue safely, report partial results" requirement.
 */
export function renderExecutionResultPage(input: {
  result: EmailActionExecutionResult;
  approvalCenterUrl: string;
}): string {
  const { items } = input.result;
  const doneCount = items.filter((i) => i.outcome === "done").length;
  const alreadyCount = items.filter((i) => i.outcome === "already_done").length;
  const otherCount = items.length - doneCount - alreadyCount;

  let title: string;
  let message: string;
  let tone: "success" | "neutral" | "error" = "success";

  if (doneCount === 0 && alreadyCount > 0 && otherCount === 0) {
    title = "Already approved";
    message = "Nothing else to do -- everything in this package was already approved.";
    tone = "neutral";
  } else if (otherCount > 0) {
    title = "Partially approved";
    message = `${doneCount} of ${items.length} recommendation${items.length === 1 ? "" : "s"} approved. ${otherCount} item${
      otherCount === 1 ? "" : "s"
    } could not be approved (already handled, no longer pending, or removed). Everything approved is ready for publishing after your normal workflow.`;
    tone = doneCount > 0 ? "success" : "error";
  } else {
    title = "Approved";
    message = `${doneCount} recommendation${doneCount === 1 ? "" : "s"} approved. Everything is ready for publishing after your normal workflow.`;
    tone = "success";
  }

  const detail = items
    .map((item) => `${item.contentApprovalId.slice(0, 8)}… — ${OUTCOME_LABELS[item.outcome] ?? item.outcome}`)
    .join("<br />");

  const body = `
    <h1 style="margin:0;font-size:20px;font-weight:700;color:${tone === "error" ? COLORS.danger : COLORS.navy};">${escapeHtml(title)}</h1>
    <p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:${COLORS.body};">${escapeHtml(message)}</p>
    ${
      items.length > 1
        ? `<p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:${COLORS.muted};">${detail}</p>`
        : ""
    }
    ${approvalCenterLink(input.approvalCenterUrl)}`;

  return pageShell({ title, bodyHtml: body });
}

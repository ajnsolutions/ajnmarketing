import type { WeeklyApprovalPackage, WeeklyPackageItem } from "@/lib/weekly-approval-package/types";

const COLORS = {
  navy: "#0f172a",
  deepNavy: "#0b1426",
  brand: "#2563eb",
  muted: "#64748b",
  surface: "#f8fafc",
  border: "#e2e8f0",
  white: "#ffffff",
  body: "#334155",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function itemBlock(item: WeeklyPackageItem): string {
  const why = item.whyNow
    ? `<p style="margin:8px 0 0;font-size:14px;line-height:1.55;color:${COLORS.body};"><strong style="color:${COLORS.navy};">Why now:</strong> ${escapeHtml(item.whyNow)}</p>`
    : "";
  const benefit = item.expectedBenefit
    ? `<p style="margin:6px 0 0;font-size:14px;line-height:1.55;color:${COLORS.body};"><strong style="color:${COLORS.navy};">Expected benefit:</strong> ${escapeHtml(item.expectedBenefit)}</p>`
    : "";

  return `
    <tr>
      <td style="padding:16px 0;border-bottom:1px solid ${COLORS.border};">
        <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${COLORS.muted};">${escapeHtml(item.platformLabel)}</p>
        <p style="margin:6px 0 0;font-size:16px;font-weight:700;color:${COLORS.navy};line-height:1.35;">${escapeHtml(item.title)}</p>
        <p style="margin:8px 0 0;font-size:14px;line-height:1.55;color:${COLORS.body};">${escapeHtml(item.summary)}</p>
        ${why}
        ${benefit}
        <p style="margin:14px 0 0;">
          <a href="${escapeHtml(item.reviewUrl)}" style="display:inline-block;font-size:14px;font-weight:700;color:${COLORS.brand};text-decoration:none;">Review in Approval Center →</a>
        </p>
      </td>
    </tr>`;
}

/**
 * Responsive HTML email using table layout + inline styles (email-client safe).
 * Brand colors match app/globals.css (navy / brand / surface).
 */
export function renderWeeklyApprovalPackageHtml(pkg: WeeklyApprovalPackage): string {
  const summaryLines = pkg.executiveSummary.byPlatform
    .map((row) => `<li style="margin:0 0 4px;">${escapeHtml(String(row.count))} ${escapeHtml(row.label)}</li>`)
    .join("");

  const groupsHtml = pkg.groups
    .map((group) => {
      const items = group.items.map(itemBlock).join("");
      return `
        <tr>
          <td style="padding:28px 0 8px;">
            <h2 style="margin:0;font-size:18px;font-weight:700;color:${COLORS.navy};">${escapeHtml(group.platformLabel)}</h2>
          </td>
        </tr>
        ${items}`;
    })
    .join("");

  const emptyHtml = `
    <tr>
      <td style="padding:24px 0;">
        <p style="margin:0;font-size:15px;line-height:1.6;color:${COLORS.body};">
          You’re all caught up — there are no pending items waiting for approval this week.
        </p>
      </td>
    </tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${escapeHtml(pkg.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.surface};color:${COLORS.navy};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.surface};padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:${COLORS.white};border:1px solid ${COLORS.border};border-radius:16px;overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,${COLORS.deepNavy},${COLORS.navy});padding:28px 24px;">
              <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#94a3b8;">AJN Marketing</p>
              <h1 style="margin:10px 0 0;font-size:24px;line-height:1.25;font-weight:700;color:${COLORS.white};">Your weekly content is ready</h1>
              <p style="margin:10px 0 0;font-size:14px;color:#cbd5e1;">Week of ${escapeHtml(pkg.weekLabel)} · ${escapeHtml(pkg.businessName)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px 8px;">
              <p style="margin:0;font-size:15px;line-height:1.6;color:${COLORS.body};">Hi ${escapeHtml(pkg.recipientName)},</p>
              <p style="margin:14px 0 0;font-size:16px;line-height:1.55;font-weight:700;color:${COLORS.navy};">${escapeHtml(pkg.executiveSummary.headline)}</p>
              <p style="margin:10px 0 0;font-size:15px;line-height:1.6;color:${COLORS.body};">
                Review everything in your Approval Center. Nothing is published until you approve it.
              </p>
            </td>
          </tr>
          ${
            pkg.isEmpty
              ? ""
              : `<tr>
            <td style="padding:8px 24px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.surface};border:1px solid ${COLORS.border};border-radius:12px;">
                <tr>
                  <td style="padding:16px 18px;">
                    <p style="margin:0;font-size:14px;font-weight:700;color:${COLORS.navy};">Approval summary</p>
                    <ul style="margin:10px 0 0;padding-left:18px;font-size:14px;line-height:1.55;color:${COLORS.body};">
                      <li style="margin:0 0 4px;">${escapeHtml(String(pkg.executiveSummary.totalItems))} item${pkg.executiveSummary.totalItems === 1 ? "" : "s"} awaiting approval</li>
                      ${summaryLines}
                    </ul>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 24px 8px;" align="center">
              <a href="${escapeHtml(pkg.approveAllUrl)}" style="display:inline-block;background:${COLORS.deepNavy};color:${COLORS.white};font-size:15px;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:999px;">
                Approve All in Approval Center
              </a>
              <p style="margin:12px 0 0;font-size:12px;line-height:1.5;color:${COLORS.muted};max-width:420px;">
                Opens your secure Approval Center. Approvals always happen there — this email never auto-approves or publishes.
              </p>
            </td>
          </tr>`
          }
          <tr>
            <td style="padding:8px 24px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${pkg.isEmpty ? emptyHtml : groupsHtml}
              </table>
              <p style="margin:24px 0 0;font-size:13px;line-height:1.55;color:${COLORS.muted};">
                Prefer the dashboard?
                <a href="${escapeHtml(pkg.approvalCenterUrl)}" style="color:${COLORS.brand};font-weight:700;text-decoration:none;">Open Approval Center</a>
              </p>
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0;font-size:11px;line-height:1.5;color:${COLORS.muted};max-width:600px;">
          This message was generated for ${escapeHtml(pkg.businessName)}. Links are signed, time-limited, and scoped to your account.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

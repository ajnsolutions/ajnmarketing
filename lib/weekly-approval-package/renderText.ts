import type { WeeklyApprovalPackage } from "@/lib/weekly-approval-package/types";

export function renderWeeklyApprovalPackageText(pkg: WeeklyApprovalPackage): string {
  const lines: string[] = [
    "AJN Marketing — Weekly Approval Package",
    `Week of ${pkg.weekLabel}`,
    `Business: ${pkg.businessName}`,
    "",
    `Hi ${pkg.recipientName},`,
    "",
    pkg.executiveSummary.headline,
    "",
    "Nothing is published until you approve it in the Approval Center.",
    "",
  ];

  if (!pkg.isEmpty) {
    lines.push("Summary:");
    for (const row of pkg.executiveSummary.byPlatform) {
      lines.push(`- ${row.count} ${row.label}`);
    }
    lines.push("");
    lines.push(`Approve All (opens Approval Center): ${pkg.approveAllUrl}`);
    lines.push("");

    for (const group of pkg.groups) {
      lines.push(`## ${group.platformLabel}`);
      lines.push("");
      for (const item of group.items) {
        lines.push(item.title);
        lines.push(item.summary);
        if (item.whyNow) lines.push(`Why now: ${item.whyNow}`);
        if (item.expectedBenefit) lines.push(`Expected benefit: ${item.expectedBenefit}`);
        lines.push(`Review: ${item.reviewUrl}`);
        lines.push("");
      }
    }
  } else {
    lines.push("You’re all caught up — no pending items this week.");
    lines.push("");
  }

  lines.push(`Approval Center: ${pkg.approvalCenterUrl}`);
  lines.push("");
  lines.push("Links are signed, time-limited, and scoped to your account.");

  return lines.join("\n");
}

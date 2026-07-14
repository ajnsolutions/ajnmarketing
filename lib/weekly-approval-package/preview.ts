import "server-only";

import type { WeeklyApprovalPackage } from "@/lib/weekly-approval-package/types";

/**
 * Development preview envelope — never sends mail. Used by the preview API /
 * delivery page so operators can inspect HTML + text safely.
 */
export type WeeklyApprovalPackagePreview = {
  mode: "preview";
  generatedAt: string;
  subject: string;
  to: string | null;
  from: string;
  itemCount: number;
  isEmpty: boolean;
  html: string;
  text: string;
  approveAllUrl: string;
  approvalCenterUrl: string;
  groups: Array<{ platformLabel: string; count: number }>;
};

export function toWeeklyApprovalPackagePreview(
  pkg: WeeklyApprovalPackage
): WeeklyApprovalPackagePreview {
  return {
    mode: "preview",
    generatedAt: pkg.generatedAt,
    subject: pkg.subject,
    to: pkg.recipientEmail,
    from: "AJN Marketing <updates@ajnmarketing.com>",
    itemCount: pkg.executiveSummary.totalItems,
    isEmpty: pkg.isEmpty,
    html: pkg.html,
    text: pkg.text,
    approveAllUrl: pkg.approveAllUrl,
    approvalCenterUrl: pkg.approvalCenterUrl,
    groups: pkg.groups.map((g) => ({
      platformLabel: g.platformLabel,
      count: g.items.length,
    })),
  };
}

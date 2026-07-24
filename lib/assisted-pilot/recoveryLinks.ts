/**
 * Phase 5 — static guided recovery links for operators.
 * Maps existing health signals / issue categories to routes already supported by the product.
 * No new backend actions.
 */

export type GuidedRecoveryAction = {
  id: string;
  label: string;
  description: string;
  href: string;
  /** Optional pilot manual action key when the assisted-pilot console can run it. */
  manualActionKey?: string;
};

export const GUIDED_RECOVERY_ACTIONS: readonly GuidedRecoveryAction[] = [
  {
    id: "retry_website_analysis",
    label: "Retry website analysis",
    description: "Re-run analysis when a scan failed or looks stale.",
    href: "/dashboard/website-analysis",
    manualActionKey: "website_analysis",
  },
  {
    id: "reconnect_google",
    label: "Reconnect Google Business",
    description: "Customer signs in again when Google is disconnected or scopes are invalid.",
    href: "/dashboard/google-business-profile/connect",
  },
  {
    id: "continue_onboarding",
    label: "Continue onboarding",
    description: "Open the customer setup checklist for remaining foundation steps.",
    href: "/dashboard/setup",
  },
  {
    id: "confirm_brand_voice",
    label: "Confirm Brand Voice",
    description: "Review tone and vocabulary before generating more drafts.",
    href: "/dashboard/brand-voice",
  },
  {
    id: "regenerate_marketing_plan",
    label: "Regenerate Marketing Plan",
    description: "Refresh the monthly plan from the Marketing Plan page.",
    href: "/dashboard/marketing-plan",
  },
  {
    id: "review_approvals",
    label: "Review pending approvals",
    description: "Clear overdue or waiting approvals in This Week.",
    href: "/dashboard/approvals",
  },
  {
    id: "retry_publishing",
    label: "Retry publishing",
    description: "Open Publishing for failed items — retry uses existing publish controls.",
    href: "/dashboard/publishing",
    manualActionKey: "publishing",
  },
  {
    id: "weekly_package",
    label: "Generate weekly package",
    description: "Build the weekly approval preview package (manual assisted-pilot action).",
    href: "/dashboard/approvals/delivery",
    manualActionKey: "weekly_package",
  },
  {
    id: "head_of_marketing",
    label: "Open Head of Marketing",
    description: "Check the customer’s calm weekly briefing and primary next step.",
    href: "/dashboard",
  },
] as const;

export function recoveryActionsForAttention(kind: string): GuidedRecoveryAction[] {
  switch (kind) {
    case "onboarding":
    case "setup":
      return GUIDED_RECOVERY_ACTIONS.filter((a) =>
        ["continue_onboarding", "confirm_brand_voice", "head_of_marketing"].includes(a.id),
      );
    case "google_business":
    case "oauth":
      return GUIDED_RECOVERY_ACTIONS.filter((a) => a.id === "reconnect_google");
    case "publishing":
    case "publish_failure":
      return GUIDED_RECOVERY_ACTIONS.filter((a) => a.id === "retry_publishing");
    case "website_analysis":
      return GUIDED_RECOVERY_ACTIONS.filter((a) => a.id === "retry_website_analysis");
    case "approvals":
    case "pending_approvals":
      return GUIDED_RECOVERY_ACTIONS.filter((a) =>
        ["review_approvals", "weekly_package"].includes(a.id),
      );
    case "marketing_plan":
      return GUIDED_RECOVERY_ACTIONS.filter((a) => a.id === "regenerate_marketing_plan");
    case "inactive":
      return GUIDED_RECOVERY_ACTIONS.filter((a) =>
        ["head_of_marketing", "continue_onboarding", "weekly_package"].includes(a.id),
      );
    default:
      return GUIDED_RECOVERY_ACTIONS.slice(0, 4);
  }
}

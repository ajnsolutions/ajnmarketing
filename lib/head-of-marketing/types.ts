export type MarketingHealthState =
  | "excellent"
  | "healthy"
  | "needs_attention"
  | "at_risk";

export type HeadOfMarketingPrimaryActionKind =
  | "review_week"
  | "connect_google"
  | "none";

export type HeadOfMarketingPrimaryAction = {
  kind: HeadOfMarketingPrimaryActionKind;
  label: string;
  href: string;
};

export type HeadOfMarketingHealth = {
  state: MarketingHealthState;
  label: string;
  message: string;
  reason: string;
};

export type HeadOfMarketingBriefing = {
  greeting: string;
  lead: string;
  health: HeadOfMarketingHealth;
  accomplishments: string[];
  noticed: string[];
  recommendation: {
    title: string;
    why: string;
  } | null;
  primaryAction: HeadOfMarketingPrimaryAction;
  estimatedReviewMinutes: number;
  magicMoment: string | null;
  isEarlyCustomer: boolean;
  businessName: string;
};

/** Customer-facing primary nav — one answer to “what next?” */
export const HOM_PRIMARY_NAV_HREFS = [
  "/dashboard",
  "/dashboard/approvals",
  "/dashboard/google-business-profile",
  "/dashboard/settings",
] as const;

/**
 * Tools that still exist but must not compete as separate “brains.”
 * Shown under progressive disclosure (“More tools”).
 */
export const HOM_ADVANCED_NAV_HREFS = [
  "/dashboard/command-center",
  "/dashboard/tasks",
  "/dashboard/marketing-plan",
  "/dashboard/marketing-recommendations",
  "/dashboard/publishing",
  "/dashboard/content",
  "/dashboard/reviews",
  "/dashboard/analytics",
  "/dashboard/website-analysis",
  "/dashboard/brand-voice",
  "/dashboard/ai-profile",
  "/dashboard/market-context",
  "/dashboard/notifications",
  "/dashboard/billing",
] as const;

import type { CampaignDashboardCard } from "@/lib/campaign-intelligence/campaign-types";
import type { ExecutiveBrief } from "@/lib/executive-briefing/types";
import type { HeadOfMarketingJournal } from "@/lib/head-of-marketing/journalTypes";
import type { MonthlyFocus } from "@/lib/head-of-marketing/monthlyFocusTypes";
import type { ProactivePresence } from "@/lib/head-of-marketing/proactiveTypes";

export type MarketingHealthState =
  | "excellent"
  | "healthy"
  | "needs_attention"
  | "at_risk";

export type HeadOfMarketingPrimaryActionKind =
  | "review_week"
  | "approve_weekly_package"
  | "review_recommendation"
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

/**
 * Architecture hook for future management styles.
 * Weekly Briefing is the foundation; styles will change cadence/depth later.
 */
export type BriefingCadenceSupport = {
  /** Styles from Trust Model — not fully productized yet. */
  supportedStyles: Array<"hands_on" | "weekly" | "monthly" | "trusted">;
  /** Active presentation cadence today. */
  activeCadence: "weekly";
  note: string;
};

export type WeeklyBriefingRecommendation = {
  title: string;
  why: string;
  expectedBenefit: string;
};

export type HeadOfMarketingBriefing = {
  /** Customer-facing experience name */
  experienceTitle: "Weekly Briefing";
  greeting: string;
  lead: string;
  health: HeadOfMarketingHealth;
  /** This Week — done-for-you narrative */
  thisWeek: string[];
  /** What I noticed */
  noticed: string[];
  recommendation: WeeklyBriefingRecommendation | null;
  /** Next Week — what I'll be working on */
  nextWeek: string[];
  /** Continuity line from real history only; null when nothing honest to say */
  relationshipMemory: string | null;
  primaryAction: HeadOfMarketingPrimaryAction;
  estimatedReviewMinutes: number;
  /** Human label: "2 minutes" | "Nothing to review" */
  timeRespectLabel: string;
  magicMoment: string | null;
  isEarlyCustomer: boolean;
  businessName: string;
  cadence: BriefingCadenceSupport;
  /** Day-by-day narrative window into HoM work — not an audit log. */
  journal: HeadOfMarketingJournal;
  /** Living monthly priorities — not a traditional marketing plan document. */
  monthlyFocus: MonthlyFocus;
  /** Lightweight proactive presence — one primary moment; rest via disclosure. */
  proactive: ProactivePresence;
  /**
   * Surfaced Morning Executive Brief — summarizes Marketing Director + existing signals.
   * Does not create recommendations; priorities come from the MD decision only.
   */
  executiveBrief: ExecutiveBrief;
  /** All supported brief types from the same decision (weekly/monthly not surfaced yet). */
  executiveBriefs: {
    morning: ExecutiveBrief;
    weeklyStrategy: ExecutiveBrief;
    monthlyExecutive: ExecutiveBrief;
  };
  /**
   * Active Campaign Intelligence execution plans. Empty until Marketing Director
   * initiates a campaign. Never contains independently invented recommendations.
   */
  campaigns: CampaignDashboardCard[];
};

/** Customer-facing primary nav — Great Simplification four destinations. */
export const HOM_PRIMARY_NAV_HREFS = [
  "/dashboard",
  "/dashboard/results",
  "/dashboard/library",
  "/dashboard/settings",
] as const;

/**
 * Tools that still exist but must not compete as separate “brains.”
 * Shown under progressive disclosure (“More tools”).
 */
export const HOM_ADVANCED_NAV_HREFS = [
  "/dashboard/approvals",
  "/dashboard/google-business-profile",
  "/dashboard/command-center",
  "/dashboard/tasks",
  "/dashboard/marketing-plan",
  "/dashboard/marketing-recommendations",
  "/dashboard/publishing",
  "/dashboard/reviews",
  "/dashboard/website-analysis",
  "/dashboard/brand-voice",
  "/dashboard/ai-profile",
  "/dashboard/market-context",
  "/dashboard/notifications",
  "/dashboard/billing",
  "/dashboard/content",
  "/dashboard/analytics",
] as const;

import type { CampaignDashboardCard } from "@/lib/campaign-intelligence/campaign-types";
import type { WhyPlanChangedPreview } from "@/lib/decision-intelligence/dashboard";
import type { ExecutiveBrief } from "@/lib/executive-briefing/types";
import type { HeadOfMarketingJournal } from "@/lib/head-of-marketing/journalTypes";
import type { MonthlyFocus } from "@/lib/head-of-marketing/monthlyFocusTypes";
import type { ProactivePresence } from "@/lib/head-of-marketing/proactiveTypes";
import type { MarketingDirectorDecision } from "@/lib/marketing-director/types";
import type { ExperimentDashboardCard } from "@/lib/marketing-experimentation/experiment-types";
import type { ExperimentProposalCard } from "@/lib/marketing-experimentation/proposal-types";
import type { StrategicCalendarPreview } from "@/lib/strategic-marketing-calendar/calendar-types";

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
  /**
   * Experimentation Engine dashboard cards. pendingProposals are server-authored,
   * awaiting the user's explicit approval — the client never defines these. Empty until
   * Marketing Director's eligibility rule proposes one from an existing, open
   * recommendation. Measurement only.
   */
  experiments: {
    pendingProposals: ExperimentProposalCard[];
    active: ExperimentDashboardCard[];
    completed: ExperimentDashboardCard[];
  };
  /**
   * Compact read-only Strategic Marketing Calendar preview (next 7 days).
   * Aggregates existing sources — never invents schedule commitments.
   */
  calendarPreview: StrategicCalendarPreview | null;
  /**
   * Decision Intelligence & Learning Impact (Phase 2F) — compact "Why the Plan Changed"
   * preview. Filled by the HoM service from lib/decision-intelligence/. Null only when
   * decision-history reads fail entirely (partial-failure fallback, not "no changes").
   */
  whyPlanChanged: WhyPlanChangedPreview | null;
  /**
   * Phase 4C — presentation-only confidence facts already computed for this briefing.
   * No new engines or fetches; mirrors WeeklyBriefingInput counts for trust UI.
   */
  confidence: {
    pendingApprovals: number;
    publishFailures: number;
    openRecommendations: number;
    publishingReadyOrScheduled: number;
    weeklyPublishedPosts: number;
    weeklyNewReviews: number;
    gbpConnected: boolean;
    hasMarketingPlan: boolean;
    profileCreatedAt: string | null;
  };
  /**
   * Internal only — the already-computed MarketingDirectorDecision this briefing's
   * primaryAction/lead were derived from (see weeklyBriefing.ts). Exists so the HoM
   * service can record a Decision Intelligence snapshot from a decision that was already
   * computed, without a second resolveMarketingDirectorDecision call. Never rendered;
   * never sent to the client (this object is only ever used server-side before the page
   * renders to HTML).
   */
  internalDecision: MarketingDirectorDecision;
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
  "/dashboard/strategic-marketing-calendar",
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

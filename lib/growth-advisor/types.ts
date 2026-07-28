import type { HeadOfMarketingPrimaryAction, MarketingHealthState } from "@/lib/head-of-marketing/types";
import type { ConfidenceLabel } from "@/lib/recommendation-presentation/types";

/**
 * Your Growth Advisor — the conversational shape of the authenticated home
 * experience. This is a pure presentation transform over the already-computed
 * HeadOfMarketingBriefing (see buildGrowthAdvisorBriefing.ts) — it introduces
 * no new decision-making, scoring, or recommendation logic of its own.
 * "Growth Advisor" is the customer-facing name; internal architecture
 * (Marketing Director, Head of Marketing modules, Business Brain) keeps its
 * existing names — see docs/project-magic/GROWTH_ADVISOR.md.
 */

export type GrowthAdvisorObservation = {
  /** What happened — one short, plain-language clause. */
  headline: string;
  /** Why it matters — a second clause explaining the consequence, never technical. */
  whyItMatters: string;
};

export type GrowthAdvisorRecommendation = {
  title: string;
  /** Why now. */
  whyNow: string;
  /** Expected impact. */
  expectedImpact: string;
  /** Estimated effort — reuses the briefing's own already-computed time estimate. */
  estimatedEffort: string;
  /** Why I believe this — reuses existing recommendation-presentation confidence explainability when available. */
  whyIBelieve: string;
  /** Present only when this recommendation came from a real ranked marketing recommendation. */
  confidenceLabel: ConfidenceLabel | null;
  confidenceLabelText: string | null;
};

export type GrowthAdvisorWhatChanged = {
  /** True when at least one real, non-generic change occurred since the last briefing window. */
  hasMeaningfulChange: boolean;
  /** Plain-language items — reused verbatim from the briefing's own grounded "this week" signals. */
  items: string[];
  /** Continuity sentence from real history only (relationship memory / journal) — null when nothing honest to say. */
  memoryLine: string | null;
};

export type GrowthAdvisorSupportingContext = {
  health: {
    state: MarketingHealthState;
    label: string;
    message: string;
  };
  journalIntro: string;
  hasRecentActivity: boolean;
};

export type GrowthAdvisorEmptyStateKind =
  | "new_customer"
  | "setup_incomplete"
  | "no_recommendation"
  | "disconnected_integration"
  | "no_recent_activity"
  | null;

export type GrowthAdvisorBriefing = {
  greeting: string;
  businessName: string;
  whatChanged: GrowthAdvisorWhatChanged;
  whatINoticed: GrowthAdvisorObservation[];
  recommendation: GrowthAdvisorRecommendation | null;
  primaryAction: HeadOfMarketingPrimaryAction;
  /** Set when the primary action itself is "nothing to do" — renders reassurance copy instead of a CTA. */
  primaryActionIsReassurance: boolean;
  emptyStateKind: GrowthAdvisorEmptyStateKind;
  supporting: GrowthAdvisorSupportingContext;
};

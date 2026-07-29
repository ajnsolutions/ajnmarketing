import type { HeadOfMarketingPrimaryAction, MarketingHealthState } from "@/lib/head-of-marketing/types";
import type { ConfidenceLabel } from "@/lib/recommendation-presentation/types";
import type { GoalProgress, GoalProgressState } from "@/lib/goals/types";
import type { CustomerVoiceHealthState } from "@/lib/customer-voice/health";

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
  /** Supports Goal — customer goal this recommendation is tied to (strategy layer). */
  supportsGoal: string | null;
  /** Why this recommendation supports the goal — strategy layer, not a new score. */
  whySupportsGoal: string | null;
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
  /**
   * Natural Customer Voice context (e.g. "Customers consistently praise…").
   * Presentation only — does not change ranking. Null when evidence is thin.
   */
  customerVoiceContext: string | null;
};

export type GrowthAdvisorGoalProgressSummary = {
  items: GoalProgress[];
  /** Primary strategic focus label — null when no goals selected. */
  strategicFocus: string | null;
  /** Rollup state for the primary goal — never fabricated. */
  primaryState: GoalProgressState | null;
  /** Calm empty / baseline copy when goals or evidence are thin. */
  emptyDetail: string | null;
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
  /** Customer Voice Health — separate from Marketing Health; never fabricated. */
  customerVoiceHealth: {
    state: CustomerVoiceHealthState;
    label: string;
    message: string;
  } | null;
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
  /** Progress toward goals + strategic focus (Wave III). */
  goalProgress: GrowthAdvisorGoalProgressSummary;
  recommendation: GrowthAdvisorRecommendation | null;
  primaryAction: HeadOfMarketingPrimaryAction;
  /** Set when the primary action itself is "nothing to do" — renders reassurance copy instead of a CTA. */
  primaryActionIsReassurance: boolean;
  emptyStateKind: GrowthAdvisorEmptyStateKind;
  supporting: GrowthAdvisorSupportingContext;
};

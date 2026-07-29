import type { HeadOfMarketingPrimaryAction, MarketingHealthState } from "@/lib/head-of-marketing/types";
import type { ConfidenceLabel } from "@/lib/recommendation-presentation/types";
import type { GoalProgress, GoalProgressState } from "@/lib/goals/types";
import type { CustomerVoiceHealthState } from "@/lib/customer-voice/health";
import type { TrustCertainty } from "@/lib/growth-advisor/trust";
import type { ExpectedBusinessOutcome } from "@/lib/growth-advisor/expectedImpact";
import type { NextWeekMonitorItem } from "@/lib/growth-advisor/nextWeek";

/**
 * Your Growth Advisor — the conversational shape of the authenticated home
 * experience. This is a pure presentation transform over the already-computed
 * HeadOfMarketingBriefing (see buildGrowthAdvisorBriefing.ts) — it introduces
 * no new decision-making, scoring, or recommendation logic of its own.
 * "Growth Advisor" is the customer-facing name; internal architecture
 * (Marketing Director, Head of Marketing modules, Business Brain) keeps its
 * existing names — see docs/project-magic/GROWTH_ADVISOR.md and
 * docs/project-magic/GROWTH_ADVISOR_EXPERIENCE.md.
 */

export type GrowthAdvisorObservation = {
  /** What happened — one short, plain-language clause. */
  headline: string;
  /** Why it matters — a second clause explaining the consequence, never technical. */
  whyItMatters: string;
  /** Trust vocabulary — Observed / Likely / Predicted / Suggested. */
  certainty: TrustCertainty;
  /** Opaque evidence source key for explainability — never chain-of-thought. */
  evidenceSource: string;
};

export type GrowthAdvisorRecommendation = {
  title: string;
  /** Supports Goal — customer goal this recommendation is tied to (strategy layer). */
  supportsGoal: string | null;
  /** Why this recommendation supports the goal — strategy layer, not a new score. */
  whySupportsGoal: string | null;
  /** Why now. */
  whyNow: string;
  /** Expected impact summary (business language). */
  expectedImpact: string;
  /** Business-language outcome chips — never fake numbers. */
  expectedOutcomes: ExpectedBusinessOutcome[];
  /** Estimated effort — reuses the briefing's own already-computed time estimate. */
  estimatedEffort: string;
  /** Why I believe this — customer-safe evidence summary. */
  whyIBelieve: string;
  /** Supporting evidence bullets for progressive disclosure. */
  supportingEvidence: string[];
  /** Business impact label for trust — Low / Medium / High when known. */
  businessImpactLabel: string | null;
  /** Present only when this recommendation came from a real ranked marketing recommendation. */
  confidenceLabel: ConfidenceLabel | null;
  confidenceLabelText: string | null;
  /**
   * Natural Customer Voice context (e.g. "Customers consistently praise…").
   * Presentation only — does not change ranking. Null when evidence is thin.
   */
  customerVoiceContext: string | null;
  /** Trust certainty for the recommendation itself — always Suggested as the action. */
  certainty: TrustCertainty;
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

export type GrowthAdvisorLearningState = {
  /** True when evidence is thin and the advisor should say what it's still learning. */
  isLearning: boolean;
  message: string | null;
  /** Honest suggestions that would improve recommendations — never fabricated insights. */
  improvementSuggestions: string[];
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
  /** 3–5 Business Brain observations when evidence allows. */
  whatINoticed: GrowthAdvisorObservation[];
  /** Progress toward goals + strategic focus (Wave III). */
  goalProgress: GrowthAdvisorGoalProgressSummary;
  recommendation: GrowthAdvisorRecommendation | null;
  /** What the advisor expects to monitor next. */
  nextWeek: NextWeekMonitorItem[];
  /** Empty / thin-evidence learning state. */
  learning: GrowthAdvisorLearningState;
  primaryAction: HeadOfMarketingPrimaryAction;
  /** Set when the primary action itself is "nothing to do" — renders reassurance copy instead of a CTA. */
  primaryActionIsReassurance: boolean;
  emptyStateKind: GrowthAdvisorEmptyStateKind;
  supporting: GrowthAdvisorSupportingContext;
};

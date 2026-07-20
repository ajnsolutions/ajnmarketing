/**
 * Interactive Head of Marketing — presentation/explanation contracts.
 * See docs/INTERACTIVE_HEAD_OF_MARKETING.md.
 *
 * This layer answers questions from existing intelligence. It never creates
 * recommendations, approves, publishes, or mutates Marketing Memory / campaigns.
 */

import type { CampaignDashboardCard } from "@/lib/campaign-intelligence/campaign-types";
import type { DecisionIntelligenceSummary } from "@/lib/decision-intelligence/types";
import type { ExecutiveBrief } from "@/lib/executive-briefing/types";
import type {
  HeadOfMarketingHealth,
  HeadOfMarketingPrimaryAction,
  WeeklyBriefingRecommendation,
} from "@/lib/head-of-marketing/types";
import type { MonthlyFocus } from "@/lib/head-of-marketing/monthlyFocusTypes";
import type {
  MarketingMemoryLearningSummary,
  MarketingMemoryPreferenceEvidence,
  MarketingMemoryContextSignalSummary,
} from "@/lib/marketing-memory/evidenceTypes";

export const InteractiveHomQuestionCategories = {
  WORK_ON_TODAY: "work_on_today",
  WHY_RECOMMENDED: "why_recommended",
  WHAT_CHANGED: "what_changed",
  CAMPAIGN_STATUS: "campaign_status",
  WHAT_LEARNED: "what_learned",
  RISKS: "risks",
  OPPORTUNITIES: "opportunities",
  EXPLAIN_PRIORITY: "explain_priority",
  EXECUTIVE_BRIEF: "executive_brief",
  // Decision Intelligence & Learning Impact (Phase 2F) — all reuse
  // lib/decision-intelligence/service.ts; no trace logic is duplicated here.
  WHY_PLAN_CHANGED: "why_plan_changed",
  EXPERIMENT_IMPACT: "experiment_impact",
  PREFERENCE_IMPACT: "preference_impact",
  IGNORED_EVIDENCE: "ignored_evidence",
  CAMPAIGN_IMPACT: "campaign_impact",
  WHY_DEPRIORITIZED: "why_deprioritized",
  UNSUPPORTED: "unsupported",
} as const;

export type InteractiveHomQuestionCategory =
  (typeof InteractiveHomQuestionCategories)[keyof typeof InteractiveHomQuestionCategories];

export type InteractiveHomSuggestedPrompt = {
  id: string;
  label: string;
  category: InteractiveHomQuestionCategory;
};

export type InteractiveHomGroundedContext = {
  businessName: string;
  health: HeadOfMarketingHealth;
  primaryAction: HeadOfMarketingPrimaryAction;
  recommendation: WeeklyBriefingRecommendation | null;
  thisWeek: string[];
  noticed: string[];
  nextWeek: string[];
  monthlyFocus: MonthlyFocus;
  executiveBrief: ExecutiveBrief;
  campaigns: CampaignDashboardCard[];
  preferences: MarketingMemoryPreferenceEvidence[];
  learnings: MarketingMemoryLearningSummary[];
  marketContextSignals: MarketingMemoryContextSignalSummary[];
  memoryColdStart: boolean;
  pendingApprovals: number;
  openRecommendations: number;
  unansweredReviews: number;
  publishFailures: number;
  /** Decision Intelligence & Learning Impact (Phase 2F) — already computed by
   * lib/decision-intelligence/service.ts; answer handlers only read from this, they
   * never recompute traces/comparisons themselves. Null only on total source failure. */
  decisionIntelligence: DecisionIntelligenceSummary | null;
};

export type InteractiveHomAnswer = {
  category: InteractiveHomQuestionCategory;
  /** Customer-facing answer — no internal scores or engine jargon. */
  answer: string;
  /** True when grounded in at least one concrete signal from context. */
  grounded: boolean;
  /** Short customer-safe evidence labels (never weights/scores). */
  evidenceLabels: string[];
  /** True when we declined to speculate due to missing evidence. */
  insufficientData: boolean;
};

export type InteractiveHomTurn = {
  id: string;
  role: "user" | "assistant";
  content: string;
  category?: InteractiveHomQuestionCategory;
  grounded?: boolean;
  evidenceLabels?: string[];
  insufficientData?: boolean;
};

/** Terms that must never appear in Interactive HoM answers. */
export const INTERACTIVE_HOM_FORBIDDEN_TERMS = [
  "scoring engine",
  "resolver",
  "candidate ranking",
  "confidence algorithm",
  "orchestration layer",
  "adaptive weighting",
  "decision pipeline",
  "Weight ",
  "confidence coefficient",
  "priority_score",
  "I will approve",
  "I'll publish",
  "I will publish",
  "I approved",
  "autonomously",
] as const;

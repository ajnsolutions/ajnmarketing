/**
 * Head of Marketing Orchestrator — composes the already-computed Weekly
 * Growth Plan, Executive Brief, and Opportunity Detection Engine output into
 * one daily Executive Review. This is NOT a new AI or reasoning engine: it
 * introduces no scoring, no new recommendation, and no new evidence — it
 * only reshapes what those systems already decided into one coherent
 * customer-facing review, presented across Today / This Week / This Month.
 * See docs/project-magic/HEAD_OF_MARKETING_ORCHESTRATOR.md.
 */

import type { PlanEvidenceItem } from "@/lib/growth-planner/types";
import type { PlanTrustCertainty } from "@/lib/growth-planner/trust";
import type { ConfidenceLevel } from "@/lib/opportunity-engine/types";

export const ExecutiveReviewCadences = {
  TODAY: "today",
  THIS_WEEK: "this_week",
  THIS_MONTH: "this_month",
} as const;

export type ExecutiveReviewCadence =
  (typeof ExecutiveReviewCadences)[keyof typeof ExecutiveReviewCadences];

export const EXECUTIVE_REVIEW_CADENCE_LABELS: Record<ExecutiveReviewCadence, string> = {
  today: "Today",
  this_week: "This Week",
  this_month: "This Month",
};

/** Every recommendation must link back to real evidence (Part 9) — never a
 * bare claim with nowhere to verify it. */
export type TrustLink = {
  label: string;
  href: string;
};

/** The ONE chosen priority (Part 2). Every field composes an already-real
 * value from the Weekly Growth Plan and/or the Opportunity Detection Engine
 * — nothing here is independently derived or scored. */
export type PrimaryPriority = {
  id: string;
  title: string;
  whyNow: string;
  expectedImpact: string;
  estimatedEffort: string;
  /** Honest framing of what's lost by not acting soon — derived from the
   * same opportunity/plan evidence, never a fabricated deadline. */
  riskOfWaiting: string;
  /** Why this beat the alternatives, when alternatives existed. */
  wonBecause: string;
  confidenceLabel: string | null;
  evidence: PlanEvidenceItem[];
};

/** Up to 3 supporting priorities (Part 3). Anything below the relevance bar
 * simply never appears here — never rendered as a deprioritized item. */
export type SecondaryPriority = {
  id: string;
  title: string;
  whyItMatters: string;
  confidence: ConfidenceLevel;
};

/** What improved / changed / needs attention / can wait (Part 4) — reuses
 * the Executive Brief's own wins/recentChanges/watchItems verbatim, never a
 * second summarization pass over the same evidence. */
export type ExecutiveSummaryView = {
  whatImproved: string[];
  whatChanged: string[];
  whatNeedsAttention: string[];
  whatCanWait: string[];
};

/** Expandable decision explanation (Part 5) — signals, evidence, learning,
 * confidence. Never exposes raw scores, weights, or provider internals. */
export type DecisionExplanation = {
  signalsConsidered: string[];
  evidenceUsed: PlanEvidenceItem[];
  learningApplied: PlanEvidenceItem[];
  confidence: string;
};

export type ActionPlanStep = {
  id: string;
  title: string;
  detail: string;
  href: string | null;
  certainty: PlanTrustCertainty;
};

/** The primary priority converted into action (Part 6) — reuses the Weekly
 * Growth Plan's own supporting actions and success metric verbatim. */
export type ActionPlan = {
  steps: ActionPlanStep[];
  successMetric: string;
  whatIllWatch: string[];
};

export type ExecutiveReview = {
  generatedAt: string;
  businessName: string;
  cadence: ExecutiveReviewCadence;
  headline: string;
  summary: string;
  primaryPriority: PrimaryPriority;
  secondaryPriorities: SecondaryPriority[];
  executiveSummary: ExecutiveSummaryView;
  decisionExplanation: DecisionExplanation;
  actionPlan: ActionPlan;
  trustLinks: TrustLink[];
};

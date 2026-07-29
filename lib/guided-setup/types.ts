/**
 * Guided Business Setup & First Wins — domain model.
 *
 * Milestone-based onboarding (no percentage bars). Uses Business Connections
 * readiness and existing customer-setup facts. One highest-value next step.
 *
 * See docs/project-magic/GUIDED_SETUP.md.
 */

import type { SetupStepKey } from "@/lib/customer-setup/types";
import type { ConnectionCategoryId } from "@/lib/business-connections/types";

export const GuidedMilestoneKeys = {
  KNOW_BUSINESS: "know_business",
  KNOW_SUCCESS: "know_success",
  WEBSITE_UNDERSTANDING: "website_understanding",
  CUSTOMER_FEEDBACK: "customer_feedback",
  ADVISOR_READY: "advisor_ready",
} as const;

export type GuidedMilestoneKey =
  (typeof GuidedMilestoneKeys)[keyof typeof GuidedMilestoneKeys];

export const MilestoneStates = {
  COMPLETE: "complete",
  CURRENT: "current",
  UPCOMING: "upcoming",
  OPTIONAL_WAITING: "optional_waiting",
} as const;

export type MilestoneState = (typeof MilestoneStates)[keyof typeof MilestoneStates];

export const KnowledgeStates = {
  KNOWN: "known",
  LEARNING: "learning",
  WAITING: "waiting",
} as const;

export type KnowledgeState = (typeof KnowledgeStates)[keyof typeof KnowledgeStates];

export const KNOWLEDGE_STATE_LABELS: Record<KnowledgeState, string> = {
  known: "Known",
  learning: "Learning",
  waiting: "Waiting for more information",
};

export type GuidedMilestone = {
  key: GuidedMilestoneKey;
  title: string;
  /** What is already known / what this unlocks when complete. */
  knownSummary: string;
  /** How completing this improves the Business Brain. */
  brainImprovement: string;
  state: MilestoneState;
  relatedSetupStepKeys: SetupStepKey[];
  relatedConnectionCategories: ConnectionCategoryId[];
};

export type FirstWin = {
  id: string;
  milestoneKey: GuidedMilestoneKey;
  title: string;
  detail: string;
  /** Value category — never fabricated metrics. */
  valueKind:
    | "recommendation"
    | "marketing_plan"
    | "customer_voice"
    | "seo_insight"
    | "advisor_ready";
};

export type GuidedEmptyState = {
  id: string;
  whatMissing: string;
  whyItMatters: string;
  whatImproves: string;
};

export type GuidedNextStep = {
  title: string;
  why: string;
  brainImprovement: string;
  href: string;
  actionLabel: string;
  source: "setup" | "connection" | "none";
  setupStepKey: SetupStepKey | null;
  connectionId: string | null;
};

export type KnowledgeSignal = {
  id: string;
  label: string;
  state: KnowledgeState;
  detail: string;
};

export type GuidedSetupExperience = {
  generatedAt: string;
  businessName: string;
  milestones: GuidedMilestone[];
  /** Completed milestones that unlocked visible value. */
  firstWins: FirstWin[];
  /** Most recent first win to celebrate — null when none yet. */
  latestFirstWin: FirstWin | null;
  recommendedNext: GuidedNextStep | null;
  emptyStates: GuidedEmptyState[];
  knowledgeSignals: KnowledgeSignal[];
  /** True when required foundation is enough for Growth Advisor. */
  advisorReady: boolean;
  /** Calm headline for the guided page. */
  headline: string;
  lead: string;
};

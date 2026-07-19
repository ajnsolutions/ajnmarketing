/**
 * Marketing Director Intelligence — shared decision contract. See
 * docs/MARKETING_DIRECTOR_FOUNDATION.md and docs/MARKETING_DIRECTOR_ARCHITECTURE.md.
 *
 * This module defines the single decision both buildPrimaryAction (weeklyBriefing.ts)
 * and the proactive presence's primary moment (proactive.ts) now consume — neither
 * independently decides "what matters most" anymore. Nothing here re-scores a
 * recommendation, calls OpenAI, or writes to the database; every field is composed from
 * outputs the existing engines (marketing-decisions, recommendation-learning,
 * recommendation-presentation) already produced.
 */

import type { CommandCenterWeeklyWins } from "@/lib/command-center/types";
import type { MarketingHealthState, HeadOfMarketingPrimaryActionKind } from "@/lib/head-of-marketing/types";
import type { RecommendationStatus, RecommendationUrgency } from "@/lib/marketing-decisions/types";
import type { MarketingMemoryEvidencePackage } from "@/lib/marketing-memory/evidenceTypes";
import type { ConfidenceLabel } from "@/lib/recommendation-presentation/types";

export const MarketingDirectorDecisionTypes = {
  /** A foundational decision the customer needs to make (e.g. connect Google). */
  MEANINGFUL_DECISION: "meaningful_decision",
  /** Content or a reply is already prepared and waiting on the customer's opinion. */
  APPROVAL_NEEDED: "approval_needed",
  /** An open, ranked recommendation is worth surfacing on its own. */
  HIGH_VALUE_RECOMMENDATION: "high_value_recommendation",
  /** Worth mentioning, not worth an ask — a calm heads-up. */
  OPPORTUNITY: "opportunity",
  /** Nothing needs attention; a calm, honest "you're covered" moment. */
  REASSURANCE: "reassurance",
  /** A concrete win worth acknowledging, without gamification. */
  CELEBRATION: "celebration",
} as const;

export type MarketingDirectorDecisionType =
  (typeof MarketingDirectorDecisionTypes)[keyof typeof MarketingDirectorDecisionTypes];

/**
 * Internal-only reason a candidate is not this cycle's primary. Never rendered to the
 * customer verbatim in this phase — retained on the decision for explainability and
 * future disclosure, per the architecture review's "intentional deferral" design.
 */
export const DeferralReasons = {
  LOWER_PRIORITY: "lower_priority",
  NOT_TIME_SENSITIVE: "not_time_sensitive",
  BLOCKED_BY_PREREQUISITE: "blocked_by_prerequisite",
  /** Explicit customer prohibition (e.g. prohibit_action preference) — internal only. */
  CUSTOMER_PROHIBITION: "customer_prohibition",
  ALREADY_HANDLED: "already_handled",
  AWAITING_OUTCOME_DATA: "awaiting_outcome_data",
  OUTSIDE_MONTHLY_FOCUS: "outside_monthly_focus",
  CUSTOMER_ATTENTION_NOT_REQUIRED: "customer_attention_not_required",
  DUPLICATE_OR_OVERLAPPING: "duplicate_or_overlapping",
} as const;

export type DeferralReason = (typeof DeferralReasons)[keyof typeof DeferralReasons];

export type MarketingDirectorDeferredAlternative = {
  /** The recommendation id (or other source id) this entry refers to. */
  sourceId: string;
  /** Short internal label, e.g. the formatted recommendation action type. */
  title: string;
  reason: DeferralReason;
};

export type MarketingDirectorPrimaryAction = {
  kind: HeadOfMarketingPrimaryActionKind;
  label: string;
  href: string;
};

/**
 * One already-scored, already-adaptive-adjusted candidate from
 * marketing-decisions/persistence.ts's getActiveMarketingRecommendationsForUser —
 * never rescored here. Ordering (highest priority first) is the caller's
 * responsibility; this module trusts index 0 as the top-ranked candidate.
 */
export type MarketingDirectorCandidate = {
  id: string;
  /** Customer-safe label from marketing-decisions/ui.ts's formatRecommendedActionType. */
  actionTypeLabel: string;
  /**
   * Raw recommended_action_type for Marketing Memory matching only — never rescored here.
   * Optional for back-compat with callers that have not yet threaded the raw type.
   */
  actionType?: string;
  status: RecommendationStatus;
  urgency: RecommendationUrgency;
};

/**
 * Internal structured memory context attached to a decision. Never exposed via
 * toMarketingDirectorClientView — diagnostics / future progressive disclosure only.
 */
export type MarketingDirectorMemoryContext = {
  preferencesApplied: string[];
  learningsConsidered: string[];
  contextConsidered: string[];
  ignoredLearnings: { id: string; reason: string }[];
  ignoredPreferences: { id: string; reason: string }[];
  precedenceExplanation: string;
  confidenceExplanation: string;
};

/**
 * Recommendation-presentation's existing explainability package
 * (lib/recommendation-presentation/service.ts), reused verbatim for the top candidate
 * only — never recomputed here. Optional: absent when there is no eligible top
 * candidate, or when the caller chooses not to pay for the extra fetch.
 */
export type MarketingDirectorTopRecommendationDetail = {
  recommendationId: string;
  title: string;
  whyNow: string;
  expectedBenefit: string;
  confidenceLabel: ConfidenceLabel;
};

export type MarketingDirectorInput = {
  gbpConnected: boolean;
  pendingApprovals: number;
  unansweredReviews: number;
  openRecommendations: number;
  publishingReadyOrScheduled: number;
  healthState: MarketingHealthState;
  weeklyWins: CommandCenterWeeklyWins;
  seasonalHint: string | null;
  /** Plain-language current Monthly Focus theme (e.g. "improving local visibility"),
   * reused verbatim in reassurance/opportunity copy — never a new planning concept. */
  focusTheme: string;
  isEarlyCustomer: boolean;
  /**
   * Full ranked, active set for this business, highest priority first (already sorted
   * upstream by marketing-decisions + recommendation-learning). Index 0 is the
   * candidate considered for high_value_recommendation; the remainder become deferred
   * alternatives whenever this cycle's decision does not require picking among them.
   */
  candidateRecommendations: MarketingDirectorCandidate[];
  /** Explainability for candidateRecommendations[0], when already fetched by the
   * caller. Never fetched or recomputed inside this module. */
  topRecommendationDetail: MarketingDirectorTopRecommendationDetail | null;
  /**
   * Optional Marketing Memory evidence package (Phase 4). Null / cold-start must leave
   * decision selection identical to pre-memory behavior (aside from memoryContext).
   * Never fetched inside this module — see lib/marketing-memory/evidencePackage.ts.
   */
  memoryEvidence?: MarketingMemoryEvidencePackage | null;
};

/**
 * The single shared decision. Server-side only — buildPrimaryAction and the proactive
 * presence's primary moment each read a narrow subset of this (primaryAction; title +
 * summary) and must not branch on raw signals independently. Fields beyond that narrow
 * subset (rationale, supportingSignals, deferred, presentationPriority,
 * sourceRecommendationId) are internal/diagnostic only and are not attached to the
 * customer-facing HeadOfMarketingBriefing type.
 */
export type MarketingDirectorDecision = {
  decisionType: MarketingDirectorDecisionType;
  /** Short customer-safe label, e.g. "Needs your opinion" */
  title: string;
  /** One calm, Head-of-Marketing-voice sentence — the actual customer-facing message. */
  summary: string;
  /** Internal — why this was selected. Not shown to the customer verbatim. */
  rationale: string;
  /** Plain-language outcome this decision is meant to improve. */
  targetOutcome: string;
  confidenceLabel: ConfidenceLabel;
  requiresCustomerAction: boolean;
  primaryAction: MarketingDirectorPrimaryAction;
  deferred: MarketingDirectorDeferredAlternative[];
  /** Internal diagnostic signal names used to reach this decision — never customer copy. */
  supportingSignals: string[];
  sourceRecommendationId: string | null;
  /** Internal-only relative ranking value for logging/tie-break context — never rendered. */
  presentationPriority: number;
  /** ISO timestamp of when this decision was computed. */
  evaluatedAt: string;
  /**
   * Internal memory consultation record. Null only when the composer short-circuits
   * before memory composition; normally always present (including "no evidence" empty).
   * Never copied into MarketingDirectorClientView.
   */
  memoryContext: MarketingDirectorMemoryContext | null;
};

/**
 * Client-safe presentation subset — the only shape a future client component should
 * ever receive if this briefing is ever rendered from a Client Component. Today,
 * HeadOfMarketingPage is a Server Component and renders the full briefing server-side,
 * so this type is not yet wired anywhere; it exists so that boundary is easy to enforce
 * later without redesigning the decision contract. See docs/MARKETING_DIRECTOR_FOUNDATION.md.
 */
export type MarketingDirectorClientView = {
  decisionType: MarketingDirectorDecisionType;
  title: string;
  summary: string;
  confidenceLabel: ConfidenceLabel;
  requiresCustomerAction: boolean;
  primaryAction: MarketingDirectorPrimaryAction;
};

export function toMarketingDirectorClientView(
  decision: MarketingDirectorDecision,
): MarketingDirectorClientView {
  return {
    decisionType: decision.decisionType,
    title: decision.title,
    summary: decision.summary,
    confidenceLabel: decision.confidenceLabel,
    requiresCustomerAction: decision.requiresCustomerAction,
    primaryAction: decision.primaryAction,
  };
}

/** Never use these in customer-facing decision copy. */
export const MARKETING_DIRECTOR_FORBIDDEN_TERMS = [
  "scoring engine",
  "resolver",
  "candidate ranking",
  "confidence algorithm",
  "orchestration layer",
  "adaptive weighting",
  "decision pipeline",
  "Weight ",
  "confidence coefficient",
  "URGENT",
  "CRITICAL",
  "WARNING",
  "Action required",
  "Immediately",
] as const;

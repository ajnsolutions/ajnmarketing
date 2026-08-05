/**
 * Executive Briefing Engine — structured briefing contracts.
 * See docs/EXECUTIVE_BRIEFING_ENGINE.md.
 *
 * Pure data only: no markdown, no HTML. Summarization only — never creates
 * recommendations. Marketing Director remains the sole decision-maker.
 */

import type { CompetitorObservationConfidence } from "@/lib/competitor-observations/types";

export const ExecutiveBriefTypes = {
  MORNING: "morning_brief",
  WEEKLY_STRATEGY: "weekly_strategy_brief",
  MONTHLY_EXECUTIVE: "monthly_executive_report",
} as const;

export type ExecutiveBriefType =
  (typeof ExecutiveBriefTypes)[keyof typeof ExecutiveBriefTypes];

export const ExecutiveEvidenceKinds = {
  ACTIVE_PREFERENCE: "active_preference",
  HISTORICAL_LEARNING: "historical_learning",
  MARKET_CONTEXT: "market_context",
  PENDING_RECOMMENDATION: "pending_recommendation",
  ANALYTICS_TREND: "analytics_trend",
  REVIEW_TREND: "review_trend",
  PENDING_APPROVAL: "pending_approval",
  PUBLISHING_SCHEDULE: "publishing_schedule",
  MARKETING_DIRECTOR_DECISION: "marketing_director_decision",
  HEALTH_SIGNAL: "health_signal",
} as const;

export type ExecutiveEvidenceKind =
  (typeof ExecutiveEvidenceKinds)[keyof typeof ExecutiveEvidenceKinds];

/** Internal supporting evidence — never exposes raw scores or coefficients. */
export type ExecutiveSupportingEvidence = {
  kind: ExecutiveEvidenceKind;
  label: string;
  detail: string;
};

export type ExecutiveBriefItem = {
  text: string;
};

/**
 * A single Market Radar observation surfaced on the weekly brief only (see
 * buildMarketRadarHighlights in buildBrief.ts). Richer than ExecutiveBriefItem
 * because a competitor observation needs "why it matters" and "suggested
 * action" alongside the observation itself — deliberately not retrofitted
 * onto the flat { text } shape used everywhere else in this brief.
 */
export type ExecutiveMarketRadarHighlight = {
  observation: string;
  whyItMatters: string;
  suggestedAction: string;
  confidence: CompetitorObservationConfidence;
};

export type ExecutiveBrief = {
  briefType: ExecutiveBriefType;
  headline: string;
  summary: string;
  topPriorities: ExecutiveBriefItem[];
  wins: ExecutiveBriefItem[];
  watchItems: ExecutiveBriefItem[];
  today: ExecutiveBriefItem[];
  recentChanges: ExecutiveBriefItem[];
  supportingEvidence: ExecutiveSupportingEvidence[];
  /** Weekly-brief-only; always [] on the morning brief and monthly report. */
  marketRadarHighlights: ExecutiveMarketRadarHighlight[];
  generatedAt: string;
};

/** Delivery hooks for future channels — not implemented in this phase. */
export type ExecutiveBriefDeliveryChannel =
  | "in_app"
  | "email"
  | "mobile_push"
  | "slack"
  | "teams";

export type ExecutiveBriefDeliveryHook = {
  channel: ExecutiveBriefDeliveryChannel;
  /** Reserved for future adapters; always false until a channel ships. */
  implemented: boolean;
};

export const EXECUTIVE_BRIEF_FUTURE_DELIVERY_HOOKS: ExecutiveBriefDeliveryHook[] = [
  { channel: "in_app", implemented: true },
  { channel: "email", implemented: false },
  { channel: "mobile_push", implemented: false },
  { channel: "slack", implemented: false },
  { channel: "teams", implemented: false },
];

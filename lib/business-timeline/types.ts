/**
 * Business Timeline (Part 8) — a customer-friendly chronological view across
 * recommendations, campaigns, uploads, search milestones, Customer Voice
 * milestones, and learning milestones. A pure composition over
 * already-fetched Business Brain packages — no new persisted event log.
 * Complements, rather than duplicates, Decision Intelligence's internal
 * DecisionTimelineEvent feed and the Head of Marketing Journal's curated
 * ≤5-entry narrative — see docs/project-magic/BUSINESS_LEARNING_ENGINE.md.
 */

export const BusinessTimelineEntryTypes = {
  RECOMMENDATION: "recommendation",
  CAMPAIGN: "campaign",
  UPLOAD: "upload",
  SEARCH_MILESTONE: "search_milestone",
  CUSTOMER_VOICE_MILESTONE: "customer_voice_milestone",
  LEARNING_MILESTONE: "learning_milestone",
  OPPORTUNITY_DETECTED: "opportunity_detected",
  OPPORTUNITY_COMPLETED: "opportunity_completed",
  OPPORTUNITY_EXPIRED: "opportunity_expired",
  OPPORTUNITY_LEARNED_FROM: "opportunity_learned_from",
} as const;

export type BusinessTimelineEntryType =
  (typeof BusinessTimelineEntryTypes)[keyof typeof BusinessTimelineEntryTypes];

export type BusinessTimelineEntry = {
  id: string;
  type: BusinessTimelineEntryType;
  occurredAt: string;
  /** "What changed?" — plain-language, customer-safe. */
  whatChanged: string;
  /** "What did the AI learn?" — null when this specific event didn't itself
   * teach the Business Brain anything new (e.g. a routine approval). Never
   * fabricated just to fill the field. */
  whatDidAILearn: string | null;
};

/**
 * Opportunity Detection Engine — turns already-computed Business Brain
 * packages (Business Discovery, Goals, Customer Voice, Website Testimonials,
 * Search Console / External Intelligence, Smart Uploads, the Business
 * Knowledge Graph, the Business Learning Engine) into a prioritized list of
 * concrete, explainable marketing opportunities.
 *
 * This is a composition layer, not a second reasoning engine: every
 * opportunity traces back to real evidence a provider adapter emitted (Part
 * 2), is scored from that evidence (Part 3), and is persisted only so its
 * lifecycle (detected → active → completed/expired) can be tracked across
 * requests (Part 4) — never a private duplicate of what the Business Brain
 * already knows. See docs/project-magic/OPPORTUNITY_DETECTION_ENGINE.md.
 */

export const OpportunityTypes = {
  SEASONAL: "seasonal",
  TRENDING_SEARCH: "trending_search",
  REPUTATION: "reputation",
  CONTENT_GAP: "content_gap",
  WEBSITE_IMPROVEMENT: "website_improvement",
  LOCAL_EVENT: "local_event",
  COMPETITIVE_POSITIONING: "competitive_positioning",
  CUSTOMER_EDUCATION: "customer_education",
  FAQ: "faq",
  SERVICE_SPOTLIGHT: "service_spotlight",
  REVIEW_REQUEST: "review_request",
  UNDERPERFORMING_CONTENT_REFRESH: "underperforming_content_refresh",
  HIGH_PERFORMING_CONTENT_EXPANSION: "high_performing_content_expansion",
} as const;

export type OpportunityType = (typeof OpportunityTypes)[keyof typeof OpportunityTypes];

export const OPPORTUNITY_TYPE_LABELS: Record<OpportunityType, string> = {
  seasonal: "Seasonal opportunity",
  trending_search: "Trending search opportunity",
  reputation: "Reputation opportunity",
  content_gap: "Content gap",
  website_improvement: "Website improvement",
  local_event: "Local event opportunity",
  competitive_positioning: "Competitive positioning",
  customer_education: "Customer education",
  faq: "FAQ opportunity",
  service_spotlight: "Service spotlight",
  review_request: "Review request opportunity",
  underperforming_content_refresh: "Underperforming content refresh",
  high_performing_content_expansion: "High-performing content expansion",
};

export const ConfidenceLevels = { LOW: "low", MEDIUM: "medium", HIGH: "high" } as const;
export type ConfidenceLevel = (typeof ConfidenceLevels)[keyof typeof ConfidenceLevels];

export const ImpactLevels = { LOW: "low", MEDIUM: "medium", HIGH: "high" } as const;
export type ImpactLevel = (typeof ImpactLevels)[keyof typeof ImpactLevels];

export const UrgencyLevels = { LOW: "low", MEDIUM: "medium", HIGH: "high" } as const;
export type UrgencyLevel = (typeof UrgencyLevels)[keyof typeof UrgencyLevels];

export const OpportunityStatuses = {
  ACTIVE: "active",
  COMPLETED: "completed",
  EXPIRED: "expired",
} as const;
export type OpportunityStatus = (typeof OpportunityStatuses)[keyof typeof OpportunityStatuses];

/** One piece of evidence backing an opportunity — always traceable to a
 * real, opaque provider id. Never a raw provider payload. */
export type OpportunityEvidence = {
  id: string;
  sourceProviderId: string;
  sourceLabel: string;
  summary: string;
  occurredAt: string | null;
};

/**
 * One normalized candidate a provider adapter emits — the common contract
 * every adapter produces. The engine (detect/score/dedupe/reconcile) only
 * ever operates on this shape, never a provider-specific payload, which is
 * what lets a future provider (Part 9) contribute automatically by adding
 * one adapter, with zero branching anywhere else.
 */
export type OpportunityCandidateInput = {
  sourceProviderId: string;
  sourceLabel: string;
  type: OpportunityType;
  /** Free-text topic used for merge/dedup by overlap, not exact match — the
   * same technique the Business Knowledge Graph uses (topicMatch.ts). */
  topic: string;
  /** Customer-safe statement of the opportunity itself. */
  statement: string;
  /** Why this is worth acting on now. */
  whyNow: string;
  /** What acting on it is expected to achieve. */
  expectedOutcome: string;
  confidence: ConfidenceLevel;
  businessImpact: ImpactLevel;
  urgency: UrgencyLevel;
  evidenceSummary: string;
  occurredAt: string | null;
  /** Maps to a lib/marketing-decisions RecommendedActionType when this
   * opportunity's underlying action has one — lets scoring reuse the
   * Business Learning Engine's real historical success for that action,
   * and lets the engine detect when an opportunity has been acted on. */
  relatedActionType?: string | null;
};

export type OpportunityScore = {
  /** 0-100, evidence-strength-weighted — see score.ts. */
  total: number;
  evidenceStrength: number;
  businessImpact: number;
  urgency: number;
  confidence: number;
  historicalSuccess: number;
};

/** One row of public.detected_opportunities, as read from the database —
 * the canonical, persisted opportunity every downstream consumer (Growth
 * Advisor, Weekly Growth Plan, Business Timeline, Marketing Health) reads. */
export type DetectedOpportunity = {
  id: string;
  type: OpportunityType;
  topic: string;
  statement: string;
  whyNow: string;
  expectedOutcome: string;
  evidence: OpportunityEvidence[];
  contributingProviders: string[];
  confidence: ConfidenceLevel;
  score: OpportunityScore;
  status: OpportunityStatus;
  relatedActionType: string | null;
  firstDetectedAt: string;
  lastSeenAt: string;
  retiredAt: string | null;
  /** Set only when status is completed or expired. */
  retiredReason: "completed" | "expired" | null;
};

/** Every distinct sourceProviderId represented in an opportunity's evidence. */
export function contributingProvidersFromEvidence(evidence: OpportunityEvidence[]): string[] {
  return [...new Set(evidence.map((e) => e.sourceProviderId))];
}

/**
 * Snapshot continuation contract — the secure bridge between the anonymous
 * Free Marketing Snapshot (PR #74) and authenticated Guided Onboarding.
 *
 * Lifecycle this module implements (see
 * docs/BUSINESS_DISCOVERY_CONTINUATION.md for the full picture):
 *
 *   Generated -> Available for anonymous presentation -> Referenced during
 *   signup -> Claimed by authenticated user -> Insights reviewed ->
 *   Confirmed/corrected facts handed to the business profile -> Reference
 *   expired or invalidated
 *
 * Every type here is pure data. All I/O lives in service.ts (server-only).
 */

import type { DiscoveryConfidenceTier, DiscoverySourceType } from "@/lib/business-discovery/types";
import type { PublicBusinessDiscoveryResultV1 } from "@/lib/business-discovery/public/types";

// ---------------------------------------------------------------------------
// Insight keys — safe, stable identifiers (never array position, never
// user-editable text). These are exactly the 8 keys the public contract's
// confidence recompute already treats as "the public-relevant fields" (see
// lib/business-discovery/public/mapPublicResult.ts) plus the two dropped
// fields intentionally excluded — confirmation is only ever offered for a
// field the visitor actually saw.
// ---------------------------------------------------------------------------

export const InsightKeys = {
  BUSINESS_SUMMARY: "businessSummary",
  PRIMARY_SERVICES: "primaryServices",
  LIKELY_TARGET_CUSTOMERS: "likelyTargetCustomers",
  BRAND_PERSONALITY: "brandPersonality",
  VISIBLE_STRENGTHS: "visibleStrengths",
  ONLINE_PRESENCE_WEBSITE: "onlinePresence.website",
  ONLINE_PRESENCE_GOOGLE_BUSINESS_PROFILE: "onlinePresence.googleBusinessProfile",
  POSSIBLE_GROWTH_OPPORTUNITIES: "possibleGrowthOpportunities",
} as const;

export type InsightKey = (typeof InsightKeys)[keyof typeof InsightKeys];

export const INSIGHT_KEY_ALLOWLIST: ReadonlySet<InsightKey> = new Set(Object.values(InsightKeys));

// ---------------------------------------------------------------------------
// Decisions
// ---------------------------------------------------------------------------

export const InsightDecisionTypes = {
  CONFIRM: "confirm",
  CORRECT: "correct",
  REJECT: "reject",
  REVIEW_LATER: "review_later",
} as const;

export type InsightDecisionType = (typeof InsightDecisionTypes)[keyof typeof InsightDecisionTypes];

/**
 * What the future UI submits for one insight. Deliberately minimal and
 * never includes the "original" value, source, or confidence — the server
 * always derives provenance itself from the resolved, claimed snapshot, so a
 * client can never tamper with what "the original discovery" was claimed to
 * be (see applyConfirmations.ts).
 */
export type ConfirmationDecisionInput = {
  insightKey: InsightKey;
  decision: InsightDecisionType;
  /** Required and used only when decision === "correct". */
  correctedValue?: unknown;
  /** Optional plain-language note — e.g. why a correction was made. */
  note?: string;
};

/**
 * The resulting status of an insight after a decision is applied — the
 * durable, semantic difference between "AI interpretation," "user-confirmed
 * fact," and "rejected inference" this milestone requires preserving.
 */
export const ResultingFactStatuses = {
  KNOWN_FACT: "known_fact",
  REJECTED: "rejected",
  UNRESOLVED: "unresolved",
} as const;

export type ResultingFactStatus = (typeof ResultingFactStatuses)[keyof typeof ResultingFactStatuses];

/**
 * The durable record of one applied decision — server-computed provenance
 * (never client-supplied), the decision, the resulting value/status, and
 * authenticated attribution.
 */
export type ConfirmationRecord = {
  insightKey: InsightKey;
  decision: InsightDecisionType;
  /** Derived server-side from the resolved snapshot at decision time. */
  originalValue: unknown;
  originalSources: DiscoverySourceType[];
  originalConfidenceTier: DiscoveryConfidenceTier;
  /** confirm -> originalValue; correct -> correctedValue; reject/review_later -> null. */
  resultingValue: unknown;
  resultingFactStatus: ResultingFactStatus;
  note: string | null;
  decidedByUserId: string;
  decidedAt: string;
};

export type SubmitConfirmationsRequest = {
  snapshotReference: string;
  decisions: ConfirmationDecisionInput[];
};

// ---------------------------------------------------------------------------
// Resolution / claim / confirm results — discriminated unions so callers can
// return a specific, honest status without relying on thrown exceptions for
// expected outcomes (invalid/expired/not-found/conflict are all expected,
// routine outcomes, not failures).
// ---------------------------------------------------------------------------

export type SnapshotResolutionResult =
  | { status: "resolved"; snapshot: PublicBusinessDiscoveryResultV1 }
  | { status: "invalid" }
  | { status: "not_found" }
  | { status: "expired" };

export type SnapshotClaimResult =
  | { status: "claimed"; claimedAt: string }
  | { status: "already_claimed_by_you"; claimedAt: string }
  | { status: "claimed_by_another_user" }
  | { status: "invalid" }
  | { status: "not_found" }
  | { status: "expired" };

export type SubmitConfirmationsResult =
  | { status: "applied"; records: ConfirmationRecord[] }
  | { status: "not_claimed" }
  | { status: "claimed_by_another_user" }
  | { status: "invalid" }
  | { status: "not_found" }
  | { status: "expired" }
  | { status: "invalid_decisions"; errors: string[] };

// ---------------------------------------------------------------------------
// Onboarding prefill — what page.tsx/OnboardingWizard consume. Deliberately
// narrow: only fields the wizard already asks about today. Never includes
// per-insight review UI data (source/confidence/reason) — that stays in the
// resolved snapshot itself, for the future dedicated review screen.
// ---------------------------------------------------------------------------

export type OnboardingSnapshotPrefill = {
  businessName: string | null;
  websiteUrl: string | null;
  city: string | null;
  state: string | null;
};

// ---------------------------------------------------------------------------
// Structured error contract for the continuation API routes
// ---------------------------------------------------------------------------

export const ContinuationErrorCodes = {
  UNAUTHENTICATED: "unauthenticated",
  VALIDATION_FAILED: "validation_failed",
  NOT_FOUND: "not_found",
  EXPIRED: "expired",
  CONFLICT: "conflict",
  NOT_CLAIMED: "not_claimed",
  INTERNAL_ERROR: "internal_error",
} as const;

export type ContinuationErrorCode = (typeof ContinuationErrorCodes)[keyof typeof ContinuationErrorCodes];

export type ContinuationErrorResponse = {
  error: {
    code: ContinuationErrorCode;
    message: string;
  };
};

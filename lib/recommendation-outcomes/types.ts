/**
 * Normalized outcome model for recommendation-generated content. See
 * docs/RECOMMENDATION_OUTCOME_FEEDBACK_LOOP.md for the full design rationale.
 */

export const RecommendationOutcomeEventTypes = {
  DRAFT_CREATED: "draft_created",
  DRAFT_EDITED: "draft_edited",
  DRAFT_APPROVED: "draft_approved",
  DRAFT_REJECTED: "draft_rejected",
  PUBLISHING_QUEUED: "publishing_queued",
  PUBLISHING_SUCCEEDED: "publishing_succeeded",
  PUBLISHING_FAILED: "publishing_failed",
  PERFORMANCE_MEASURED: "performance_measured",
  /** Durable positive-feedback signal ("do more like this"), distinct from
   * draft_approved -- a client can approve a draft without wanting more like it, and
   * vice versa. See docs/CLIENT_RECOMMENDATION_EXPERIENCE.md. */
  DO_MORE_LIKE_THIS: "do_more_like_this",
} as const;

export type RecommendationOutcomeEventType =
  (typeof RecommendationOutcomeEventTypes)[keyof typeof RecommendationOutcomeEventTypes];

/** One row of public.recommendation_outcome_events. */
export type RecommendationOutcomeEvent = {
  id: string;
  user_id: string;
  business_profile_id: string;
  recommendation_id: string;
  content_approval_id: string | null;
  publishing_job_id: string | null;
  event_type: RecommendationOutcomeEventType;
  event_version: number;
  source: string;
  idempotency_key: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export const RejectionReasonCodes = {
  TOO_PROMOTIONAL: "too_promotional",
  WRONG_TONE: "wrong_tone",
  INCORRECT_INFORMATION: "incorrect_information",
  OFF_BRAND_TOPIC: "off_brand_topic",
  POOR_TIMING: "poor_timing",
  DUPLICATE_CONTENT: "duplicate_content",
  OTHER: "other",
} as const;

export type RejectionReasonCode =
  (typeof RejectionReasonCodes)[keyof typeof RejectionReasonCodes];

export const REJECTION_REASON_CODES: RejectionReasonCode[] = Object.values(RejectionReasonCodes);

export function isRejectionReasonCode(value: unknown): value is RejectionReasonCode {
  return typeof value === "string" && (REJECTION_REASON_CODES as string[]).includes(value);
}

/**
 * Normalized publishing failure category. Derived from the already-sanitized message a
 * publishing attempt produces (see lib/security/safe-error-message.ts) -- never from a
 * raw provider payload or OAuth token. "provider_error" is the fallback for a real,
 * final failure whose cause doesn't match a more specific category.
 */
export const PublishingFailureCategories = {
  OAUTH_ERROR: "oauth_error",
  PROVIDER_REJECTED: "provider_rejected",
  TIMEOUT: "timeout",
  NOT_SUPPORTED: "not_supported",
  PROVIDER_ERROR: "provider_error",
} as const;

export type PublishingFailureCategory =
  (typeof PublishingFailureCategories)[keyof typeof PublishingFailureCategories];

/**
 * Explicit lifecycle states, deterministically derived from the authoritative tables
 * (content_approvals, publishing_jobs, content_performance) -- never stored directly.
 * "draft_created" is deliberately not used as a resting summary state even though it is
 * captured as an event: a freshly created, unreviewed draft is indistinguishable in
 * content_approvals.status from one that's been sitting for a week (both "pending"), so
 * both summarize as "awaiting_review". See docs/RECOMMENDATION_OUTCOME_FEEDBACK_LOOP.md.
 */
export const RecommendationLifecycleStatuses = {
  RECOMMENDED: "recommended",
  AWAITING_REVIEW: "awaiting_review",
  APPROVED: "approved",
  REJECTED: "rejected",
  PUBLISHING_QUEUED: "publishing_queued",
  PUBLISHING: "publishing",
  PUBLISHED: "published",
  PUBLISH_FAILED: "publish_failed",
  MEASURED: "measured",
} as const;

export type RecommendationLifecycleStatus =
  (typeof RecommendationLifecycleStatuses)[keyof typeof RecommendationLifecycleStatuses];

/**
 * Deterministic, non-ML usefulness signal. Rules (see summarizeRecommendationOutcome):
 *  - rejected                                  -> negative
 *  - approved + published (+ measured)         -> positive
 *  - approved, not yet published                -> neutral
 *  - publish_failed (any final failure)          -> neutral (never punishes the
 *    recommendation for a provider/delivery problem, per explicit product rule)
 *  - draft created but not yet reviewed          -> unknown
 *  - recommendation has no draft yet             -> unknown
 */
export const UsefulnessSignals = {
  POSITIVE: "positive",
  NEUTRAL: "neutral",
  NEGATIVE: "negative",
  UNKNOWN: "unknown",
} as const;

export type UsefulnessSignal = (typeof UsefulnessSignals)[keyof typeof UsefulnessSignals];

export type RecommendationOutcomePerformanceMetrics = {
  views: number;
  clicks: number;
  engagement: number;
  conversions: number;
  performanceScore: number;
};

export type RecommendationOutcomeSummary = {
  recommendationId: string;
  contentApprovalId: string | null;
  lifecycleStatus: RecommendationLifecycleStatus;
  draftCreatedAt: string | null;
  wasEdited: boolean;
  editCount: number;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  rejectionReasonCode: RejectionReasonCode | null;
  publishingJobId: string | null;
  publishingStatus: string | null;
  publishedAt: string | null;
  publishingFailureCategory: PublishingFailureCategory | null;
  performanceStatus: "measured" | "unavailable" | "not_applicable";
  measuredAt: string | null;
  performanceMetrics: RecommendationOutcomePerformanceMetrics | null;
  usefulnessSignal: UsefulnessSignal;
  lastEventAt: string | null;
};

export type RecommendationOutcomeFilter = {
  actionType?: string;
  category?: string;
  channel?: string;
  usefulnessSignal?: UsefulnessSignal;
  since?: string;
  until?: string;
};

export type RecommendationOutcomeStats = {
  totalGenerated: number;
  approvalRate: number | null;
  rejectionRate: number | null;
  editRate: number | null;
  publishSuccessRate: number | null;
  outcomeCountsByActionType: Record<string, number>;
  rejectionReasonCounts: Record<string, number>;
};

export type ReconciliationCounts = {
  recommendationsScanned: number;
  eventsInserted: number;
  eventsSkippedExisting: number;
  byEventType: Record<RecommendationOutcomeEventType, number>;
};

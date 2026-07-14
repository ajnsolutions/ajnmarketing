import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { inferPlatformFromContentType } from "@/lib/publishing-queue/persistence";
import {
  getContentApprovalForRecommendation,
  getContentPerformanceForPublishingJob,
  getOutcomeEventsForBusiness,
  getOutcomeEventsForRecommendation,
  getPublishingJobForQueueItem,
  getPublishingQueueItemForContentApproval,
  getRecommendationsForBusiness,
  insertRecommendationOutcomeEvent,
  type InsertOutcomeEventResult,
} from "@/lib/recommendation-outcomes/persistence";
import {
  buildOutcomeIdempotencyKey,
  hashEditableContent,
  measurementWindowKey,
} from "@/lib/recommendation-outcomes/idempotency";
import {
  isRejectionReasonCode,
  PublishingFailureCategories,
  RecommendationLifecycleStatuses,
  RecommendationOutcomeEventTypes,
  UsefulnessSignals,
  type PublishingFailureCategory,
  type RecommendationLifecycleStatus,
  type RecommendationOutcomeFilter,
  type RecommendationOutcomeStats,
  type RecommendationOutcomeSummary,
  type RejectionReasonCode,
  type UsefulnessSignal,
} from "@/lib/recommendation-outcomes/types";

type TenantScope = {
  userId: string;
  businessProfileId: string;
  recommendationId: string;
};

/** Structured, secret-free server log for one outcome-recording attempt. */
function logOutcomeAttempt(input: {
  recommendationId: string;
  contentApprovalId?: string | null;
  publishingJobId?: string | null;
  businessProfileId: string;
  eventType: string;
  result: "recorded" | "duplicate" | "error";
  failureCategory?: string;
}): void {
  const line = {
    scope: "recommendation-outcomes",
    recommendationId: input.recommendationId,
    contentApprovalId: input.contentApprovalId ?? null,
    publishingJobId: input.publishingJobId ?? null,
    businessProfileId: input.businessProfileId,
    eventType: input.eventType,
    result: input.result,
    ...(input.failureCategory ? { failureCategory: input.failureCategory } : {}),
  };

  if (input.result === "error") {
    console.error("[RecommendationOutcomes]", line);
  } else {
    console.info("[RecommendationOutcomes]", line);
  }
}

// ---------------------------------------------------------------------------
// Event recorders. Every recorder is a fire-and-forget-safe idempotent follow-up:
// insertion failures never throw past this module (only the unique-violation
// "duplicate" path is expected/normal; genuine errors are logged, never surfaced to the
// caller's authoritative transaction). This is a deliberate choice, documented in
// docs/RECOMMENDATION_OUTCOME_FEEDBACK_LOOP.md: outcome recording is an idempotent
// follow-up to the authoritative mutation, not part of its transaction, so a hiccup
// here can never corrupt e.g. an approval or a publish. Reconciliation exists precisely
// to repair anything a follow-up call like this misses.
// ---------------------------------------------------------------------------

export async function recordDraftCreatedOutcome(
  supabase: SupabaseClient,
  input: TenantScope & { contentApprovalId: string; source?: string }
): Promise<InsertOutcomeEventResult> {
  const idempotencyKey = buildOutcomeIdempotencyKey(RecommendationOutcomeEventTypes.DRAFT_CREATED, {
    contentApprovalId: input.contentApprovalId,
  });

  const result = await insertRecommendationOutcomeEvent(supabase, {
    userId: input.userId,
    businessProfileId: input.businessProfileId,
    recommendationId: input.recommendationId,
    contentApprovalId: input.contentApprovalId,
    eventType: RecommendationOutcomeEventTypes.DRAFT_CREATED,
    idempotencyKey,
    source: input.source ?? "recommendation_execution",
  });

  logOutcomeAttempt({
    recommendationId: input.recommendationId,
    contentApprovalId: input.contentApprovalId,
    businessProfileId: input.businessProfileId,
    eventType: RecommendationOutcomeEventTypes.DRAFT_CREATED,
    result: result.duplicate ? "duplicate" : result.event ? "recorded" : "error",
  });

  return result;
}

export type EditableDraftSnapshot = {
  title: string;
  content: string;
  contentType: string;
};

export type EditDetectionResult = {
  meaningful: boolean;
  fieldsChanged: string[];
  titleChanged: boolean;
  bodyChanged: boolean;
  channelChanged: boolean;
  textLengthDelta: number;
};

/** Pure diff -- no I/O. A save with no actual content/title/channel change is not an edit. */
export function detectMeaningfulEdit(
  before: EditableDraftSnapshot,
  after: EditableDraftSnapshot
): EditDetectionResult {
  const titleChanged = before.title.trim() !== after.title.trim();
  const bodyChanged = before.content.trim() !== after.content.trim();
  const channelChanged = before.contentType.trim() !== after.contentType.trim();
  const fieldsChanged = [
    titleChanged ? "title" : null,
    bodyChanged ? "content" : null,
    channelChanged ? "content_type" : null,
  ].filter((v): v is string => v !== null);

  return {
    meaningful: fieldsChanged.length > 0,
    fieldsChanged,
    titleChanged,
    bodyChanged,
    channelChanged,
    textLengthDelta: after.content.length - before.content.length,
  };
}

/**
 * Records a draft_edited event only when the edit is meaningful (detectMeaningfulEdit).
 * Metadata is restricted to structured, non-sensitive fields -- never the full before/
 * after content -- per this milestone's "no full client-generated content in outcome
 * metadata" rule. Deduped by a hash of the resulting content, so resubmitting the exact
 * same edit twice (e.g. a double click) never creates a second event.
 */
export async function recordDraftEditedOutcome(
  supabase: SupabaseClient,
  input: TenantScope & {
    contentApprovalId: string;
    before: EditableDraftSnapshot;
    after: EditableDraftSnapshot;
  }
): Promise<EditDetectionResult & { insertResult: InsertOutcomeEventResult | null }> {
  const diff = detectMeaningfulEdit(input.before, input.after);
  if (!diff.meaningful) {
    return { ...diff, insertResult: null };
  }

  const contentHash = hashEditableContent(input.after.title, input.after.content);
  const idempotencyKey = buildOutcomeIdempotencyKey(RecommendationOutcomeEventTypes.DRAFT_EDITED, {
    contentApprovalId: input.contentApprovalId,
    discriminator: contentHash,
  });

  const result = await insertRecommendationOutcomeEvent(supabase, {
    userId: input.userId,
    businessProfileId: input.businessProfileId,
    recommendationId: input.recommendationId,
    contentApprovalId: input.contentApprovalId,
    eventType: RecommendationOutcomeEventTypes.DRAFT_EDITED,
    idempotencyKey,
    source: "content_approval_edit",
    metadata: {
      fieldsChanged: diff.fieldsChanged,
      titleChanged: diff.titleChanged,
      bodyChanged: diff.bodyChanged,
      channelChanged: diff.channelChanged,
      textLengthDelta: diff.textLengthDelta,
    },
  });

  logOutcomeAttempt({
    recommendationId: input.recommendationId,
    contentApprovalId: input.contentApprovalId,
    businessProfileId: input.businessProfileId,
    eventType: RecommendationOutcomeEventTypes.DRAFT_EDITED,
    result: result.duplicate ? "duplicate" : result.event ? "recorded" : "error",
  });

  return { ...diff, insertResult: result };
}

export async function recordApprovalOutcome(
  supabase: SupabaseClient,
  input: TenantScope & { contentApprovalId: string }
): Promise<InsertOutcomeEventResult> {
  const idempotencyKey = buildOutcomeIdempotencyKey(RecommendationOutcomeEventTypes.DRAFT_APPROVED, {
    contentApprovalId: input.contentApprovalId,
  });

  const result = await insertRecommendationOutcomeEvent(supabase, {
    userId: input.userId,
    businessProfileId: input.businessProfileId,
    recommendationId: input.recommendationId,
    contentApprovalId: input.contentApprovalId,
    eventType: RecommendationOutcomeEventTypes.DRAFT_APPROVED,
    idempotencyKey,
    source: "content_approval_approve",
  });

  logOutcomeAttempt({
    recommendationId: input.recommendationId,
    contentApprovalId: input.contentApprovalId,
    businessProfileId: input.businessProfileId,
    eventType: RecommendationOutcomeEventTypes.DRAFT_APPROVED,
    result: result.duplicate ? "duplicate" : result.event ? "recorded" : "error",
  });

  return result;
}

/**
 * Records a "do more like this" positive-feedback signal -- deliberately distinct from
 * recordApprovalOutcome: a client can approve a draft without wanting more like it (and
 * vice versa), so these are two independent signals, not aliases of each other. Never
 * mutates content_approvals; this is purely an outcome-event record. Idempotent per
 * draft (one content approval can only produce one do_more_like_this event, matching
 * draft_approved/draft_rejected's own singular-per-draft pattern) -- repeating the
 * action is always safe.
 */
export async function recordDoMoreLikeThisOutcome(
  supabase: SupabaseClient,
  input: TenantScope & { contentApprovalId: string }
): Promise<InsertOutcomeEventResult> {
  const idempotencyKey = buildOutcomeIdempotencyKey(RecommendationOutcomeEventTypes.DO_MORE_LIKE_THIS, {
    contentApprovalId: input.contentApprovalId,
  });

  const result = await insertRecommendationOutcomeEvent(supabase, {
    userId: input.userId,
    businessProfileId: input.businessProfileId,
    recommendationId: input.recommendationId,
    contentApprovalId: input.contentApprovalId,
    eventType: RecommendationOutcomeEventTypes.DO_MORE_LIKE_THIS,
    idempotencyKey,
    source: "content_approval_do_more_like_this",
  });

  logOutcomeAttempt({
    recommendationId: input.recommendationId,
    contentApprovalId: input.contentApprovalId,
    businessProfileId: input.businessProfileId,
    eventType: RecommendationOutcomeEventTypes.DO_MORE_LIKE_THIS,
    result: result.duplicate ? "duplicate" : result.event ? "recorded" : "error",
  });

  return result;
}

export async function recordRejectionOutcome(
  supabase: SupabaseClient,
  input: TenantScope & {
    contentApprovalId: string;
    reasonCode?: string | null;
    comment?: string | null;
  }
): Promise<InsertOutcomeEventResult> {
  const normalizedReasonCode: RejectionReasonCode = isRejectionReasonCode(input.reasonCode)
    ? input.reasonCode
    : "other";

  const idempotencyKey = buildOutcomeIdempotencyKey(RecommendationOutcomeEventTypes.DRAFT_REJECTED, {
    contentApprovalId: input.contentApprovalId,
  });

  const result = await insertRecommendationOutcomeEvent(supabase, {
    userId: input.userId,
    businessProfileId: input.businessProfileId,
    recommendationId: input.recommendationId,
    contentApprovalId: input.contentApprovalId,
    eventType: RecommendationOutcomeEventTypes.DRAFT_REJECTED,
    idempotencyKey,
    source: "content_approval_reject",
    metadata: {
      reasonCode: normalizedReasonCode,
      hasComment: Boolean(input.comment?.trim()),
    },
  });

  logOutcomeAttempt({
    recommendationId: input.recommendationId,
    contentApprovalId: input.contentApprovalId,
    businessProfileId: input.businessProfileId,
    eventType: RecommendationOutcomeEventTypes.DRAFT_REJECTED,
    result: result.duplicate ? "duplicate" : result.event ? "recorded" : "error",
  });

  return result;
}

export async function recordPublishingQueuedOutcome(
  supabase: SupabaseClient,
  input: TenantScope & { contentApprovalId: string; publishingJobId: string }
): Promise<InsertOutcomeEventResult> {
  const idempotencyKey = buildOutcomeIdempotencyKey(RecommendationOutcomeEventTypes.PUBLISHING_QUEUED, {
    publishingJobId: input.publishingJobId,
  });

  const result = await insertRecommendationOutcomeEvent(supabase, {
    userId: input.userId,
    businessProfileId: input.businessProfileId,
    recommendationId: input.recommendationId,
    contentApprovalId: input.contentApprovalId,
    publishingJobId: input.publishingJobId,
    eventType: RecommendationOutcomeEventTypes.PUBLISHING_QUEUED,
    idempotencyKey,
    source: "publishing_engine",
  });

  logOutcomeAttempt({
    recommendationId: input.recommendationId,
    contentApprovalId: input.contentApprovalId,
    publishingJobId: input.publishingJobId,
    businessProfileId: input.businessProfileId,
    eventType: RecommendationOutcomeEventTypes.PUBLISHING_QUEUED,
    result: result.duplicate ? "duplicate" : result.event ? "recorded" : "error",
  });

  return result;
}

/**
 * Categorizes an already-sanitized publishing failure message (never a raw provider
 * payload or OAuth token) into a normalized bucket. Pattern-based on purpose: this
 * codebase's publishing failures already pass through toSafeUserErrorMessage before
 * reaching this point, so no raw secret can appear here regardless of the pattern match.
 */
export function categorizePublishingFailure(message: string | null | undefined): PublishingFailureCategory {
  const text = (message ?? "").toLowerCase();

  if (/oauth|token|reconnect|authoriz/.test(text)) {
    return PublishingFailureCategories.OAUTH_ERROR;
  }
  if (/timed out|timeout/.test(text)) {
    return PublishingFailureCategories.TIMEOUT;
  }
  if (/not available yet|not supported/.test(text)) {
    return PublishingFailureCategories.NOT_SUPPORTED;
  }
  if (/rejected|state (rejected|failed)/.test(text)) {
    return PublishingFailureCategories.PROVIDER_REJECTED;
  }
  return PublishingFailureCategories.PROVIDER_ERROR;
}

/**
 * Records the FINAL publishing outcome for a job. Callers must only invoke this once a
 * job has reached a terminal state for this attempt cycle: verified success, or a
 * failure with no retries remaining. A "retrying" transition must never call this --
 * see docs/RECOMMENDATION_OUTCOME_FEEDBACK_LOOP.md's retry-vs-final-failure rule.
 */
export async function recordPublishingResultOutcome(
  supabase: SupabaseClient,
  input: TenantScope & {
    contentApprovalId: string;
    publishingJobId: string;
    outcome: "succeeded" | "failed";
    failureMessage?: string | null;
  }
): Promise<InsertOutcomeEventResult> {
  const eventType =
    input.outcome === "succeeded"
      ? RecommendationOutcomeEventTypes.PUBLISHING_SUCCEEDED
      : RecommendationOutcomeEventTypes.PUBLISHING_FAILED;

  const failureCategory =
    input.outcome === "failed" ? categorizePublishingFailure(input.failureMessage) : undefined;

  const idempotencyKey = buildOutcomeIdempotencyKey(eventType, {
    publishingJobId: input.publishingJobId,
  });

  const result = await insertRecommendationOutcomeEvent(supabase, {
    userId: input.userId,
    businessProfileId: input.businessProfileId,
    recommendationId: input.recommendationId,
    contentApprovalId: input.contentApprovalId,
    publishingJobId: input.publishingJobId,
    eventType,
    idempotencyKey,
    source: "publishing_engine",
    metadata: failureCategory ? { failureCategory } : {},
  });

  logOutcomeAttempt({
    recommendationId: input.recommendationId,
    contentApprovalId: input.contentApprovalId,
    publishingJobId: input.publishingJobId,
    businessProfileId: input.businessProfileId,
    eventType,
    result: result.duplicate ? "duplicate" : result.event ? "recorded" : "error",
    failureCategory,
  });

  return result;
}

export async function recordPerformanceMeasuredOutcome(
  supabase: SupabaseClient,
  input: TenantScope & {
    contentApprovalId: string;
    publishingJobId: string;
    windowKey?: string;
    metrics: {
      views: number;
      clicks: number;
      engagement: number;
      conversions: number;
      performanceScore: number;
    };
  }
): Promise<InsertOutcomeEventResult> {
  const window = input.windowKey ?? measurementWindowKey();
  const idempotencyKey = buildOutcomeIdempotencyKey(RecommendationOutcomeEventTypes.PERFORMANCE_MEASURED, {
    contentApprovalId: input.contentApprovalId,
    discriminator: window,
  });

  const result = await insertRecommendationOutcomeEvent(supabase, {
    userId: input.userId,
    businessProfileId: input.businessProfileId,
    recommendationId: input.recommendationId,
    contentApprovalId: input.contentApprovalId,
    publishingJobId: input.publishingJobId,
    eventType: RecommendationOutcomeEventTypes.PERFORMANCE_MEASURED,
    idempotencyKey,
    source: "analytics_engine",
    metadata: {
      windowKey: window,
      ...input.metrics,
    },
  });

  logOutcomeAttempt({
    recommendationId: input.recommendationId,
    contentApprovalId: input.contentApprovalId,
    publishingJobId: input.publishingJobId,
    businessProfileId: input.businessProfileId,
    eventType: RecommendationOutcomeEventTypes.PERFORMANCE_MEASURED,
    result: result.duplicate ? "duplicate" : result.event ? "recorded" : "error",
  });

  return result;
}

// ---------------------------------------------------------------------------
// Tenant-safe link resolution -- always re-validates ownership via the userId-scoped
// queries below rather than trusting a caller-supplied id/recommendationId pairing.
// ---------------------------------------------------------------------------

export type RecommendationLink = { recommendationId: string; businessProfileId: string };

/** Resolves the recommendation a content approval was generated from, tenant-scoped. */
export async function resolveRecommendationLinkForContentApproval(
  supabase: SupabaseClient,
  userId: string,
  contentApproval: { user_id: string; business_profile_id: string; marketing_recommendation_id: string | null }
): Promise<RecommendationLink | null> {
  if (contentApproval.user_id !== userId || !contentApproval.marketing_recommendation_id) {
    return null;
  }
  return {
    recommendationId: contentApproval.marketing_recommendation_id,
    businessProfileId: contentApproval.business_profile_id,
  };
}

/** Resolves the recommendation behind a publishing job, by walking job -> queue -> approval. */
export async function resolveRecommendationLinkForPublishingJob(
  supabase: SupabaseClient,
  userId: string,
  job: { user_id: string; content_id: string }
): Promise<(RecommendationLink & { contentApprovalId: string }) | null> {
  if (job.user_id !== userId) return null;

  const { data: queueItem } = await supabase
    .from("publishing_queue")
    .select("*")
    .eq("id", job.content_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!queueItem?.content_approval_id) return null;

  const { data: approval } = await supabase
    .from("content_approvals")
    .select("*")
    .eq("id", queueItem.content_approval_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!approval?.marketing_recommendation_id) return null;

  return {
    recommendationId: approval.marketing_recommendation_id,
    businessProfileId: approval.business_profile_id,
    contentApprovalId: approval.id,
  };
}

// ---------------------------------------------------------------------------
// Canonical outcome summary
// ---------------------------------------------------------------------------

const TERMINAL_PUBLISH_SUCCESS_STATUSES = new Set(["published", "verified"]);
const ACTIVE_PUBLISH_QUEUE_STATUSES = new Set(["queued", "scheduled", "retrying"]);

function deriveUsefulnessSignal(lifecycleStatus: RecommendationLifecycleStatus): UsefulnessSignal {
  switch (lifecycleStatus) {
    case RecommendationLifecycleStatuses.REJECTED:
      return UsefulnessSignals.NEGATIVE;
    case RecommendationLifecycleStatuses.PUBLISH_FAILED:
      // A provider/delivery failure is never held against the recommendation itself.
      return UsefulnessSignals.NEUTRAL;
    case RecommendationLifecycleStatuses.PUBLISHED:
    case RecommendationLifecycleStatuses.MEASURED:
      return UsefulnessSignals.POSITIVE;
    case RecommendationLifecycleStatuses.APPROVED:
    case RecommendationLifecycleStatuses.PUBLISHING_QUEUED:
    case RecommendationLifecycleStatuses.PUBLISHING:
      return UsefulnessSignals.NEUTRAL;
    case RecommendationLifecycleStatuses.AWAITING_REVIEW:
    case RecommendationLifecycleStatuses.RECOMMENDED:
    default:
      return UsefulnessSignals.UNKNOWN;
  }
}

/**
 * Deterministic, server-only aggregation from the authoritative tables and the outcome
 * event log -- never a second source of truth for status/timestamps, only for things
 * the authoritative tables don't carry (edit count, rejection-event timing, failure
 * category). See docs/RECOMMENDATION_OUTCOME_FEEDBACK_LOOP.md for the full state table.
 */
export async function summarizeRecommendationOutcomeForUser(
  userId: string,
  recommendationId: string,
  supabaseClient?: SupabaseClient
): Promise<RecommendationOutcomeSummary> {
  const supabase = supabaseClient ?? (await createClient());

  const approval = await getContentApprovalForRecommendation(supabase, userId, recommendationId);

  if (!approval) {
    return {
      recommendationId,
      contentApprovalId: null,
      lifecycleStatus: RecommendationLifecycleStatuses.RECOMMENDED,
      draftCreatedAt: null,
      wasEdited: false,
      editCount: 0,
      approvedAt: null,
      rejectedAt: null,
      rejectionReason: null,
      rejectionReasonCode: null,
      publishingJobId: null,
      publishingStatus: null,
      publishedAt: null,
      publishingFailureCategory: null,
      performanceStatus: "not_applicable",
      measuredAt: null,
      performanceMetrics: null,
      usefulnessSignal: UsefulnessSignals.UNKNOWN,
      lastEventAt: null,
    };
  }

  const contentApprovalId = String(approval.id);
  const events = await getOutcomeEventsForRecommendation(supabase, userId, recommendationId);
  const editEvents = events.filter((e) => e.event_type === "draft_edited");
  const rejectedEvent = [...events].reverse().find((e) => e.event_type === "draft_rejected");
  const draftCreatedEvent = events.find((e) => e.event_type === "draft_created");
  const performanceEvent = [...events].reverse().find((e) => e.event_type === "performance_measured");
  const publishingFailedEvent = [...events].reverse().find((e) => e.event_type === "publishing_failed");

  const queueItem = await getPublishingQueueItemForContentApproval(supabase, userId, contentApprovalId);
  const job = queueItem
    ? await getPublishingJobForQueueItem(supabase, userId, String(queueItem.id))
    : null;
  const performance = job
    ? await getContentPerformanceForPublishingJob(supabase, String(job.id))
    : null;

  const approvalStatus = String(approval.status);
  const jobStatus = job ? String(job.status) : null;

  let lifecycleStatus: RecommendationLifecycleStatus;
  if (approvalStatus === "rejected") {
    lifecycleStatus = RecommendationLifecycleStatuses.REJECTED;
  } else if (jobStatus && TERMINAL_PUBLISH_SUCCESS_STATUSES.has(jobStatus)) {
    lifecycleStatus = performance
      ? RecommendationLifecycleStatuses.MEASURED
      : RecommendationLifecycleStatuses.PUBLISHED;
  } else if (jobStatus === "failed") {
    lifecycleStatus = RecommendationLifecycleStatuses.PUBLISH_FAILED;
  } else if (jobStatus === "publishing") {
    lifecycleStatus = RecommendationLifecycleStatuses.PUBLISHING;
  } else if (jobStatus && ACTIVE_PUBLISH_QUEUE_STATUSES.has(jobStatus)) {
    lifecycleStatus = RecommendationLifecycleStatuses.PUBLISHING_QUEUED;
  } else if (approvalStatus === "approved") {
    lifecycleStatus = RecommendationLifecycleStatuses.APPROVED;
  } else {
    lifecycleStatus = RecommendationLifecycleStatuses.AWAITING_REVIEW;
  }

  const performanceStatus: RecommendationOutcomeSummary["performanceStatus"] =
    lifecycleStatus === RecommendationLifecycleStatuses.MEASURED
      ? "measured"
      : jobStatus && TERMINAL_PUBLISH_SUCCESS_STATUSES.has(jobStatus)
        ? "unavailable"
        : "not_applicable";

  const rejectionReasonCode = isRejectionReasonCode(approval.rejection_reason_code)
    ? approval.rejection_reason_code
    : null;

  const lastEventAt = events.length > 0 ? events[events.length - 1].created_at : null;

  return {
    recommendationId,
    contentApprovalId,
    lifecycleStatus,
    draftCreatedAt: draftCreatedEvent?.created_at ?? String(approval.created_at),
    wasEdited: editEvents.length > 0,
    editCount: editEvents.length,
    approvedAt: (approval.approved_at as string | null) ?? null,
    rejectedAt: rejectedEvent?.created_at ?? (approvalStatus === "rejected" ? String(approval.updated_at) : null),
    rejectionReason: (approval.rejected_reason as string | null) ?? null,
    rejectionReasonCode,
    publishingJobId: job ? String(job.id) : null,
    publishingStatus: jobStatus,
    publishedAt: job ? ((job.published_at as string | null) ?? null) : null,
    publishingFailureCategory:
      (publishingFailedEvent?.metadata.failureCategory as PublishingFailureCategory | undefined) ?? null,
    performanceStatus,
    measuredAt: performanceEvent?.created_at ?? (performance ? String(performance.created_at) : null),
    performanceMetrics: performance
      ? {
          views: Number(performance.views ?? 0),
          clicks: Number(performance.clicks ?? 0),
          engagement: Number(performance.engagement ?? 0),
          conversions: Number(performance.conversions ?? 0),
          performanceScore: Number(performance.performance_score ?? 0),
        }
      : null,
    usefulnessSignal: deriveUsefulnessSignal(lifecycleStatus),
    lastEventAt,
  };
}

export async function summarizeRecommendationOutcomeForCurrentUser(
  recommendationId: string
): Promise<RecommendationOutcomeSummary | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;
  return summarizeRecommendationOutcomeForUser(user.id, recommendationId, supabase);
}

// ---------------------------------------------------------------------------
// Decision-engine-facing aggregate statistics. Read-only, purely additive -- consumed
// nowhere yet by the decision engine or scoring in this milestone (see the architecture
// doc's "next milestone" section for the intended integration point).
// ---------------------------------------------------------------------------

function resolveChannel(
  approval: Record<string, unknown>,
  publishingProvider: string | null
): string {
  if (publishingProvider) return publishingProvider;
  return inferPlatformFromContentType(String(approval.content_type ?? ""));
}

export async function getRecommendationOutcomeStatsForUser(
  userId: string,
  businessProfileId: string,
  filter: RecommendationOutcomeFilter = {},
  supabaseClient?: SupabaseClient
): Promise<RecommendationOutcomeStats> {
  const supabase = supabaseClient ?? (await createClient());
  const recommendations = await getRecommendationsForBusiness(supabase, userId, businessProfileId);

  const filtered = recommendations.filter((rec) => {
    if (filter.actionType && rec.recommended_action_type !== filter.actionType) return false;
    if (filter.since && String(rec.created_at) < filter.since) return false;
    if (filter.until && String(rec.created_at) > filter.until) return false;
    return true;
  });

  const outcomeCountsByActionType: Record<string, number> = {};
  const rejectionReasonCounts: Record<string, number> = {};
  let totalGenerated = 0;
  let approvedCount = 0;
  let rejectedCount = 0;
  let editedCount = 0;
  let publishAttempted = 0;
  let publishSucceeded = 0;

  for (const rec of filtered) {
    const recommendationId = String(rec.id);
    const summary = await summarizeRecommendationOutcomeForUser(userId, recommendationId, supabase);

    if (summary.lifecycleStatus === "recommended") continue;

    const approval = await getContentApprovalForRecommendation(supabase, userId, recommendationId);
    const channel = approval
      ? resolveChannel(approval, summary.publishingStatus ? String(approval.content_type) : null)
      : null;

    if (filter.channel && channel !== filter.channel) continue;
    if (filter.usefulnessSignal && summary.usefulnessSignal !== filter.usefulnessSignal) continue;

    totalGenerated += 1;
    const actionType = String(rec.recommended_action_type);
    outcomeCountsByActionType[actionType] = (outcomeCountsByActionType[actionType] ?? 0) + 1;

    if (summary.approvedAt) approvedCount += 1;
    if (summary.rejectedAt) {
      rejectedCount += 1;
      const bucket = summary.rejectionReasonCode ?? "unspecified";
      rejectionReasonCounts[bucket] = (rejectionReasonCounts[bucket] ?? 0) + 1;
    }
    if (summary.wasEdited) editedCount += 1;

    if (
      summary.lifecycleStatus === "published" ||
      summary.lifecycleStatus === "measured" ||
      summary.lifecycleStatus === "publish_failed"
    ) {
      publishAttempted += 1;
      if (summary.lifecycleStatus !== "publish_failed") publishSucceeded += 1;
    }
  }

  return {
    totalGenerated,
    approvalRate: totalGenerated > 0 ? approvedCount / totalGenerated : null,
    rejectionRate: totalGenerated > 0 ? rejectedCount / totalGenerated : null,
    editRate: totalGenerated > 0 ? editedCount / totalGenerated : null,
    publishSuccessRate: publishAttempted > 0 ? publishSucceeded / publishAttempted : null,
    outcomeCountsByActionType,
    rejectionReasonCounts,
  };
}

export { getOutcomeEventsForBusiness };

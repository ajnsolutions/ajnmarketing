import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getContentApprovalForRecommendation,
  getContentPerformanceForPublishingJob,
  getPublishingJobForQueueItem,
  getPublishingQueueItemForContentApproval,
  getRecommendationsForBusiness,
} from "@/lib/recommendation-outcomes/persistence";
import {
  recordApprovalOutcome,
  recordDraftCreatedOutcome,
  recordPerformanceMeasuredOutcome,
  recordPublishingQueuedOutcome,
  recordPublishingResultOutcome,
  recordRejectionOutcome,
} from "@/lib/recommendation-outcomes/service";
import { measurementWindowKey } from "@/lib/recommendation-outcomes/idempotency";
import {
  RecommendationOutcomeEventTypes,
  type RecommendationOutcomeEventType,
  type ReconciliationCounts,
} from "@/lib/recommendation-outcomes/types";

function emptyByEventTypeCounts(): Record<RecommendationOutcomeEventType, number> {
  return {
    draft_created: 0,
    draft_edited: 0,
    draft_approved: 0,
    draft_rejected: 0,
    publishing_queued: 0,
    publishing_succeeded: 0,
    publishing_failed: 0,
    performance_measured: 0,
    // do_more_like_this has no corresponding column anywhere to infer from (unlike
    // draft_approved, which content_approvals.status/approved_at can reconstruct) --
    // it can never be backfilled retroactively, only captured going forward from the
    // live integration point. Left at 0 here, same documented limitation pattern as
    // draft_edited (see docs/RECOMMENDATION_OUTCOME_FEEDBACK_LOOP.md).
    do_more_like_this: 0,
  };
}

const TERMINAL_PUBLISH_SUCCESS_STATUSES = new Set(["published", "verified"]);

/**
 * Backfills missing recommendation_outcome_events from the existing authoritative
 * tables (content_approvals, publishing_queue, publishing_jobs, content_performance).
 * Tenant-scoped, safely repeatable (every insert goes through the same idempotent
 * recorder functions the live integration points use, so a second run against
 * unchanged state inserts nothing). Does not infer draft_edited events retroactively --
 * there is no durable "previous content" to diff against once a row has been
 * overwritten by an edit, so edit history can only be captured going forward from the
 * live integration point, never reconstructed after the fact. This is a deliberate,
 * documented limitation (see docs/RECOMMENDATION_OUTCOME_FEEDBACK_LOOP.md).
 *
 * Never scheduled in production -- callable only from an authenticated admin route or
 * a manual Trigger.dev task invocation, exactly like this codebase's other admin-only
 * utilities (see app/api/admin/trigger-recommendation-execution).
 */
export async function reconcileRecommendationOutcomesForUser(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string
): Promise<ReconciliationCounts> {
  const recommendations = await getRecommendationsForBusiness(supabase, userId, businessProfileId);
  const byEventType = emptyByEventTypeCounts();
  let eventsInserted = 0;
  let eventsSkippedExisting = 0;

  function tally(eventType: RecommendationOutcomeEventType, inserted: boolean) {
    if (inserted) {
      byEventType[eventType] += 1;
      eventsInserted += 1;
    } else {
      eventsSkippedExisting += 1;
    }
  }

  for (const rec of recommendations) {
    const recommendationId = String(rec.id);
    const approval = await getContentApprovalForRecommendation(supabase, userId, recommendationId);
    if (!approval) continue;

    const contentApprovalId = String(approval.id);
    const scope = { userId, businessProfileId, recommendationId, contentApprovalId };

    const draftResult = await recordDraftCreatedOutcome(supabase, { ...scope, source: "reconciliation" });
    tally(RecommendationOutcomeEventTypes.DRAFT_CREATED, !draftResult.duplicate && !!draftResult.event);

    if (approval.status === "approved" || approval.approved_at) {
      const approvedResult = await recordApprovalOutcome(supabase, scope);
      tally(RecommendationOutcomeEventTypes.DRAFT_APPROVED, !approvedResult.duplicate && !!approvedResult.event);
    }

    if (approval.status === "rejected") {
      const rejectedResult = await recordRejectionOutcome(supabase, {
        ...scope,
        reasonCode: (approval.rejection_reason_code as string | null) ?? null,
        comment: (approval.rejected_reason as string | null) ?? null,
      });
      tally(RecommendationOutcomeEventTypes.DRAFT_REJECTED, !rejectedResult.duplicate && !!rejectedResult.event);
    }

    const queueItem = await getPublishingQueueItemForContentApproval(supabase, userId, contentApprovalId);
    if (!queueItem) continue;

    const job = await getPublishingJobForQueueItem(supabase, userId, String(queueItem.id));
    if (!job) continue;

    const jobId = String(job.id);
    const jobScope = { ...scope, publishingJobId: jobId };

    const queuedResult = await recordPublishingQueuedOutcome(supabase, jobScope);
    tally(RecommendationOutcomeEventTypes.PUBLISHING_QUEUED, !queuedResult.duplicate && !!queuedResult.event);

    const jobStatus = String(job.status);
    if (TERMINAL_PUBLISH_SUCCESS_STATUSES.has(jobStatus)) {
      const succeededResult = await recordPublishingResultOutcome(supabase, {
        ...jobScope,
        outcome: "succeeded",
      });
      tally(
        RecommendationOutcomeEventTypes.PUBLISHING_SUCCEEDED,
        !succeededResult.duplicate && !!succeededResult.event
      );

      const performance = await getContentPerformanceForPublishingJob(supabase, jobId);
      if (performance) {
        const windowKey = String(performance.created_at ?? measurementWindowKey()).slice(0, 10);
        const performanceResult = await recordPerformanceMeasuredOutcome(supabase, {
          ...jobScope,
          windowKey,
          metrics: {
            views: Number(performance.views ?? 0),
            clicks: Number(performance.clicks ?? 0),
            engagement: Number(performance.engagement ?? 0),
            conversions: Number(performance.conversions ?? 0),
            performanceScore: Number(performance.performance_score ?? 0),
          },
        });
        tally(
          RecommendationOutcomeEventTypes.PERFORMANCE_MEASURED,
          !performanceResult.duplicate && !!performanceResult.event
        );
      }
    } else if (jobStatus === "failed") {
      const failedResult = await recordPublishingResultOutcome(supabase, {
        ...jobScope,
        outcome: "failed",
        failureMessage: (job.last_error as string | null) ?? null,
      });
      tally(RecommendationOutcomeEventTypes.PUBLISHING_FAILED, !failedResult.duplicate && !!failedResult.event);
    }
  }

  return {
    recommendationsScanned: recommendations.length,
    eventsInserted,
    eventsSkippedExisting,
    byEventType,
  };
}

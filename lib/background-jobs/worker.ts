import "server-only";

import { generateContentForUser } from "@/lib/content-generator/service";
import type { ContentGenerationRequest } from "@/lib/content-generator/types";
import { draftGoogleReviewReplyForUser } from "@/lib/google-business/service";
import { runGoogleBusinessSyncForUser } from "@/lib/google-business/sync";
import { executePublishingJobById } from "@/lib/publishing/publishingEngine";
import { runAnalyticsFeedbackLoopForUser } from "@/lib/analytics/analyticsEngine";
import { evaluateOpportunitiesForUser } from "@/lib/marketing-opportunities/detectionEngine";
import { regenerateMarketingAgentTasksForUser } from "@/lib/marketing-agent/service";
import { generateMarketingPlanForUser } from "@/lib/marketing-planner/service";
import type { BackgroundJob } from "@/lib/background-jobs/types";
import { BackgroundJobTypes } from "@/lib/background-jobs/types";
import { runWebsiteAnalysisForUser } from "@/lib/website-analysis/service";
import { toSafeUserErrorMessage } from "@/lib/security/safe-error-message";

const FUTURE_PROVIDER_TYPES = new Set<string>([
  BackgroundJobTypes.FACEBOOK_SYNC,
  BackgroundJobTypes.INSTAGRAM_SYNC,
  BackgroundJobTypes.LINKEDIN_SYNC,
]);

export async function executeBackgroundJob(job: BackgroundJob): Promise<Record<string, unknown>> {
  if (FUTURE_PROVIDER_TYPES.has(job.job_type)) {
    throw new Error("This integration sync is not available yet.");
  }

  switch (job.job_type) {
    case BackgroundJobTypes.WEBSITE_ANALYSIS: {
      const analysis = await runWebsiteAnalysisForUser(job.user_id);
      if (!analysis) {
        throw new Error("Website analysis could not be completed.");
      }
      return {
        analysisId: analysis.id,
        analysisStatus: analysis.analysis_status,
        analysisScore: analysis.analysis_score,
      };
    }

    case BackgroundJobTypes.MARKETING_PLAN_GENERATION: {
      const { plan, error } = await generateMarketingPlanForUser(job.user_id);
      if (error || !plan) {
        throw new Error(error ?? "Marketing plan generation failed.");
      }
      return {
        planId: plan.id,
        planStatus: plan.status,
        month: plan.month,
        year: plan.year,
      };
    }

    case BackgroundJobTypes.AI_TASK_GENERATION: {
      const { data, error } = await regenerateMarketingAgentTasksForUser(job.user_id);
      if (error) {
        throw new Error(error);
      }
      return {
        taskCount: data.tasks.length,
        dueToday: data.stats.dueToday,
      };
    }

    case BackgroundJobTypes.GOOGLE_BUSINESS_SYNC: {
      if (!job.business_profile_id) {
        throw new Error("Business profile is required for Google Business sync.");
      }

      const result = await runGoogleBusinessSyncForUser({
        userId: job.user_id,
        businessProfileId: job.business_profile_id,
      });

      if (!result.success && result.syncLog?.sync_status === "failed") {
        throw new Error(result.error ?? "Google Business sync failed.");
      }

      return {
        success: result.success,
        syncLogId: result.syncLog?.id ?? null,
        syncStatus: result.syncLog?.sync_status ?? null,
        locationsSynced: result.syncLog?.locations_synced ?? 0,
        reviewsSynced: result.syncLog?.reviews_synced ?? 0,
      };
    }

    case BackgroundJobTypes.AI_CONTENT_GENERATION: {
      const request = job.payload as unknown as ContentGenerationRequest;
      const { result, error } = await generateContentForUser(job.user_id, request);

      if (error || !result?.variations?.length) {
        throw new Error(error ?? "Content generation failed.");
      }

      return {
        contentType: request.contentType,
        variations: result.variations,
      };
    }

    case BackgroundJobTypes.REVIEW_REPLY_GENERATION: {
      const reviewId = typeof job.payload.reviewId === "string" ? job.payload.reviewId : "";
      if (!reviewId) {
        throw new Error("Review id is required.");
      }

      const { review, error } = await draftGoogleReviewReplyForUser(job.user_id, reviewId);
      if (error || !review) {
        throw new Error(error ?? "Review reply generation failed.");
      }

      return {
        reviewId: review.id,
        replyStatus: review.reply_status,
      };
    }

    case BackgroundJobTypes.PUBLISHING_EXECUTE: {
      const publishingJobId =
        typeof job.payload.publishingJobId === "string" ? job.payload.publishingJobId : "";
      if (!publishingJobId) {
        throw new Error("Publishing job id is required.");
      }

      const { job: publishingJob, error } = await executePublishingJobById(
        publishingJobId,
        job.user_id
      );

      if (error || !publishingJob) {
        throw new Error(error ?? "Publishing execution failed.");
      }

      return {
        publishingJobId: publishingJob.id,
        publishingStatus: publishingJob.status,
        providerPostId: publishingJob.provider_post_id,
      };
    }

    case BackgroundJobTypes.ANALYTICS_CAPTURE: {
      const feedback = await runAnalyticsFeedbackLoopForUser(job.user_id);
      return {
        opportunityScore: feedback.opportunityScore,
        recommendationCount: feedback.recommendations.length,
        snapshotDate: feedback.latestSnapshot?.snapshot_date ?? null,
      };
    }

    case BackgroundJobTypes.OPPORTUNITY_DETECTION: {
      // No client injected here: like every other case in this switch, this job runs
      // within an after() request context, so evaluateOpportunitiesForUser's default
      // request-scoped client is correct. Service-role/Trigger.dev execution should
      // call evaluateOpportunitiesForUser(userId, serviceRoleClient) directly instead
      // of going through this worker.
      const result = await evaluateOpportunitiesForUser(job.user_id);
      if (!result) {
        throw new Error("No business profile found for opportunity detection.");
      }

      return {
        opportunityCount: result.opportunities.length,
        expiredCount: result.expiredCount,
        businessProfileId: result.businessProfileId,
      };
    }

    default:
      throw new Error("Unsupported background job type.");
  }
}

export function normalizeBackgroundJobError(error: unknown, fallback: string): string {
  return toSafeUserErrorMessage(error, fallback);
}

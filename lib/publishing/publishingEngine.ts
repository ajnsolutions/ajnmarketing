import "server-only";

import { enqueueBackgroundJob } from "@/lib/background-jobs/queue";
import { scheduleBackgroundJobProcessing } from "@/lib/background-jobs/scheduler";
import { BackgroundJobTypes } from "@/lib/background-jobs/types";
import { getPublishingQueueItemById, updatePublishingQueueItem } from "@/lib/publishing-queue/persistence";
import {
  getPublishingProvider,
  isPublishingProviderSupported,
} from "@/lib/publishing/providerRouter";
import { verifyPublishedContentResult } from "@/lib/publishing/publishVerifier";
import {
  claimPublishingJobForExecution,
  createPublishingJobRecord,
  getActivePublishingJobForContent,
  getPublishingHistoryForJob,
  getPublishingJobById,
  getPublishingJobsForUser,
  insertPublishingHistoryEntry,
  updatePublishingJobRecord,
} from "@/lib/publishing/publishingHistory";
import {
  canAttemptPublishingClaim,
  publishingClaimFailureMessage,
} from "@/lib/publishing/publishingClaim";
import {
  mapPlatformToProvider,
  PublishingJobStatuses,
  type PublishingJob,
  type QueuePublishInput,
} from "@/lib/publishing/publishingTypes";
import {
  getPublishingRetryScheduledFor,
  shouldRetryPublishing,
} from "@/lib/publishing/retryManager";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AuditActions, auditErrorMetadata, logAuditEvent } from "@/lib/audit-log-server";
import { createClient } from "@/lib/supabase/server";
import { toSafeUserErrorMessage } from "@/lib/security/safe-error-message";

async function recordPublishingEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: {
    userId: string;
    businessProfileId: string;
    job: PublishingJob;
    action: string;
    status: PublishingJob["status"];
    auditAction: string;
    auditStatus: "started" | "success" | "failure";
    details?: Record<string, unknown>;
    error?: unknown;
  }
): Promise<void> {
  await insertPublishingHistoryEntry(supabase, {
    publishingJobId: input.job.id,
    action: input.action,
    status: input.status,
    details: input.details ?? {},
  });

  await logAuditEvent(supabase, {
    userId: input.userId,
    businessProfileId: input.businessProfileId,
    action: input.auditAction,
    entityType: "publishing_job",
    entityId: input.job.id,
    status: input.auditStatus,
    metadata: input.error
      ? auditErrorMetadata(input.error, input.action)
      : {
          action: input.action,
          provider: input.job.provider,
          contentId: input.job.content_id,
          ...(input.details ?? {}),
        },
  });
}

async function loadQueueItemForPublish(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  publishingQueueId: string
) {
  const queueItem = await getPublishingQueueItemById(supabase, userId, publishingQueueId);
  if (!queueItem) {
    throw new Error("Publishing queue item not found.");
  }

  if (queueItem.status === "published") {
    throw new Error("This content has already been published.");
  }

  if (!isPublishingProviderSupported(mapPlatformToProvider(queueItem.platform))) {
    throw new Error(`${queueItem.platform} publishing is not available yet.`);
  }

  return queueItem;
}

async function enqueuePublishingExecution(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: {
    userId: string;
    businessProfileId: string;
    publishingJobId: string;
  }
) {
  const result = await enqueueBackgroundJob({
    userId: input.userId,
    businessProfileId: input.businessProfileId,
    jobType: BackgroundJobTypes.PUBLISHING_EXECUTE,
    priority: "high",
    payload: { publishingJobId: input.publishingJobId },
    force: true,
  });

  if (result.job && !result.duplicate) {
    scheduleBackgroundJobProcessing(result.job.id);
  }

  if (!result.job) {
    throw new Error(result.error ?? "Unable to queue publishing job.");
  }

  await logAuditEvent(supabase, {
    userId: input.userId,
    businessProfileId: input.businessProfileId,
    action: AuditActions.PUBLISHING_QUEUED,
    entityType: "publishing_job",
    entityId: input.publishingJobId,
    status: "success",
    metadata: {
      backgroundJobId: result.job.id,
    },
  });
}

async function createJobFromQueueItem(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  publishingQueueId: string,
  options?: { scheduledFor?: string | null; status?: PublishingJob["status"] }
): Promise<PublishingJob> {
  const queueItem = await loadQueueItemForPublish(supabase, userId, publishingQueueId);
  const existing = await getActivePublishingJobForContent(supabase, userId, publishingQueueId);

  if (existing) {
    return existing;
  }

  const scheduledFor = options?.scheduledFor ?? queueItem.scheduled_for;
  const status =
    options?.status ??
    (scheduledFor && new Date(scheduledFor).getTime() > Date.now()
      ? PublishingJobStatuses.SCHEDULED
      : PublishingJobStatuses.QUEUED);

  const job = await createPublishingJobRecord(supabase, {
    userId,
    businessProfileId: queueItem.business_profile_id,
    contentId: publishingQueueId,
    provider: mapPlatformToProvider(queueItem.platform),
    status,
    scheduledFor,
    metadata: {
      publishingQueueId,
      contentApprovalId: queueItem.content_approval_id,
      title: queueItem.title,
    },
  });

  if (!job) {
    throw new Error("Unable to create publishing job.");
  }

  await recordPublishingEvent(supabase, {
    userId,
    businessProfileId: queueItem.business_profile_id,
    job,
    action: status === PublishingJobStatuses.SCHEDULED ? "scheduled" : "queued",
    status: job.status,
    auditAction: AuditActions.PUBLISHING_QUEUED,
    auditStatus: "success",
    details: { scheduledFor },
  });

  if (status === PublishingJobStatuses.SCHEDULED) {
    await updatePublishingQueueItem(supabase, userId, publishingQueueId, {
      status: "scheduled",
      scheduled_for: scheduledFor,
      publish_error: null,
    });
  }

  return job;
}

export async function queuePublishForUser(
  userId: string,
  input: QueuePublishInput
): Promise<{ job: PublishingJob | null; error?: string }> {
  try {
    const supabase = await createClient();
    const job = await createJobFromQueueItem(supabase, userId, input.publishingQueueId, {
      scheduledFor: input.scheduledFor ?? null,
    });

    if (
      job.status === PublishingJobStatuses.QUEUED ||
      (job.scheduled_for && new Date(job.scheduled_for).getTime() <= Date.now())
    ) {
      await enqueuePublishingExecution(supabase, {
        userId,
        businessProfileId: job.business_profile_id,
        publishingJobId: job.id,
      });
    }

    return { job };
  } catch (error) {
    return {
      job: null,
      error: toSafeUserErrorMessage(error, "Unable to queue publishing job."),
    };
  }
}

export async function publishNowForUser(
  userId: string,
  publishingQueueId: string
): Promise<{ job: PublishingJob | null; error?: string }> {
  return queuePublishForUser(userId, { publishingQueueId, scheduledFor: null });
}

export async function schedulePublishForUser(
  userId: string,
  publishingQueueId: string,
  scheduledFor: string
): Promise<{ job: PublishingJob | null; error?: string }> {
  return queuePublishForUser(userId, { publishingQueueId, scheduledFor });
}

export async function retryPublishForUser(
  userId: string,
  publishingJobId: string
): Promise<{ job: PublishingJob | null; error?: string }> {
  try {
    const supabase = await createClient();
    const job = await getPublishingJobById(supabase, userId, publishingJobId);

    if (!job) {
      return { job: null, error: "Publishing job not found." };
    }

    if (!shouldRetryPublishing(job.retry_count)) {
      return { job: null, error: "Maximum publishing retries reached." };
    }

    const nextRetryCount = job.retry_count + 1;
    const scheduledFor = getPublishingRetryScheduledFor(nextRetryCount);
    const updated = await updatePublishingJobRecord(supabase, userId, publishingJobId, {
      status: PublishingJobStatuses.RETRYING,
      retry_count: nextRetryCount,
      scheduled_for: scheduledFor,
      last_error: null,
    });

    if (!updated) {
      return { job: null, error: "Unable to retry publishing job." };
    }

    await recordPublishingEvent(supabase, {
      userId,
      businessProfileId: updated.business_profile_id,
      job: updated,
      action: "retry_scheduled",
      status: updated.status,
      auditAction: AuditActions.PUBLISHING_RETRYING,
      auditStatus: "started",
      details: { retryCount: nextRetryCount, scheduledFor },
    });

    if (new Date(scheduledFor).getTime() <= Date.now()) {
      await enqueuePublishingExecution(supabase, {
        userId,
        businessProfileId: updated.business_profile_id,
        publishingJobId: updated.id,
      });
    }

    return { job: updated };
  } catch (error) {
    return {
      job: null,
      error: toSafeUserErrorMessage(error, "Unable to retry publishing job."),
    };
  }
}

export async function cancelPublishForUser(
  userId: string,
  publishingJobId: string
): Promise<{ job: PublishingJob | null; error?: string }> {
  try {
    const supabase = await createClient();
    const job = await getPublishingJobById(supabase, userId, publishingJobId);

    if (!job) {
      return { job: null, error: "Publishing job not found." };
    }

    const updated = await updatePublishingJobRecord(supabase, userId, publishingJobId, {
      status: PublishingJobStatuses.CANCELLED,
      last_error: null,
    });

    if (!updated) {
      return { job: null, error: "Unable to cancel publishing job." };
    }

    await recordPublishingEvent(supabase, {
      userId,
      businessProfileId: updated.business_profile_id,
      job: updated,
      action: "cancelled",
      status: updated.status,
      auditAction: AuditActions.PUBLISHING_CANCELLED,
      auditStatus: "success",
    });

    return { job: updated };
  } catch (error) {
    return {
      job: null,
      error: toSafeUserErrorMessage(error, "Unable to cancel publishing job."),
    };
  }
}

export async function verifyPublishedContentForUser(
  userId: string,
  publishingJobId: string
): Promise<{ job: PublishingJob | null; error?: string }> {
  try {
    const supabase = await createClient();
    const job = await getPublishingJobById(supabase, userId, publishingJobId);

    if (!job) {
      return { job: null, error: "Publishing job not found." };
    }

    if (!job.provider_post_id) {
      return { job: null, error: "Publishing job has no provider post id to verify." };
    }

    const verification = verifyPublishedContentResult(job, {
      providerPostId: job.provider_post_id,
      publishedAt: job.published_at ?? new Date().toISOString(),
      rawResponse: (job.metadata.rawResponse as Record<string, unknown>) ?? {},
      verificationHint: (job.metadata.verificationHint as Record<string, unknown>) ?? {},
    });

    const updated = await updatePublishingJobRecord(supabase, userId, publishingJobId, {
      status: verification.verified
        ? PublishingJobStatuses.VERIFIED
        : PublishingJobStatuses.FAILED,
      last_error: verification.verified ? null : verification.message,
    });

    if (!updated) {
      return { job: null, error: "Unable to update publishing verification status." };
    }

    await recordPublishingEvent(supabase, {
      userId,
      businessProfileId: updated.business_profile_id,
      job: updated,
      action: "verified",
      status: updated.status,
      auditAction: verification.verified
        ? AuditActions.PUBLISHING_VERIFIED
        : AuditActions.PUBLISHING_FAILED,
      auditStatus: verification.verified ? "success" : "failure",
      details: verification.details,
    });

    return { job: updated };
  } catch (error) {
    return {
      job: null,
      error: toSafeUserErrorMessage(error, "Unable to verify published content."),
    };
  }
}

export async function getPublishingHistoryForUser(
  userId: string,
  publishingJobId: string
) {
  const supabase = await createClient();
  return getPublishingHistoryForJob(supabase, userId, publishingJobId);
}

export async function getPublishingDashboardJobsForUser(userId: string): Promise<PublishingJob[]> {
  const supabase = await createClient();
  return getPublishingJobsForUser(supabase, userId);
}

export async function executePublishingJobById(
  publishingJobId: string,
  userId: string,
  supabaseClient?: SupabaseClient,
  now: Date = new Date()
): Promise<{ job: PublishingJob | null; error?: string }> {
  const supabase = supabaseClient ?? (await createClient());
  const job = await getPublishingJobById(supabase, userId, publishingJobId);

  if (!canAttemptPublishingClaim(job, now)) {
    return { job, error: publishingClaimFailureMessage(job, now) };
  }

  // Atomic compare-and-swap: only one concurrent caller transitions this status → publishing.
  const publishing = await claimPublishingJobForExecution(
    supabase,
    userId,
    publishingJobId,
    job!.status,
    now
  );

  if (!publishing) {
    const latest = await getPublishingJobById(supabase, userId, publishingJobId);
    return { job: latest, error: publishingClaimFailureMessage(latest, now) };
  }

  const queueItem = await getPublishingQueueItemById(supabase, userId, publishing.content_id);
  if (!queueItem) {
    // Roll the claim back to failed — we cannot publish without queue content.
    const rolled = await updatePublishingJobRecord(supabase, userId, publishingJobId, {
      status: PublishingJobStatuses.FAILED,
      last_error: "Publishing queue item not found.",
    });
    return { job: rolled, error: "Publishing queue item not found." };
  }

  await recordPublishingEvent(supabase, {
    userId,
    businessProfileId: publishing.business_profile_id,
    job: publishing,
    action: "publish_started",
    status: publishing.status,
    auditAction: AuditActions.PUBLISHING_STARTED,
    auditStatus: "started",
  });

  try {
    const provider = getPublishingProvider(publishing.provider);
    const publishResult = await provider.publish({
      userId,
      businessProfileId: publishing.business_profile_id,
      supabase,
      input: {
        title: queueItem.title,
        body: queueItem.content,
        contentApprovalId: queueItem.content_approval_id,
        publishingQueueId: queueItem.id,
        scheduledFor: publishing.scheduled_for,
        metadata: publishing.metadata,
      },
    });

    const verification = verifyPublishedContentResult(publishing, publishResult);
    const published = await updatePublishingJobRecord(supabase, userId, publishingJobId, {
      status: verification.verified
        ? PublishingJobStatuses.VERIFIED
        : PublishingJobStatuses.PUBLISHED,
      provider_post_id: publishResult.providerPostId,
      published_at: publishResult.publishedAt,
      last_error: verification.verified ? null : verification.message,
      metadata: {
        ...publishing.metadata,
        rawResponse: publishResult.rawResponse,
        verificationHint: publishResult.verificationHint ?? {},
      },
    });

    if (!published) {
      throw new Error("Unable to save publishing job result.");
    }

    await updatePublishingQueueItem(supabase, userId, queueItem.id, {
      status: "published",
      published_at: publishResult.publishedAt,
      publish_error: null,
    });

    await recordPublishingEvent(supabase, {
      userId,
      businessProfileId: published.business_profile_id,
      job: published,
      action: verification.verified ? "verified" : "published",
      status: published.status,
      auditAction: verification.verified
        ? AuditActions.PUBLISHING_VERIFIED
        : AuditActions.PUBLISHING_COMPLETED,
      auditStatus: "success",
      details: {
        providerPostId: publishResult.providerPostId,
      },
    });

    if (verification.verified || published.status === PublishingJobStatuses.PUBLISHED) {
      const { queueAnalyticsCaptureForUser } = await import("@/lib/analytics/analyticsEngine");
      await queueAnalyticsCaptureForUser(userId, published.business_profile_id).catch(
        () => undefined
      );
    }

    return { job: published };
  } catch (error) {
    const message = toSafeUserErrorMessage(error, "Publishing failed.");
    const nextRetryCount = publishing.retry_count + 1;
    const canRetry = shouldRetryPublishing(publishing.retry_count);

    const failed = await updatePublishingJobRecord(supabase, userId, publishingJobId, {
      status: canRetry ? PublishingJobStatuses.RETRYING : PublishingJobStatuses.FAILED,
      retry_count: canRetry ? nextRetryCount : publishing.retry_count,
      scheduled_for: canRetry ? getPublishingRetryScheduledFor(nextRetryCount) : null,
      last_error: message,
    });

    await updatePublishingQueueItem(supabase, userId, queueItem.id, {
      status: "failed",
      publish_error: message,
    });

    if (failed) {
      await recordPublishingEvent(supabase, {
        userId,
        businessProfileId: failed.business_profile_id,
        job: failed,
        action: canRetry ? "retry_scheduled" : "failed",
        status: failed.status,
        auditAction: canRetry
          ? AuditActions.PUBLISHING_RETRYING
          : AuditActions.PUBLISHING_FAILED,
        auditStatus: "failure",
        error,
      });
    }

    return { job: failed, error: message };
  }
}

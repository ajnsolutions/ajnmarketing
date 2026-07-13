/**
 * Pure claim/eligibility helpers for publishing job execution.
 * No Supabase / Trigger / Next imports — unit-testable in isolation.
 *
 * Exactly-one execution is enforced by pairing these checks with a compare-and-swap
 * UPDATE in claimPublishingJobForExecution (status must still equal the expected
 * executable status). No schema migration required.
 */

import {
  PublishingJobStatuses,
  type PublishingJob,
  type PublishingJobStatus,
} from "@/lib/publishing/publishingTypes";

export const EXECUTABLE_PUBLISHING_STATUSES = [
  PublishingJobStatuses.QUEUED,
  PublishingJobStatuses.SCHEDULED,
  PublishingJobStatuses.RETRYING,
] as const;

export type ExecutablePublishingStatus = (typeof EXECUTABLE_PUBLISHING_STATUSES)[number];

export function isExecutablePublishingStatus(
  status: PublishingJobStatus | string
): status is ExecutablePublishingStatus {
  return (EXECUTABLE_PUBLISHING_STATUSES as readonly string[]).includes(status);
}

/**
 * Queued (publish-now) jobs are immediately due. Scheduled/retrying jobs require
 * scheduled_for <= now (missing scheduled_for is treated as due to avoid stuck jobs).
 */
export function isPublishingJobDue(
  job: Pick<PublishingJob, "status" | "scheduled_for">,
  now: Date = new Date()
): boolean {
  if (job.status === PublishingJobStatuses.QUEUED) return true;

  if (
    job.status === PublishingJobStatuses.SCHEDULED ||
    job.status === PublishingJobStatuses.RETRYING
  ) {
    if (!job.scheduled_for) return true;
    return new Date(job.scheduled_for).getTime() <= now.getTime();
  }

  return false;
}

export function canAttemptPublishingClaim(
  job: Pick<PublishingJob, "status" | "scheduled_for"> | null | undefined,
  now: Date = new Date()
): boolean {
  if (!job) return false;
  if (!isExecutablePublishingStatus(job.status)) return false;
  return isPublishingJobDue(job, now);
}

/**
 * Operator-safe, fixed messages for claim failures — never raw DB/provider text.
 */
export function publishingClaimFailureMessage(
  job: Pick<PublishingJob, "status" | "scheduled_for"> | null | undefined,
  now: Date = new Date()
): string {
  if (!job) return "Publishing job not found.";

  switch (job.status) {
    case PublishingJobStatuses.PUBLISHING:
      return "Publishing job is already being executed.";
    case PublishingJobStatuses.CANCELLED:
      return "Publishing job was cancelled.";
    case PublishingJobStatuses.PUBLISHED:
    case PublishingJobStatuses.VERIFIED:
      return "Publishing job has already completed.";
    case PublishingJobStatuses.FAILED:
      return "Publishing job has failed. Retry it explicitly before executing again.";
    case PublishingJobStatuses.SCHEDULED:
    case PublishingJobStatuses.RETRYING:
      if (!isPublishingJobDue(job, now)) {
        return "Publishing job is not due yet.";
      }
      return "Publishing job could not be claimed for execution.";
    case PublishingJobStatuses.QUEUED:
      return "Publishing job could not be claimed for execution.";
    default:
      return "Publishing job is not executable.";
  }
}

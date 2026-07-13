import "server-only";

/**
 * Pure helpers for publishing-due Trigger.dev fan-out. No SDK dependency.
 */

export type PublishingExecuteTaskPayload = {
  publishingJobId: string;
  userId: string;
  businessProfileId: string;
};

export type PublishingDueJobLike = {
  id: string;
  user_id: string;
  business_profile_id: string;
  status: string;
  scheduled_for: string | null;
};

/**
 * Maps due publishing jobs to per-job task payloads. Preserves due-query order.
 * Only scheduled/retrying jobs should be passed in (getDueScheduledPublishingJobs).
 */
export function buildPublishingExecuteTaskPayloads(
  jobs: PublishingDueJobLike[]
): PublishingExecuteTaskPayload[] {
  return jobs.map((job) => ({
    publishingJobId: job.id,
    userId: job.user_id,
    businessProfileId: job.business_profile_id,
  }));
}

/** Global sweep concurrency key — at most one publishing-due-sweep in flight. */
export function buildPublishingDueSweepConcurrencyKey(): string {
  return "publishing-due-sweep";
}

/** Per-job concurrency key — two executes for the same job never overlap. */
export function buildPublishingExecuteConcurrencyKey(publishingJobId: string): string {
  return publishingJobId;
}

/**
 * Hour-scoped idempotency parts so a second sweep in the same UTC hour does not
 * re-trigger the same job (retrying jobs become due again on a later hour).
 */
export function buildPublishingExecuteIdempotencyKeyParts(
  publishingJobId: string,
  hourIsoKey: string
): string[] {
  return [publishingJobId, "publishing-execute", hourIsoKey];
}

/** UTC hour key YYYY-MM-DDTHH for idempotency. */
export function publishingHourIsoKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 13);
}

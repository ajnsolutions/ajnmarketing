import test from "node:test";
import assert from "node:assert/strict";
import {
  canAttemptPublishingClaim,
  isPublishingJobDue,
  publishingClaimFailureMessage,
} from "../lib/publishing/publishingClaim.ts";
import { claimPublishingJobForExecution } from "../lib/publishing/publishingHistory.ts";
import { createFakeSupabaseClient } from "./support/fake-supabase-client.ts";
import { PublishingJobStatuses, type PublishingJob } from "../lib/publishing/publishingTypes.ts";

const NOW = new Date("2026-07-15T12:00:00.000Z");

function job(overrides: Partial<PublishingJob> = {}): PublishingJob {
  return {
    id: "job-1",
    user_id: "user-1",
    business_profile_id: "biz-1",
    content_id: "content-1",
    provider: "google_business_profile",
    provider_post_id: null,
    status: PublishingJobStatuses.SCHEDULED,
    scheduled_for: "2026-07-15T11:00:00.000Z",
    published_at: null,
    retry_count: 0,
    last_error: null,
    metadata: {},
    created_at: "2026-07-14T00:00:00.000Z",
    updated_at: "2026-07-14T00:00:00.000Z",
    ...overrides,
  };
}

test("queued jobs are always due; scheduled/retrying respect scheduled_for", () => {
  assert.equal(isPublishingJobDue(job({ status: "queued", scheduled_for: null }), NOW), true);
  assert.equal(
    isPublishingJobDue(job({ status: "scheduled", scheduled_for: "2026-07-15T11:00:00.000Z" }), NOW),
    true
  );
  assert.equal(
    isPublishingJobDue(job({ status: "scheduled", scheduled_for: "2026-07-15T13:00:00.000Z" }), NOW),
    false
  );
  assert.equal(
    isPublishingJobDue(job({ status: "retrying", scheduled_for: "2026-07-15T11:59:00.000Z" }), NOW),
    true
  );
});

test("canAttemptPublishingClaim rejects cancelled, completed, publishing, failed, and not-due", () => {
  assert.equal(canAttemptPublishingClaim(job({ status: "queued" }), NOW), true);
  assert.equal(canAttemptPublishingClaim(job({ status: "publishing" }), NOW), false);
  assert.equal(canAttemptPublishingClaim(job({ status: "cancelled" }), NOW), false);
  assert.equal(canAttemptPublishingClaim(job({ status: "published" }), NOW), false);
  assert.equal(canAttemptPublishingClaim(job({ status: "verified" }), NOW), false);
  assert.equal(canAttemptPublishingClaim(job({ status: "failed" }), NOW), false);
  assert.equal(
    canAttemptPublishingClaim(
      job({ status: "scheduled", scheduled_for: "2026-07-15T13:00:00.000Z" }),
      NOW
    ),
    false
  );
  assert.equal(canAttemptPublishingClaim(null, NOW), false);
});

test("publishingClaimFailureMessage covers cancelled, completed, not-due, already executing", () => {
  assert.match(publishingClaimFailureMessage(null, NOW), /not found/i);
  assert.match(publishingClaimFailureMessage(job({ status: "publishing" }), NOW), /already being executed/i);
  assert.match(publishingClaimFailureMessage(job({ status: "cancelled" }), NOW), /cancelled/i);
  assert.match(publishingClaimFailureMessage(job({ status: "published" }), NOW), /already completed/i);
  assert.match(publishingClaimFailureMessage(job({ status: "verified" }), NOW), /already completed/i);
  assert.match(publishingClaimFailureMessage(job({ status: "failed" }), NOW), /failed/i);
  assert.match(
    publishingClaimFailureMessage(
      job({ status: "scheduled", scheduled_for: "2026-07-15T13:00:00.000Z" }),
      NOW
    ),
    /not due/i
  );
});

test("claimPublishingJobForExecution CAS: update filters on expected status (duplicate prevention)", async () => {
  const claimed = job({ status: "publishing" });
  const { client, calls } = createFakeSupabaseClient({
    publishing_jobs: { data: claimed, error: null },
  });

  const result = await claimPublishingJobForExecution(
    client,
    "user-1",
    "job-1",
    PublishingJobStatuses.SCHEDULED,
    NOW
  );

  assert.equal(result?.status, "publishing");
  assert.ok(calls.some((c) => c.op === "update"));
  assert.ok(
    calls.some(
      (c) =>
        c.op === "eq" && c.args[0] === "status" && c.args[1] === PublishingJobStatuses.SCHEDULED
    ),
    "CAS must filter on the expected prior status"
  );
  assert.ok(calls.some((c) => c.op === "eq" && c.args[0] === "user_id" && c.args[1] === "user-1"));
});

test("claimPublishingJobForExecution returns null when another caller already won (0 rows)", async () => {
  const { client } = createFakeSupabaseClient({
    publishing_jobs: { data: null, error: null },
  });

  const result = await claimPublishingJobForExecution(
    client,
    "user-1",
    "job-1",
    PublishingJobStatuses.QUEUED,
    NOW
  );

  assert.equal(result, null);
});

test("claimPublishingJobForExecution refuses non-executable expected statuses", async () => {
  const { client, calls } = createFakeSupabaseClient({
    publishing_jobs: { data: job({ status: "publishing" }), error: null },
  });

  const result = await claimPublishingJobForExecution(
    client,
    "user-1",
    "job-1",
    PublishingJobStatuses.PUBLISHING,
    NOW
  );

  assert.equal(result, null);
  assert.equal(calls.filter((c) => c.op === "update").length, 0);
});

test("concurrent manual + worker: second claim against publishing status is not attemptable", () => {
  const firstWinner = job({ status: "publishing" });
  assert.equal(canAttemptPublishingClaim(firstWinner, NOW), false);
  assert.match(publishingClaimFailureMessage(firstWinner, NOW), /already being executed/i);
});

test("GBP disconnect / provider failure messages stay claim-eligible only before execute", () => {
  // A retrying job that is due remains claimable so the shared execute path can run
  // and surface the provider's safe error (e.g. Sync Google Business Profile...).
  const retryingDue = job({
    status: "retrying",
    scheduled_for: "2026-07-15T11:00:00.000Z",
    last_error: "Sync Google Business Profile locations before publishing.",
  });
  assert.equal(canAttemptPublishingClaim(retryingDue, NOW), true);
});

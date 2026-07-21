import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyRetrySafety,
  findStuckBackgroundJobs,
  RetrySafetyClassifications,
  STUCK_QUEUED_THRESHOLD_MINUTES,
  STUCK_RUNNING_THRESHOLD_MINUTES,
} from "../lib/ops-dashboard/jobLifecycle.ts";
import { BackgroundJobTypes } from "../lib/background-jobs/types.ts";

test("only failed or cancelled jobs are retryable at all", () => {
  assert.equal(
    classifyRetrySafety({ job_type: BackgroundJobTypes.ANALYTICS_CAPTURE, status: "queued", attempts: 0 }),
    RetrySafetyClassifications.NOT_RETRYABLE
  );
  assert.equal(
    classifyRetrySafety({ job_type: BackgroundJobTypes.ANALYTICS_CAPTURE, status: "running", attempts: 0 }),
    RetrySafetyClassifications.NOT_RETRYABLE
  );
  assert.equal(
    classifyRetrySafety({ job_type: BackgroundJobTypes.ANALYTICS_CAPTURE, status: "completed", attempts: 0 }),
    RetrySafetyClassifications.NOT_RETRYABLE
  );
});

test("idempotent job types are safe to retry when failed with attempts remaining", () => {
  for (const jobType of [
    BackgroundJobTypes.WEBSITE_ANALYSIS,
    BackgroundJobTypes.ANALYTICS_CAPTURE,
    BackgroundJobTypes.RECOMMENDATION_PIPELINE,
    BackgroundJobTypes.GOOGLE_BUSINESS_SYNC,
  ]) {
    assert.equal(
      classifyRetrySafety({ job_type: jobType, status: "failed", attempts: 1 }),
      RetrySafetyClassifications.SAFE_AND_IDEMPOTENT,
      jobType
    );
  }
});

test("publishing_execute always requires operator review, regardless of attempts", () => {
  assert.equal(
    classifyRetrySafety({ job_type: BackgroundJobTypes.PUBLISHING_EXECUTE, status: "failed", attempts: 0 }),
    RetrySafetyClassifications.REQUIRES_OPERATOR_REVIEW
  );
  assert.equal(
    classifyRetrySafety({ job_type: BackgroundJobTypes.PUBLISHING_EXECUTE, status: "cancelled", attempts: 2 }),
    RetrySafetyClassifications.REQUIRES_OPERATOR_REVIEW
  );
});

test("exhausted automatic retry budget requires operator review even for idempotent job types", () => {
  assert.equal(
    classifyRetrySafety({ job_type: BackgroundJobTypes.ANALYTICS_CAPTURE, status: "failed", attempts: 3 }),
    RetrySafetyClassifications.REQUIRES_OPERATOR_REVIEW
  );
});

test("thresholds are documented, non-zero constants", () => {
  assert.ok(STUCK_QUEUED_THRESHOLD_MINUTES > 0);
  assert.ok(STUCK_RUNNING_THRESHOLD_MINUTES > 0);
});

function fakeSupabase(rows: Array<Record<string, unknown>>) {
  return {
    from: () => ({
      select: () => ({
        in: () => ({
          gte: () => ({
            order: () => ({
              limit: () => Promise.resolve({ data: rows, error: null }),
            }),
          }),
        }),
      }),
    }),
  };
}

test("findStuckBackgroundJobs flags queued jobs past the threshold and ignores fresh ones", async () => {
  const now = Date.now();
  const staleQueued = new Date(now - (STUCK_QUEUED_THRESHOLD_MINUTES + 5) * 60000).toISOString();
  const freshQueued = new Date(now - 2 * 60000).toISOString();

  const supabase = fakeSupabase([
    {
      id: "job-stale",
      user_id: "user-1",
      business_profile_id: "biz-1",
      job_type: "analytics_capture",
      status: "queued",
      attempts: 0,
      created_at: staleQueued,
      updated_at: staleQueued,
    },
    {
      id: "job-fresh",
      user_id: "user-1",
      business_profile_id: "biz-1",
      job_type: "analytics_capture",
      status: "queued",
      attempts: 0,
      created_at: freshQueued,
      updated_at: freshQueued,
    },
  ]);

  const stuck = await findStuckBackgroundJobs(supabase as never);
  assert.equal(stuck.length, 1);
  assert.equal(stuck[0].id, "job-stale");
  assert.equal(stuck[0].reason, "queued_too_long");
});

test("findStuckBackgroundJobs flags running jobs past the (shorter) running threshold", async () => {
  const now = Date.now();
  const staleRunning = new Date(now - (STUCK_RUNNING_THRESHOLD_MINUTES + 5) * 60000).toISOString();

  const supabase = fakeSupabase([
    {
      id: "job-running-stale",
      user_id: "user-1",
      business_profile_id: "biz-1",
      job_type: "recommendation_pipeline",
      status: "running",
      attempts: 1,
      created_at: staleRunning,
      updated_at: staleRunning,
    },
  ]);

  const stuck = await findStuckBackgroundJobs(supabase as never);
  assert.equal(stuck.length, 1);
  assert.equal(stuck[0].reason, "running_too_long");
});

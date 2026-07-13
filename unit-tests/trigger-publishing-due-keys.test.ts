import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPublishingExecuteConcurrencyKey,
  buildPublishingExecuteIdempotencyKeyParts,
  buildPublishingExecuteTaskPayloads,
  buildPublishingDueSweepConcurrencyKey,
  publishingHourIsoKey,
} from "../lib/trigger/publishingDueKeys.ts";

test("buildPublishingExecuteTaskPayloads preserves due order and fields", () => {
  const payloads = buildPublishingExecuteTaskPayloads([
    {
      id: "job-1",
      user_id: "user-1",
      business_profile_id: "biz-1",
      status: "scheduled",
      scheduled_for: "2026-07-15T00:00:00.000Z",
    },
    {
      id: "job-2",
      user_id: "user-2",
      business_profile_id: "biz-2",
      status: "retrying",
      scheduled_for: "2026-07-15T01:00:00.000Z",
    },
  ]);

  assert.deepEqual(payloads, [
    { publishingJobId: "job-1", userId: "user-1", businessProfileId: "biz-1" },
    { publishingJobId: "job-2", userId: "user-2", businessProfileId: "biz-2" },
  ]);
});

test("publishing concurrency keys: global sweep + per-job execute", () => {
  assert.equal(buildPublishingDueSweepConcurrencyKey(), "publishing-due-sweep");
  assert.equal(buildPublishingExecuteConcurrencyKey("job-1"), "job-1");
  assert.notEqual(
    buildPublishingExecuteConcurrencyKey("job-1"),
    buildPublishingExecuteConcurrencyKey("job-2")
  );
});

test("publishing execute idempotency is hour-scoped per job", () => {
  const hour = publishingHourIsoKey(new Date("2026-07-15T14:30:00.000Z"));
  assert.equal(hour, "2026-07-15T14");
  assert.deepEqual(buildPublishingExecuteIdempotencyKeyParts("job-1", hour), [
    "job-1",
    "publishing-execute",
    "2026-07-15T14",
  ]);
});

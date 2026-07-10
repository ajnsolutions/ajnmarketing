import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAnalyticsCaptureTaskPayloads,
  buildAnalyticsCaptureConcurrencyKey,
  buildAnalyticsCaptureIdempotencyKeyParts,
} from "../lib/trigger/analyticsCaptureBatch.ts";
import type { AnalyticsEligibleTenant } from "../lib/analytics/analyticsEligibility.ts";

const DUE: AnalyticsEligibleTenant[] = [
  { userId: "user-1", businessProfileId: "biz-1", lastCapturedAt: null, reason: "never_captured" },
  {
    userId: "user-2",
    businessProfileId: "biz-2",
    lastCapturedAt: "2026-07-05",
    reason: "stale_snapshot",
  },
];

test("buildAnalyticsCaptureTaskPayloads maps each due tenant to a payload, preserving order and fields", () => {
  const payloads = buildAnalyticsCaptureTaskPayloads(DUE);

  assert.deepEqual(payloads, [
    { userId: "user-1", businessProfileId: "biz-1", reason: "never_captured" },
    { userId: "user-2", businessProfileId: "biz-2", reason: "stale_snapshot" },
  ]);
});

test("buildAnalyticsCaptureTaskPayloads does not re-sort or drop entries (limit/order stay the due-query's responsibility)", () => {
  const reversed = [...DUE].reverse();
  const payloads = buildAnalyticsCaptureTaskPayloads(reversed);

  assert.equal(payloads.length, 2);
  assert.equal(payloads[0].userId, "user-2");
  assert.equal(payloads[1].userId, "user-1");
});

test("buildAnalyticsCaptureConcurrencyKey returns exactly the userId (one concurrency key per tenant)", () => {
  assert.equal(buildAnalyticsCaptureConcurrencyKey("user-1"), "user-1");
  assert.equal(buildAnalyticsCaptureConcurrencyKey("user-2"), "user-2");
  assert.notEqual(
    buildAnalyticsCaptureConcurrencyKey("user-1"),
    buildAnalyticsCaptureConcurrencyKey("user-2")
  );
});

test("buildAnalyticsCaptureIdempotencyKeyParts includes userId and the date, so two different tenants never collide", () => {
  const partsA = buildAnalyticsCaptureIdempotencyKeyParts("user-1", "2026-07-15");
  const partsB = buildAnalyticsCaptureIdempotencyKeyParts("user-2", "2026-07-15");

  assert.deepEqual(partsA, ["user-1", "analytics-capture", "2026-07-15"]);
  assert.notDeepEqual(partsA, partsB);
});

test("buildAnalyticsCaptureIdempotencyKeyParts differs across days for the same tenant (so a new day is never blocked)", () => {
  const today = buildAnalyticsCaptureIdempotencyKeyParts("user-1", "2026-07-15");
  const tomorrow = buildAnalyticsCaptureIdempotencyKeyParts("user-1", "2026-07-16");

  assert.notDeepEqual(today, tomorrow);
});

test("buildAnalyticsCaptureIdempotencyKeyParts is identical for the same tenant and day across two calls (duplicate-sweep protection)", () => {
  const first = buildAnalyticsCaptureIdempotencyKeyParts("user-1", "2026-07-15");
  const second = buildAnalyticsCaptureIdempotencyKeyParts("user-1", "2026-07-15");

  assert.deepEqual(first, second);
});

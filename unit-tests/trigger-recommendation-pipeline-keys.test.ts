import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRecommendationPipelineConcurrencyKey,
  buildRecommendationPipelineIdempotencyKeyParts,
} from "../lib/trigger/recommendationPipelineKeys.ts";

test("buildRecommendationPipelineConcurrencyKey returns exactly the userId (one concurrency key per tenant)", () => {
  assert.equal(buildRecommendationPipelineConcurrencyKey("user-1"), "user-1");
  assert.equal(buildRecommendationPipelineConcurrencyKey("user-2"), "user-2");
  assert.notEqual(
    buildRecommendationPipelineConcurrencyKey("user-1"),
    buildRecommendationPipelineConcurrencyKey("user-2")
  );
});

test("buildRecommendationPipelineIdempotencyKeyParts includes userId and the date, so two different tenants never collide", () => {
  const partsA = buildRecommendationPipelineIdempotencyKeyParts("user-1", "2026-07-15");
  const partsB = buildRecommendationPipelineIdempotencyKeyParts("user-2", "2026-07-15");

  assert.deepEqual(partsA, ["user-1", "recommendation-pipeline", "2026-07-15"]);
  assert.notDeepEqual(partsA, partsB);
});

test("buildRecommendationPipelineIdempotencyKeyParts differs across days for the same tenant (so a new day is never blocked)", () => {
  const today = buildRecommendationPipelineIdempotencyKeyParts("user-1", "2026-07-15");
  const tomorrow = buildRecommendationPipelineIdempotencyKeyParts("user-1", "2026-07-16");

  assert.notDeepEqual(today, tomorrow);
});

test("buildRecommendationPipelineIdempotencyKeyParts is identical for the same tenant and day across two calls (duplicate-trigger protection)", () => {
  const first = buildRecommendationPipelineIdempotencyKeyParts("user-1", "2026-07-15");
  const second = buildRecommendationPipelineIdempotencyKeyParts("user-1", "2026-07-15");

  assert.deepEqual(first, second);
});

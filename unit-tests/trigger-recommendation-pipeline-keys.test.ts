import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRecommendationPipelineConcurrencyKey,
  buildRecommendationPipelineIdempotencyKeyParts,
  buildRecommendationPipelineTaskPayloads,
} from "../lib/trigger/recommendationPipelineKeys.ts";
import { getOnboardedBusinessesForPipeline } from "../lib/trigger/recommendationPipelineEligibility.ts";
import { createFakeSupabaseClient } from "./support/fake-supabase-client.ts";

test("buildRecommendationPipelineTaskPayloads maps tenants for scheduled_daily fan-out", () => {
  const payloads = buildRecommendationPipelineTaskPayloads(
    [
      { userId: "user-1", businessProfileId: "biz-1" },
      { userId: "user-2", businessProfileId: "biz-2" },
    ],
    "scheduled_daily"
  );

  assert.deepEqual(payloads, [
    { userId: "user-1", reason: "scheduled_daily" },
    { userId: "user-2", reason: "scheduled_daily" },
  ]);
});

test("buildRecommendationPipelineConcurrencyKey is per-tenant", () => {
  assert.equal(buildRecommendationPipelineConcurrencyKey("user-1"), "user-1");
  assert.notEqual(
    buildRecommendationPipelineConcurrencyKey("user-1"),
    buildRecommendationPipelineConcurrencyKey("user-2")
  );
});

test("buildRecommendationPipelineIdempotencyKeyParts is day-scoped and tenant-scoped", () => {
  assert.deepEqual(buildRecommendationPipelineIdempotencyKeyParts("user-1", "2026-07-15"), [
    "user-1",
    "recommendation-pipeline",
    "2026-07-15",
  ]);
  assert.notDeepEqual(
    buildRecommendationPipelineIdempotencyKeyParts("user-1", "2026-07-15"),
    buildRecommendationPipelineIdempotencyKeyParts("user-1", "2026-07-16")
  );
});

test("getOnboardedBusinessesForPipeline returns only onboarded tenants, sorted, limited", async () => {
  const { client } = createFakeSupabaseClient({
    business_profiles: {
      data: [
        { id: "biz-b", user_id: "user-b", onboarding_completed: true },
        { id: "biz-a", user_id: "user-a", onboarding_completed: true },
      ],
      error: null,
    },
  });

  const tenants = await getOnboardedBusinessesForPipeline(client, { limit: 10 });
  assert.deepEqual(
    tenants.map((t) => t.userId),
    ["user-a", "user-b"]
  );
});

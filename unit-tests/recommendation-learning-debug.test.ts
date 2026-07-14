import test from "node:test";
import assert from "node:assert/strict";
import { getRecommendationLearningDebugForUser } from "../lib/recommendation-learning/debug.ts";
import { createFakeSupabaseClient } from "./support/fake-supabase-client.ts";

const USER = "user-1";
const BIZ = "biz-1";

function recommendationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "rec-1",
    user_id: USER,
    business_profile_id: BIZ,
    recommended_action_type: "create_timely_content",
    priority_score: 61.5,
    urgency: "medium",
    business_impact: "medium",
    estimated_effort: "medium",
    confidence: 80,
    reasoning: "test",
    related_opportunity_ids: ["opp-1"],
    status: "open",
    created_at: "2026-01-15T10:00:00.000Z",
    updated_at: "2026-01-15T10:00:00.000Z",
    ...overrides,
  };
}

function opportunityRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "opp-1",
    user_id: USER,
    business_profile_id: BIZ,
    category: "holiday",
    severity: "high",
    confidence: 80,
    title: "t",
    description: "d",
    evidence: {},
    recommended_action: "a",
    expires_at: null,
    status: "open",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test("getRecommendationLearningDebugForUser: no active recommendations -> empty array", async () => {
  const { client } = createFakeSupabaseClient({
    marketing_recommendations: { data: [], error: null },
  });

  const entries = await getRecommendationLearningDebugForUser(USER, BIZ, client);
  assert.deepEqual(entries, []);
});

test("getRecommendationLearningDebugForUser: recomputes base/final score, confidence, and reasons for each active recommendation", async () => {
  const { client } = createFakeSupabaseClient({
    marketing_recommendations: (op) =>
      op === "then" ? { data: [recommendationRow()], error: null } : { data: null, error: null },
    marketing_opportunities: { data: [opportunityRow()], error: null },
    content_approvals: { data: null, error: null },
    recommendation_outcome_events: { data: [], error: null },
    publishing_queue: { data: null, error: null },
    publishing_jobs: { data: null, error: null },
    content_performance: { data: null, error: null },
  });

  const entries = await getRecommendationLearningDebugForUser(USER, BIZ, client);

  assert.equal(entries.length, 1);
  const [entry] = entries;
  assert.equal(entry.recommendationId, "rec-1");
  assert.equal(entry.actionType, "create_timely_content");
  assert.equal(entry.storedFinalScore, 61.5);
  assert.equal(entry.storedFinalConfidence, 80);
  assert.ok(typeof entry.recomputed.baseScore === "number");
  assert.ok(typeof entry.recomputed.finalScore === "number");
  assert.ok(Array.isArray(entry.recomputed.reasons));
  assert.ok(entry.recomputed.reasons.some((r) => r.reasonType === "market_opportunity"));
  // No history configured in this fixture -> cold start.
  assert.equal(entry.recomputed.historicalSampleSize, 0);
});

test("getRecommendationLearningDebugForUser: only reports recommendations scoped to the given businessProfileId", async () => {
  const { client } = createFakeSupabaseClient({
    marketing_recommendations: (op) =>
      op === "then"
        ? { data: [recommendationRow({ id: "rec-other-biz", business_profile_id: "biz-other" })], error: null }
        : { data: null, error: null },
    marketing_opportunities: { data: [], error: null },
  });

  const entries = await getRecommendationLearningDebugForUser(USER, BIZ, client);
  assert.deepEqual(entries, []);
});

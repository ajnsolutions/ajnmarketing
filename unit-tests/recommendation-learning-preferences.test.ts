import test from "node:test";
import assert from "node:assert/strict";
import { getBusinessPreferenceProfileForUser } from "../lib/recommendation-learning/preferences.ts";
import { createFakeSupabaseClient } from "./support/fake-supabase-client.ts";

const USER = "user-1";
const BIZ = "biz-1";

function recommendationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "rec-1",
    user_id: USER,
    business_profile_id: BIZ,
    recommended_action_type: "create_timely_content",
    status: "in_progress",
    related_opportunity_ids: ["opp-1"],
    created_at: "2026-01-15T10:00:00.000Z",
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

function baseClient(overrides: Record<string, unknown> = {}) {
  return createFakeSupabaseClient({
    marketing_recommendations: (op) =>
      op === "then" ? { data: [recommendationRow()], error: null } : { data: null, error: null },
    marketing_opportunities: { data: [opportunityRow()], error: null },
    content_approvals: { data: null, error: null },
    recommendation_outcome_events: { data: [], error: null },
    publishing_queue: { data: null, error: null },
    publishing_jobs: { data: null, error: null },
    content_performance: { data: null, error: null },
    ...overrides,
  });
}

test("getBusinessPreferenceProfileForUser: no history -> empty preference lists, null approval rate, zero sample size", async () => {
  const { client } = createFakeSupabaseClient({
    marketing_recommendations: { data: [], error: null },
    marketing_opportunities: { data: [], error: null },
  });

  const profile = await getBusinessPreferenceProfileForUser(USER, BIZ, client);

  assert.deepEqual(profile.preferredChannels, []);
  assert.deepEqual(profile.frequentlyRejectedTypes, []);
  assert.deepEqual(profile.preferredPostingDays, []);
  assert.equal(profile.approvalRate, null);
  assert.equal(profile.sampleSize, 0);
});

test("getBusinessPreferenceProfileForUser: below the minimum bucket sample size, no 'frequently rejected/edited' or 'highest/lowest performing' claims are made", async () => {
  // Only 1 recommendation total -- below MIN_BUCKET_SAMPLE_SIZE_FOR_REASON (3).
  const { client } = baseClient({
    content_approvals: {
      data: {
        id: "approval-1",
        user_id: USER,
        business_profile_id: BIZ,
        content_type: "Community Post",
        status: "rejected",
        marketing_recommendation_id: "rec-1",
        rejected_reason: "no",
        rejection_reason_code: "other",
        approved_at: null,
        created_at: "2026-01-15T10:30:00.000Z",
        updated_at: "2026-01-15T11:00:00.000Z",
      },
      error: null,
    },
  });

  const profile = await getBusinessPreferenceProfileForUser(USER, BIZ, client);

  assert.deepEqual(profile.frequentlyRejectedTypes, []);
  assert.deepEqual(profile.highestPerformingTypes, []);
  assert.deepEqual(profile.highestPerformingChannels, []);
});

test("getBusinessPreferenceProfileForCurrentUser requires cookies exactly like every other *ForCurrentUser wrapper", async () => {
  const { getBusinessPreferenceProfileForCurrentUser } = await import("../lib/recommendation-learning/preferences.ts");
  await assert.rejects(
    () => getBusinessPreferenceProfileForCurrentUser(BIZ),
    /next\/headers\.cookies\(\) called outside a Next\.js request context/
  );
});

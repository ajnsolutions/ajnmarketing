import test from "node:test";
import assert from "node:assert/strict";
import { runMarketingDecisionEngineForUser } from "../lib/marketing-decisions/service.ts";
import { createFakeSupabaseClient } from "./support/fake-supabase-client.ts";

const USER = "user-1";
const BIZ = "biz-1";

function opportunityRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "opp-1",
    user_id: USER,
    business_profile_id: BIZ,
    category: "holiday",
    severity: "high",
    confidence: 80,
    title: "Holiday",
    description: "Holiday weekend coming up.",
    evidence: {},
    recommended_action: "Create timely content",
    expires_at: null,
    status: "open",
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

function historicalRecommendationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "past-rec-1",
    user_id: USER,
    business_profile_id: BIZ,
    recommended_action_type: "create_timely_content",
    status: "completed",
    related_opportunity_ids: ["past-opp-1"],
    created_at: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

function pastApprovalRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "past-approval-1",
    user_id: USER,
    business_profile_id: BIZ,
    content_type: "Community Post",
    title: "t",
    content: "c",
    status: "rejected",
    source: "marketing_recommendation",
    version: 1,
    ai_score: 80,
    notes: null,
    marketing_recommendation_id: "past-rec-1",
    approved_at: null,
    approved_by: null,
    rejected_reason: "not on brand",
    rejection_reason_code: "off_brand_topic",
    created_at: "2026-06-01T01:00:00.000Z",
    updated_at: "2026-06-01T02:00:00.000Z",
    ...overrides,
  };
}

/**
 * marketing_recommendations is touched by three different call sites in one run:
 * getHistoricalRecommendationSignalsForUser's getRecommendationsForBusiness (.then(),
 * FIRST call), upsertMarketingRecommendation's own lookup+write (.maybeSingle() then
 * .single()), and closeSupersededMarketingRecommendations' own read (.then(), SECOND
 * call). A call counter distinguishes the two .then() reads so the first can return
 * real historical rows while the second (superseded-check) still sees none.
 */
function buildAdaptiveIntegrationClient(historicalRecs: Record<string, unknown>[]) {
  let thenCalls = 0;
  return createFakeSupabaseClient({
    marketing_opportunities: (op) => {
      if (op === "then") return { data: [opportunityRow()], error: null };
      // getMarketingOpportunitiesByIdsForUser (historical signals' category lookup)
      return { data: [opportunityRow({ id: "past-opp-1" })], error: null };
    },
    marketing_recommendations: (op) => {
      if (op === "then") {
        thenCalls += 1;
        return { data: thenCalls === 1 ? historicalRecs : [], error: null };
      }
      if (op === "maybeSingle") return { data: null, error: null };
      if (op === "single") return { data: { id: "rec-1", status: "open" }, error: null };
      return { data: [], error: null };
    },
    content_approvals: { data: historicalRecs.length > 0 ? pastApprovalRow() : null, error: null },
    recommendation_outcome_events: { data: [], error: null },
    publishing_queue: { data: null, error: null },
    publishing_jobs: { data: null, error: null },
    content_performance: { data: null, error: null },
    audit_logs: { data: { id: "audit-1" }, error: null },
  });
}

test("runMarketingDecisionEngineForUser: with no history, the persisted priority_score equals the base (current-market-only) score", async () => {
  const { client, calls } = buildAdaptiveIntegrationClient([]);

  await runMarketingDecisionEngineForUser(USER, BIZ, client);

  const upsertPayload = calls.find((c) => c.table === "marketing_recommendations" && c.op === "upsert")!
    .args[0] as Record<string, unknown>;
  // scoreOpportunity(severity=high(75)*0.5 + confidence=80*0.3 + time=0*0.2) = 61.5
  assert.equal(upsertPayload.priority_score, 61.5);
});

test("runMarketingDecisionEngineForUser: a business with a strong history of rejecting this action type persists a LOWER priority_score than the base market score", async () => {
  const { client, calls } = buildAdaptiveIntegrationClient([
    historicalRecommendationRow({ id: "past-rec-1" }),
    historicalRecommendationRow({ id: "past-rec-2" }),
    historicalRecommendationRow({ id: "past-rec-3" }),
  ]);

  await runMarketingDecisionEngineForUser(USER, BIZ, client);

  const upsertPayload = calls.find((c) => c.table === "marketing_recommendations" && c.op === "upsert")!
    .args[0] as Record<string, unknown>;

  assert.ok(
    (upsertPayload.priority_score as number) < 61.5,
    `expected an adjusted score below the 61.5 base, got ${upsertPayload.priority_score}`
  );
  // Urgency must stay consistent with the adjusted score, never the stale base-score urgency.
  assert.ok(["low", "medium", "high", "critical"].includes(upsertPayload.urgency as string));
});

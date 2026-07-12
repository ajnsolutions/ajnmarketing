import test from "node:test";
import assert from "node:assert/strict";
import {
  runMarketingDecisionEngineForUser,
  runMarketingDecisionEngineForCurrentUser,
} from "../lib/marketing-decisions/service.ts";
import { createFakeSupabaseClient, userIdsQueried } from "./support/fake-supabase-client.ts";

function opportunityRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "opp-1",
    user_id: "user-1",
    business_profile_id: "biz-1",
    category: "missing_gbp_posts",
    severity: "high",
    confidence: 80,
    title: "No posts",
    description: "No posts in 60 days.",
    evidence: {},
    recommended_action: "Publish a post",
    expires_at: null,
    status: "open",
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

/**
 * marketing_recommendations is touched three different ways within one run:
 * upsertMarketingRecommendation's lookup (.maybeSingle() -> no existing row),
 * its own upsert().select().single() (-> the new row), and
 * closeSupersededMarketingRecommendations' read of currently-open rows (.then() -> []
 * here, so there's nothing to supersede and the update step is never reached — the
 * supersede *logic itself* is covered precisely in marketing-decisions-persistence.test.ts;
 * this file is testing orchestration, not persistence internals).
 */
function createFakeClient(opportunities: Record<string, unknown>[]) {
  return createFakeSupabaseClient({
    marketing_opportunities: { data: opportunities, error: null },
    marketing_recommendations: (op: string) => {
      if (op === "maybeSingle") return { data: null, error: null };
      if (op === "single") return { data: { id: "rec-1", status: "open" }, error: null };
      return { data: [], error: null };
    },
    audit_logs: { data: { id: "audit-1" }, error: null },
  });
}

test("runMarketingDecisionEngineForUser: runs to completion with an injected client, no cookies needed", async () => {
  const userId = "user-1";
  const businessId = "biz-1";
  const { client } = createFakeClient([
    opportunityRow({ user_id: userId, business_profile_id: businessId }),
  ]);

  const result = await runMarketingDecisionEngineForUser(userId, businessId, client);

  assert.equal(result.recommendations.length, 1);
  assert.equal(result.evaluatedOpportunityCount, 1);
});

test("runMarketingDecisionEngineForUser: produces no recommendations when there are no active opportunities", async () => {
  const { client } = createFakeClient([]);
  const result = await runMarketingDecisionEngineForUser("user-1", "biz-1", client);

  assert.deepEqual(result.recommendations, []);
  assert.equal(result.evaluatedOpportunityCount, 0);
});

test("runMarketingDecisionEngineForUser: only evaluates opportunities scoped to the given businessProfileId", async () => {
  const userId = "user-multi-biz";
  const { client, calls } = createFakeClient([
    opportunityRow({ id: "opp-a", user_id: userId, business_profile_id: "biz-a" }),
    opportunityRow({ id: "opp-b", user_id: userId, business_profile_id: "biz-b", category: "low_review_activity" }),
  ]);

  const result = await runMarketingDecisionEngineForUser(userId, "biz-a", client);

  assert.equal(result.evaluatedOpportunityCount, 1);
  const upsertPayload = calls.find((c) => c.table === "marketing_recommendations" && c.op === "upsert")!
    .args[0] as Record<string, unknown>;
  assert.deepEqual(upsertPayload.related_opportunity_ids, ["opp-a"]);
});

test("runMarketingDecisionEngineForUser: uses the supplied userId consistently throughout the full path (tenant isolation)", async () => {
  const userA = "user-dec-a";
  const userB = "user-dec-b";

  const fakeA = createFakeClient([
    opportunityRow({ id: "opp-a", user_id: userA, business_profile_id: "biz-a" }),
  ]);
  const fakeB = createFakeClient([
    opportunityRow({ id: "opp-b", user_id: userB, business_profile_id: "biz-b" }),
  ]);

  await runMarketingDecisionEngineForUser(userA, "biz-a", fakeA.client);
  await runMarketingDecisionEngineForUser(userB, "biz-b", fakeB.client);

  const idsForA = userIdsQueried(fakeA.calls);
  const idsForB = userIdsQueried(fakeB.calls);

  assert.ok(idsForA.length > 0 && idsForA.every((id) => id === userA));
  assert.ok(idsForB.length > 0 && idsForB.every((id) => id === userB));
  assert.ok(!idsForA.includes(userB));
  assert.ok(!idsForB.includes(userA));
});

test("runMarketingDecisionEngineForUser: still defaults to the request-scoped client when no client is injected (preserves existing behavior)", async () => {
  await assert.rejects(
    () => runMarketingDecisionEngineForUser("user-1", "biz-1"),
    /next\/headers\.cookies\(\) called outside a Next\.js request context/
  );
});

test("runMarketingDecisionEngineForCurrentUser: still requires cookies exactly as before", async () => {
  await assert.rejects(
    () => runMarketingDecisionEngineForCurrentUser("biz-1"),
    /next\/headers\.cookies\(\) called outside a Next\.js request context/
  );
});

test("runMarketingDecisionEngineForUser: only reads opportunities via the active (open/in_progress) query, never all statuses", async () => {
  const { client, calls } = createFakeClient([opportunityRow()]);

  await runMarketingDecisionEngineForUser("user-1", "biz-1", client);

  // getActiveMarketingOpportunitiesForUser queries status via .in(), not .eq() -- this
  // proves the service goes through the active-only query path, which is what makes
  // dismissed/resolved opportunities invisible to the decision engine (that filtering
  // happens at the query itself, verified separately in
  // marketing-opportunities-persistence.test.ts).
  const inFilter = calls.find((c) => c.op === "in" && c.args[0] === "status");
  assert.ok(inFilter, "expected the service to use the active-opportunities query");
  assert.deepEqual(inFilter!.args[1], ["open", "in_progress"]);
});

test("runMarketingDecisionEngineForUser: logs a started and completed audit event", async () => {
  const { client, calls } = createFakeClient([opportunityRow()]);

  await runMarketingDecisionEngineForUser("user-1", "biz-1", client);

  const auditInserts = calls.filter((c) => c.table === "audit_logs" && c.op === "insert");
  assert.equal(auditInserts.length, 2);

  const [startedPayload, completedPayload] = auditInserts.map((c) => c.args[0] as Record<string, unknown>);
  assert.equal(startedPayload.action, "marketing_recommendations.generation_started");
  assert.equal(completedPayload.action, "marketing_recommendations.generation_completed");
});

test("runMarketingDecisionEngineForUser: closes superseded recommendations after persisting the current run", async () => {
  const { client, calls } = createFakeClient([opportunityRow()]);

  await runMarketingDecisionEngineForUser("user-1", "biz-1", client);

  const selectForSupersede = calls.filter((c) => c.table === "marketing_recommendations" && c.op === "then");
  assert.ok(selectForSupersede.length > 0, "expected closeSupersededMarketingRecommendations to read open rows");
});

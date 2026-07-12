import test from "node:test";
import assert from "node:assert/strict";
import {
  upsertMarketingRecommendation,
  closeSupersededMarketingRecommendations,
  getActiveMarketingRecommendationsForUser,
} from "../lib/marketing-decisions/persistence.ts";
import { createFakeSupabaseClient } from "./support/fake-supabase-client.ts";
import type { MarketingRecommendationDraft } from "../lib/marketing-decisions/types.ts";

const DRAFT: MarketingRecommendationDraft = {
  recommendedActionType: "publish_gbp_post",
  priorityScore: 60,
  urgency: "medium",
  businessImpact: "medium",
  estimatedEffort: "low",
  confidence: 80,
  reasoning: "No posts recently.",
  relatedOpportunityIds: ["opp-1"],
  dedupeKey: "opp-1",
};

function newRowFixture(row: Record<string, unknown>) {
  return (op: string) => (op === "maybeSingle" ? { data: null, error: null } : { data: row, error: null });
}

test("upsertMarketingRecommendation: sets status open for a brand new recommendation", async () => {
  const { client, calls } = createFakeSupabaseClient({
    marketing_recommendations: newRowFixture({ id: "rec-new", status: "open" }),
  });

  await upsertMarketingRecommendation(client, "user-1", "biz-1", DRAFT);

  const payload = calls.find((c) => c.op === "upsert")!.args[0] as Record<string, unknown>;
  assert.equal(payload.status, "open");
  assert.equal(payload.dedupe_key, "opp-1");
  assert.deepEqual(payload.related_opportunity_ids, ["opp-1"]);
});

test("upsertMarketingRecommendation: preserves 'open' status on regeneration of an already-open recommendation", async () => {
  const { client, calls } = createFakeSupabaseClient({
    marketing_recommendations: { data: { id: "rec-1", status: "open" }, error: null },
  });

  await upsertMarketingRecommendation(client, "user-1", "biz-1", DRAFT);

  const payload = calls.find((c) => c.op === "upsert")!.args[0] as Record<string, unknown>;
  assert.equal(payload.status, "open");
});

test("upsertMarketingRecommendation: reopens a previously superseded recommendation", async () => {
  const { client, calls } = createFakeSupabaseClient({
    marketing_recommendations: { data: { id: "rec-1", status: "superseded" }, error: null },
  });

  await upsertMarketingRecommendation(client, "user-1", "biz-1", DRAFT);

  const payload = calls.find((c) => c.op === "upsert")!.args[0] as Record<string, unknown>;
  assert.equal(payload.status, "open");
});

test("upsertMarketingRecommendation: does NOT override a dismissed recommendation's status", async () => {
  const { client, calls } = createFakeSupabaseClient({
    marketing_recommendations: { data: { id: "rec-1", status: "dismissed" }, error: null },
  });

  await upsertMarketingRecommendation(client, "user-1", "biz-1", DRAFT);

  const payload = calls.find((c) => c.op === "upsert")!.args[0] as Record<string, unknown>;
  assert.equal(payload.status, "dismissed");
});

test("upsertMarketingRecommendation: does NOT override a completed recommendation's status", async () => {
  const { client, calls } = createFakeSupabaseClient({
    marketing_recommendations: { data: { id: "rec-1", status: "completed" }, error: null },
  });

  await upsertMarketingRecommendation(client, "user-1", "biz-1", DRAFT);

  const payload = calls.find((c) => c.op === "upsert")!.args[0] as Record<string, unknown>;
  assert.equal(payload.status, "completed");
});

test("upsertMarketingRecommendation: upserts on the (user, business, dedupe_key) composite key", async () => {
  const { client, calls } = createFakeSupabaseClient({
    marketing_recommendations: newRowFixture({ id: "rec-new", status: "open" }),
  });

  await upsertMarketingRecommendation(client, "user-1", "biz-1", DRAFT);

  const options = calls.find((c) => c.op === "upsert")!.args[1] as { onConflict: string };
  assert.equal(options.onConflict, "user_id,business_profile_id,dedupe_key");
});

test("upsertMarketingRecommendation: throws clearly instead of silently swallowing a lookup error", async () => {
  const { client } = createFakeSupabaseClient({
    marketing_recommendations: { data: null, error: { message: "permission denied" } },
  });

  await assert.rejects(
    () => upsertMarketingRecommendation(client, "user-1", "biz-1", DRAFT),
    /failed to look up existing recommendation/
  );
});

test("closeSupersededMarketingRecommendations: supersedes open rows whose dedupe_key is not in the current run", async () => {
  const { client, calls } = createFakeSupabaseClient({
    marketing_recommendations: {
      data: [
        { id: "rec-keep", dedupe_key: "opp-1" },
        { id: "rec-stale", dedupe_key: "opp-2" },
      ],
      error: null,
    },
  });

  const count = await closeSupersededMarketingRecommendations(client, "user-1", "biz-1", ["opp-1"]);

  assert.equal(count, 1);
  const updateCall = calls.find((c) => c.op === "update");
  assert.deepEqual(updateCall!.args[0], { status: "superseded" });
  const inCall = calls.find((c) => c.op === "in" && c.args[0] === "id");
  assert.deepEqual(inCall!.args[1], ["rec-stale"]);
});

test("closeSupersededMarketingRecommendations: does nothing when every open row's dedupe_key is still current", async () => {
  const { client, calls } = createFakeSupabaseClient({
    marketing_recommendations: { data: [{ id: "rec-keep", dedupe_key: "opp-1" }], error: null },
  });

  const count = await closeSupersededMarketingRecommendations(client, "user-1", "biz-1", ["opp-1"]);

  assert.equal(count, 0);
  assert.ok(!calls.some((c) => c.op === "update"));
});

test("closeSupersededMarketingRecommendations: with no current recommendations at all, supersedes every open row", async () => {
  const { client } = createFakeSupabaseClient({
    marketing_recommendations: { data: [{ id: "rec-1", dedupe_key: "opp-1" }], error: null },
  });

  const count = await closeSupersededMarketingRecommendations(client, "user-1", "biz-1", []);
  assert.equal(count, 1);
});

test("closeSupersededMarketingRecommendations: throws clearly on a read error", async () => {
  const { client } = createFakeSupabaseClient({
    marketing_recommendations: { data: null, error: { message: "db down" } },
  });

  await assert.rejects(
    () => closeSupersededMarketingRecommendations(client, "user-1", "biz-1", []),
    /failed to read open recommendations/
  );
});

// --- getActiveMarketingRecommendationsForUser ---

test("getActiveMarketingRecommendationsForUser: filters status to exactly open and in_progress in the query itself", async () => {
  const { client, calls } = createFakeSupabaseClient({
    marketing_recommendations: { data: [], error: null },
  });

  await getActiveMarketingRecommendationsForUser(client, "user-1");

  const inFilter = calls.find((c) => c.op === "in" && c.args[0] === "status");
  assert.ok(inFilter, "expected an in('status', [...]) filter -- not a fetch-then-filter approach");
  assert.deepEqual(inFilter!.args[1], ["open", "in_progress"]);
  assert.ok(!(inFilter!.args[1] as string[]).includes("dismissed"));
  assert.ok(!(inFilter!.args[1] as string[]).includes("completed"));
  assert.ok(!(inFilter!.args[1] as string[]).includes("superseded"));
});

test("getActiveMarketingRecommendationsForUser: orders by priority_score desc, then created_at desc, in the query itself", async () => {
  const { client, calls } = createFakeSupabaseClient({
    marketing_recommendations: { data: [], error: null },
  });

  await getActiveMarketingRecommendationsForUser(client, "user-1");

  const orderCalls = calls.filter((c) => c.op === "order");
  assert.equal(orderCalls.length, 2);
  assert.deepEqual(orderCalls[0]!.args, ["priority_score", { ascending: false }]);
  assert.deepEqual(orderCalls[1]!.args, ["created_at", { ascending: false }]);
});

test("getActiveMarketingRecommendationsForUser: scopes to the given userId", async () => {
  const { client, calls } = createFakeSupabaseClient({
    marketing_recommendations: { data: [], error: null },
  });

  await getActiveMarketingRecommendationsForUser(client, "user-42");

  const userFilter = calls.find((c) => c.op === "eq" && c.args[0] === "user_id");
  assert.equal(userFilter!.args[1], "user-42");
});

test("getActiveMarketingRecommendationsForUser: throws clearly on a query error rather than returning an empty list", async () => {
  const { client } = createFakeSupabaseClient({
    marketing_recommendations: { data: null, error: { message: "db down" } },
  });

  await assert.rejects(
    () => getActiveMarketingRecommendationsForUser(client, "user-1"),
    /failed to read recommendations/
  );
});

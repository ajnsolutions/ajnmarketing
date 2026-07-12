import test from "node:test";
import assert from "node:assert/strict";
import {
  upsertMarketingOpportunity,
  closeExpiredMarketingOpportunities,
} from "../lib/marketing-opportunities/persistence.ts";
import { createFakeSupabaseClient } from "./support/fake-supabase-client.ts";
import type { MarketingOpportunityDraft } from "../lib/marketing-opportunities/types.ts";

/**
 * Simulates a brand-new opportunity: the initial lookup (.maybeSingle()) finds nothing,
 * but the upsert's own .select().single() still returns the newly written row, matching
 * real Supabase/Postgrest behavior (a single canned {data,error} can't model both).
 */
function newRowFixture(row: Record<string, unknown>) {
  return (op: string) => (op === "maybeSingle" ? { data: null, error: null } : { data: row, error: null });
}

const DRAFT: MarketingOpportunityDraft = {
  category: "missing_gbp_posts",
  severity: "high",
  confidence: 85,
  title: "No posts",
  description: "desc",
  evidence: { publishedPostCount: 0 },
  recommendedAction: "Publish a post",
  expiresAt: null,
  dedupeKey: "current",
};

test("upsertMarketingOpportunity: sets status open for a brand new opportunity", async () => {
  const { client, calls } = createFakeSupabaseClient({
    marketing_opportunities: newRowFixture({ id: "opp-new", status: "open" }),
  });

  await upsertMarketingOpportunity(client, "user-1", "biz-1", DRAFT);

  const upsertCall = calls.find((c) => c.op === "upsert");
  assert.ok(upsertCall, "expected an upsert call");
  const payload = upsertCall!.args[0] as Record<string, unknown>;
  assert.equal(payload.status, "open");
  assert.equal(payload.user_id, "user-1");
  assert.equal(payload.business_profile_id, "biz-1");
  assert.equal(payload.dedupe_key, "current");
});

test("upsertMarketingOpportunity: preserves 'open' status on re-detection of an already-open opportunity", async () => {
  const { client, calls } = createFakeSupabaseClient({
    marketing_opportunities: { data: { id: "opp-1", status: "open" }, error: null },
  });

  await upsertMarketingOpportunity(client, "user-1", "biz-1", DRAFT);

  const payload = calls.find((c) => c.op === "upsert")!.args[0] as Record<string, unknown>;
  assert.equal(payload.status, "open");
});

test("upsertMarketingOpportunity: reopens (status -> open) a previously expired opportunity", async () => {
  const { client, calls } = createFakeSupabaseClient({
    marketing_opportunities: { data: { id: "opp-1", status: "expired" }, error: null },
  });

  await upsertMarketingOpportunity(client, "user-1", "biz-1", DRAFT);

  const payload = calls.find((c) => c.op === "upsert")!.args[0] as Record<string, unknown>;
  assert.equal(payload.status, "open");
});

test("upsertMarketingOpportunity: does NOT override a dismissed opportunity's status back to open", async () => {
  const { client, calls } = createFakeSupabaseClient({
    marketing_opportunities: { data: { id: "opp-1", status: "dismissed" }, error: null },
  });

  await upsertMarketingOpportunity(client, "user-1", "biz-1", DRAFT);

  const payload = calls.find((c) => c.op === "upsert")!.args[0] as Record<string, unknown>;
  assert.equal(payload.status, "dismissed");
});

test("upsertMarketingOpportunity: does NOT override a resolved opportunity's status", async () => {
  const { client, calls } = createFakeSupabaseClient({
    marketing_opportunities: { data: { id: "opp-1", status: "resolved" }, error: null },
  });

  await upsertMarketingOpportunity(client, "user-1", "biz-1", DRAFT);

  const payload = calls.find((c) => c.op === "upsert")!.args[0] as Record<string, unknown>;
  assert.equal(payload.status, "resolved");
});

test("upsertMarketingOpportunity: does NOT override an in_progress opportunity's status", async () => {
  const { client, calls } = createFakeSupabaseClient({
    marketing_opportunities: { data: { id: "opp-1", status: "in_progress" }, error: null },
  });

  await upsertMarketingOpportunity(client, "user-1", "biz-1", DRAFT);

  const payload = calls.find((c) => c.op === "upsert")!.args[0] as Record<string, unknown>;
  assert.equal(payload.status, "in_progress");
});

test("upsertMarketingOpportunity: upserts on the (user, business, category, dedupe_key) composite key", async () => {
  const { client, calls } = createFakeSupabaseClient({
    marketing_opportunities: newRowFixture({ id: "opp-new", status: "open" }),
  });

  await upsertMarketingOpportunity(client, "user-1", "biz-1", DRAFT);

  const upsertCall = calls.find((c) => c.op === "upsert");
  const options = upsertCall!.args[1] as { onConflict: string };
  assert.equal(options.onConflict, "user_id,business_profile_id,category,dedupe_key");
});

test("upsertMarketingOpportunity: throws clearly instead of silently swallowing a lookup error", async () => {
  const { client } = createFakeSupabaseClient({
    marketing_opportunities: { data: null, error: { message: "permission denied" } },
  });

  await assert.rejects(
    () => upsertMarketingOpportunity(client, "user-1", "biz-1", DRAFT),
    /failed to look up existing opportunity/
  );
});

test("closeExpiredMarketingOpportunities: scopes the update to this user's open, expired rows", async () => {
  const { client, calls } = createFakeSupabaseClient({
    marketing_opportunities: { data: [{ id: "opp-1" }, { id: "opp-2" }], error: null },
  });

  const count = await closeExpiredMarketingOpportunities(client, "user-1", new Date("2026-07-11T00:00:00.000Z"));

  assert.equal(count, 2);
  const updateCall = calls.find((c) => c.op === "update");
  assert.deepEqual(updateCall!.args[0], { status: "expired" });

  const userFilter = calls.find((c) => c.op === "eq" && c.args[0] === "user_id");
  assert.equal(userFilter!.args[1], "user-1");
  const statusFilter = calls.find((c) => c.op === "eq" && c.args[0] === "status");
  assert.equal(statusFilter!.args[1], "open");
  const ltFilter = calls.find((c) => c.op === "lt" && c.args[0] === "expires_at");
  assert.equal(ltFilter!.args[1], "2026-07-11T00:00:00.000Z");
});

test("closeExpiredMarketingOpportunities: returns 0 when nothing was expired", async () => {
  const { client } = createFakeSupabaseClient({
    marketing_opportunities: { data: [], error: null },
  });

  const count = await closeExpiredMarketingOpportunities(client, "user-1");
  assert.equal(count, 0);
});

test("closeExpiredMarketingOpportunities: throws clearly on a query error", async () => {
  const { client } = createFakeSupabaseClient({
    marketing_opportunities: { data: null, error: { message: "db down" } },
  });

  await assert.rejects(() => closeExpiredMarketingOpportunities(client, "user-1"), /failed to close expired rows/);
});

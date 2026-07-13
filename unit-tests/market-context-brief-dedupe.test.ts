import test from "node:test";
import assert from "node:assert/strict";
import { upsertMarketContextBriefGenerating } from "../lib/market-context/persistence.ts";
import { createFakeSupabaseClient } from "./support/fake-supabase-client.ts";

const USER = "user-1";
const BIZ = "biz-1";
const START = "2026-07-06";
const END = "2026-07-12";

function briefRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "mcb-1",
    user_id: USER,
    business_profile_id: BIZ,
    brief_start_date: START,
    brief_end_date: END,
    overall_summary: "",
    recommended_topics: [],
    high_opportunity_keywords: [],
    content_angles: [],
    selected_context_item_ids: [],
    status: "generating",
    created_at: "2026-07-12T00:00:00.000Z",
    updated_at: "2026-07-12T00:00:00.000Z",
    ...overrides,
  };
}

test("upsertMarketContextBriefGenerating: claims a new week via upsert when none exists", async () => {
  let upsertPayload: Record<string, unknown> | null = null;
  const { client, calls } = createFakeSupabaseClient({
    market_context_briefs: (op) => {
      if (op === "maybeSingle") return { data: null, error: null };
      if (op === "single") return { data: briefRow({ status: "generating" }), error: null };
      return { data: null, error: null };
    },
  });

  // Capture upsert args via call recording after the fact.
  const result = await upsertMarketContextBriefGenerating(client, {
    userId: USER,
    businessProfileId: BIZ,
    briefStartDate: START,
    briefEndDate: END,
  });

  const upsertCall = calls.find((c) => c.op === "upsert");
  assert.ok(upsertCall);
  upsertPayload = upsertCall.args[0] as Record<string, unknown>;
  assert.equal(upsertPayload.status, "generating");
  assert.equal(upsertPayload.user_id, USER);
  assert.equal(upsertPayload.brief_start_date, START);
  assert.equal(result.alreadyGenerating, false);
  assert.equal(result.brief?.id, "mcb-1");
  assert.equal(
    (upsertCall.args[1] as { onConflict?: string }).onConflict,
    "user_id,brief_start_date,brief_end_date"
  );
});

test("upsertMarketContextBriefGenerating: does not overwrite an in-flight generating brief", async () => {
  const { client, calls } = createFakeSupabaseClient({
    market_context_briefs: {
      data: briefRow({ status: "generating" }),
      error: null,
    },
  });

  const result = await upsertMarketContextBriefGenerating(client, {
    userId: USER,
    businessProfileId: BIZ,
    briefStartDate: START,
    briefEndDate: END,
  });

  assert.equal(result.alreadyGenerating, true);
  assert.equal(result.brief, null);
  assert.equal(calls.some((c) => c.op === "upsert"), false);
});

test("upsertMarketContextBriefGenerating: reclaims an active/failed week via upsert", async () => {
  const { client, calls } = createFakeSupabaseClient({
    market_context_briefs: (op) => {
      if (op === "maybeSingle") {
        return { data: briefRow({ status: "active", id: "mcb-old" }), error: null };
      }
      if (op === "single") {
        return { data: briefRow({ status: "generating", id: "mcb-old" }), error: null };
      }
      return { data: null, error: null };
    },
  });

  const result = await upsertMarketContextBriefGenerating(client, {
    userId: USER,
    businessProfileId: BIZ,
    briefStartDate: START,
    briefEndDate: END,
  });

  assert.equal(result.alreadyGenerating, false);
  assert.equal(result.brief?.id, "mcb-old");
  assert.equal(calls.some((c) => c.op === "upsert"), true);
});

test("upsertMarketContextBriefGenerating: 23505 race re-reads and reports alreadyGenerating", async () => {
  let maybeSingleReads = 0;
  const { client } = createFakeSupabaseClient({
    market_context_briefs: (op) => {
      if (op === "maybeSingle") {
        maybeSingleReads += 1;
        // First lookup: no row. After upsert 23505: generating row exists.
        if (maybeSingleReads === 1) return { data: null, error: null };
        return { data: briefRow({ status: "generating", id: "mcb-winner" }), error: null };
      }
      if (op === "single") {
        return { data: null, error: { code: "23505", message: "duplicate key value" } };
      }
      return { data: null, error: null };
    },
  });

  const result = await upsertMarketContextBriefGenerating(client, {
    userId: USER,
    businessProfileId: BIZ,
    briefStartDate: START,
    briefEndDate: END,
  });

  assert.equal(result.alreadyGenerating, true);
  assert.equal(result.brief, null);
  assert.equal(maybeSingleReads, 2);
});

test("concurrent claim simulation: second caller sees generating and does not upsert", async () => {
  // Models two sequential claims against the same fake store after the first has written.
  const store = { row: null as Record<string, unknown> | null };

  function clientForStore() {
    return createFakeSupabaseClient({
      market_context_briefs: (op) => {
        if (op === "maybeSingle") {
          return { data: store.row, error: null };
        }
        if (op === "upsert") {
          // Handled via call recording; response comes from single().
          return { data: null, error: null };
        }
        if (op === "single") {
          store.row = briefRow({ status: "generating", id: "mcb-shared" });
          return { data: store.row, error: null };
        }
        return { data: store.row, error: null };
      },
    });
  }

  const first = await upsertMarketContextBriefGenerating(clientForStore().client, {
    userId: USER,
    businessProfileId: BIZ,
    briefStartDate: START,
    briefEndDate: END,
  });
  assert.equal(first.alreadyGenerating, false);
  assert.equal(first.brief?.id, "mcb-shared");

  const second = await upsertMarketContextBriefGenerating(clientForStore().client, {
    userId: USER,
    businessProfileId: BIZ,
    briefStartDate: START,
    briefEndDate: END,
  });
  assert.equal(second.alreadyGenerating, true);
  assert.equal(second.brief, null);
});

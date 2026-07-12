import test from "node:test";
import assert from "node:assert/strict";
import {
  createContentApprovalWithConflict,
  getActiveContentApprovalForRecommendation,
} from "../lib/content-approval/persistence.ts";
import { createFakeSupabaseClient } from "./support/fake-supabase-client.ts";

const USER = "user-1";
const REC_ID = "rec-1";

function approvalRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "approval-1",
    user_id: USER,
    business_profile_id: "biz-1",
    content_type: "Community Post",
    title: "Draft",
    content: "Body",
    status: "pending",
    source: "marketing_recommendation",
    version: 1,
    ai_score: 80,
    notes: null,
    marketing_recommendation_id: REC_ID,
    approved_at: null,
    approved_by: null,
    rejected_reason: null,
    created_at: "2026-07-11T00:00:00.000Z",
    updated_at: "2026-07-11T00:00:00.000Z",
    ...overrides,
  };
}

// --- getActiveContentApprovalForRecommendation ---

test("getActiveContentApprovalForRecommendation: filters status to exactly pending, approved, published", async () => {
  const { client, calls } = createFakeSupabaseClient({
    content_approvals: { data: null, error: null },
  });

  await getActiveContentApprovalForRecommendation(client, USER, REC_ID);

  const inFilter = calls.find((c) => c.op === "in" && c.args[0] === "status");
  assert.ok(inFilter, "expected an in('status', [...]) filter");
  assert.deepEqual(inFilter!.args[1], ["pending", "approved", "published"]);
  assert.ok(!(inFilter!.args[1] as string[]).includes("rejected"));
});

test("getActiveContentApprovalForRecommendation: scopes to both userId and recommendationId", async () => {
  const { client, calls } = createFakeSupabaseClient({
    content_approvals: { data: approvalRow(), error: null },
  });

  await getActiveContentApprovalForRecommendation(client, USER, REC_ID);

  const userFilter = calls.find((c) => c.op === "eq" && c.args[0] === "user_id");
  const recFilter = calls.find((c) => c.op === "eq" && c.args[0] === "marketing_recommendation_id");
  assert.equal(userFilter!.args[1], USER);
  assert.equal(recFilter!.args[1], REC_ID);
});

test("getActiveContentApprovalForRecommendation: returns null when nothing active exists (rejected rows do not block regeneration)", async () => {
  // A rejected-only history is represented here by the query returning nothing --
  // the exclusion happens at the query itself (status filter above), which is what
  // actually keeps rejected rows from blocking regeneration in production.
  const { client } = createFakeSupabaseClient({
    content_approvals: { data: null, error: null },
  });

  const result = await getActiveContentApprovalForRecommendation(client, USER, REC_ID);
  assert.equal(result, null);
});

test("getActiveContentApprovalForRecommendation: returns null (not throw) on a query error", async () => {
  const { client } = createFakeSupabaseClient({
    content_approvals: { data: null, error: { message: "db down" } },
  });

  const result = await getActiveContentApprovalForRecommendation(client, USER, REC_ID);
  assert.equal(result, null);
});

// --- createContentApprovalWithConflict ---

const CREATE_INPUT = {
  userId: USER,
  businessProfileId: "biz-1",
  data: {
    content_type: "Community Post",
    title: "Draft",
    content: "Body",
    source: "marketing_recommendation",
    marketing_recommendation_id: REC_ID,
  },
};

test("createContentApprovalWithConflict: a 23505 error is treated as the expected recommendation-draft race", async () => {
  const { client } = createFakeSupabaseClient({
    content_approvals: { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } },
  });

  const result = await createContentApprovalWithConflict(client, CREATE_INPUT);

  assert.equal(result.uniqueViolation, true);
  assert.equal(result.approval, null);
});

test("createContentApprovalWithConflict: a non-23505 error is treated as a real failure, not a race", async () => {
  const { client } = createFakeSupabaseClient({
    content_approvals: { data: null, error: { code: "42501", message: "permission denied for table content_approvals" } },
  });

  const result = await createContentApprovalWithConflict(client, CREATE_INPUT);

  assert.equal(result.uniqueViolation, false);
  assert.equal(result.approval, null);
  assert.equal((result as { error: { code?: string } }).error.code, "42501");
});

test("createContentApprovalWithConflict: an error with no code at all is treated as a real failure, not a race", async () => {
  const { client } = createFakeSupabaseClient({
    content_approvals: { data: null, error: { message: "network error" } },
  });

  const result = await createContentApprovalWithConflict(client, CREATE_INPUT);
  assert.equal(result.uniqueViolation, false);
});

test("createContentApprovalWithConflict: success returns the inserted approval with uniqueViolation false", async () => {
  const { client } = createFakeSupabaseClient({
    content_approvals: { data: approvalRow(), error: null },
  });

  const result = await createContentApprovalWithConflict(client, CREATE_INPUT);

  assert.equal(result.uniqueViolation, false);
  assert.ok(result.approval);
  assert.equal(result.approval!.id, "approval-1");
});

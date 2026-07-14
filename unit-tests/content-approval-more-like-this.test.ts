import test from "node:test";
import assert from "node:assert/strict";
import { patchContentApprovalForUser } from "../lib/content-approval/service.ts";
import { createFakeSupabaseClient } from "./support/fake-supabase-client.ts";

const USER = "user-1";
const BIZ = "biz-1";
const REC_ID = "rec-1";
const APPROVAL_ID = "approval-1";

function approvalRow(overrides: Record<string, unknown> = {}) {
  return {
    id: APPROVAL_ID,
    user_id: USER,
    business_profile_id: BIZ,
    content_type: "Google Business Profile Post",
    title: "Holiday Ready",
    content: "Book your visit today.",
    status: "approved",
    source: "marketing_recommendation",
    version: 1,
    ai_score: 88,
    notes: null,
    marketing_recommendation_id: REC_ID,
    approved_at: "2026-01-16T00:00:00.000Z",
    approved_by: USER,
    rejected_reason: null,
    rejection_reason_code: null,
    created_at: "2026-01-15T00:00:00.000Z",
    updated_at: "2026-01-16T00:00:00.000Z",
    ...overrides,
  };
}

function buildClient(approval: Record<string, unknown>) {
  return createFakeSupabaseClient({
    content_approvals: (op) => (op === "maybeSingle" ? { data: approval, error: null } : { data: approval, error: null }),
    recommendation_outcome_events: { data: { id: "event-1" }, error: null },
  });
}

test("patchContentApprovalForUser: 'more_like_this' records exactly one do_more_like_this event, never mutates the approval", async () => {
  const { client, calls } = buildClient(approvalRow());

  const result = await patchContentApprovalForUser(USER, { id: APPROVAL_ID, action: "more_like_this" }, client);

  const insertCalls = calls.filter((c) => c.table === "recommendation_outcome_events" && c.op === "insert");
  assert.equal(insertCalls.length, 1);
  const args = insertCalls[0].args[0] as Record<string, unknown>;
  assert.equal(args.event_type, "do_more_like_this");
  assert.equal(args.recommendation_id, REC_ID);
  assert.equal(args.content_approval_id, APPROVAL_ID);

  // The approval itself is returned unchanged -- no status/title/content mutation.
  assert.equal(result?.status, "approved");
  assert.equal(result?.title, "Holiday Ready");

  const updateCalls = calls.filter((c) => c.table === "content_approvals" && c.op === "update");
  assert.equal(updateCalls.length, 0);
});

test("patchContentApprovalForUser: 'more_like_this' is idempotent -- the underlying event insert is keyed per draft", async () => {
  // The idempotency guarantee itself (unique-violation -> duplicate: true) is already
  // covered by recordDoMoreLikeThisOutcome's own dedicated test in
  // unit-tests/recommendation-outcomes.test.ts; this proves the wiring calls it with a
  // stable, content-approval-scoped idempotency key so a repeat click is a no-op there.
  const { client: clientA, calls: callsA } = buildClient(approvalRow());
  const { client: clientB, calls: callsB } = buildClient(approvalRow());

  await patchContentApprovalForUser(USER, { id: APPROVAL_ID, action: "more_like_this" }, clientA);
  await patchContentApprovalForUser(USER, { id: APPROVAL_ID, action: "more_like_this" }, clientB);

  const keyA = callsA.find((c) => c.table === "recommendation_outcome_events" && c.op === "insert")!
    .args[0] as Record<string, unknown>;
  const keyB = callsB.find((c) => c.table === "recommendation_outcome_events" && c.op === "insert")!
    .args[0] as Record<string, unknown>;
  assert.equal(keyA.idempotency_key, keyB.idempotency_key);
});

test("patchContentApprovalForUser: 'more_like_this' on content with no marketing_recommendation_id is a safe no-op", async () => {
  const { client, calls } = buildClient(approvalRow({ marketing_recommendation_id: null }));

  const result = await patchContentApprovalForUser(USER, { id: APPROVAL_ID, action: "more_like_this" }, client);

  const insertCalls = calls.filter((c) => c.table === "recommendation_outcome_events" && c.op === "insert");
  assert.equal(insertCalls.length, 0);
  assert.equal(result?.id, APPROVAL_ID);
});

test("patchContentApprovalForUser: 'more_like_this' never changes status to approved or published (no auto-approve, no auto-publish)", async () => {
  const { client } = buildClient(approvalRow({ status: "rejected", approved_at: null }));

  const result = await patchContentApprovalForUser(USER, { id: APPROVAL_ID, action: "more_like_this" }, client);

  assert.equal(result?.status, "rejected");
});

test("patchContentApprovalForUser: an approval that does not belong to this tenant returns null (cross-tenant rejected)", async () => {
  const { client } = createFakeSupabaseClient({
    content_approvals: { data: null, error: null },
  });

  const result = await patchContentApprovalForUser(USER, { id: APPROVAL_ID, action: "more_like_this" }, client);
  assert.equal(result, null);
});

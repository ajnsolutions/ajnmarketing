import test from "node:test";
import assert from "node:assert/strict";
import {
  executeApproveAllForUser,
  executeApproveForUser,
  executeRejectForUser,
} from "../lib/email-actions/service.ts";
import { createFakeSupabaseClient } from "./support/fake-supabase-client.ts";

const USER = "user-1";
const BIZ = "biz-1";
const APPROVAL_ID = "ca-1";

function approvalRow(overrides: Record<string, unknown> = {}) {
  return {
    id: APPROVAL_ID,
    user_id: USER,
    business_profile_id: BIZ,
    content_type: "Google Business Profile Post",
    title: "Holiday hours",
    content: "We are open this weekend.",
    status: "pending",
    source: "marketing_recommendation",
    version: 1,
    ai_score: 80,
    notes: null,
    marketing_recommendation_id: "rec-1",
    approved_at: null,
    approved_by: null,
    rejected_reason: null,
    rejection_reason_code: null,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

/**
 * Models "the update actually changed the row" statefully -- the first `single()` call
 * (the write) flips a flag so every read afterward (maybeSingle/then) sees the
 * post-write state. This lets replay tests prove a second call never re-invokes the
 * write.
 */
function buildApprovalClient(initialRow: Record<string, unknown>, updatedFields: Record<string, unknown> = {}) {
  let updated = false;
  return createFakeSupabaseClient({
    content_approvals: (op) => {
      if (op === "single") {
        updated = true;
        return { data: { ...initialRow, ...updatedFields }, error: null };
      }
      return { data: updated ? { ...initialRow, ...updatedFields } : initialRow, error: null };
    },
    recommendation_outcome_events: { data: { id: "event-1" }, error: null },
  });
}

test("executeApproveForUser: pending -> approved (done), invokes the authoritative mutation exactly once", async () => {
  const { client, calls } = buildApprovalClient(approvalRow(), { status: "approved", approved_at: "2026-07-05T00:00:00.000Z" });

  const outcome = await executeApproveForUser(client, USER, BIZ, APPROVAL_ID);

  assert.equal(outcome, "done");
  const updateCalls = calls.filter((c) => c.table === "content_approvals" && c.op === "update");
  assert.equal(updateCalls.length, 1);
});

test("executeApproveForUser: replay after approval returns already_done, never re-invokes the mutation", async () => {
  const { client, calls } = buildApprovalClient(approvalRow(), { status: "approved", approved_at: "2026-07-05T00:00:00.000Z" });

  const first = await executeApproveForUser(client, USER, BIZ, APPROVAL_ID);
  const second = await executeApproveForUser(client, USER, BIZ, APPROVAL_ID);

  assert.equal(first, "done");
  assert.equal(second, "already_done");
  const updateCalls = calls.filter((c) => c.table === "content_approvals" && c.op === "update");
  assert.equal(updateCalls.length, 1, "the second (replayed) call must not write again");
});

test("executeApproveForUser: already-published content is reported as already_done, not re-approved", async () => {
  const { client, calls } = buildApprovalClient(approvalRow({ status: "published" }));

  const outcome = await executeApproveForUser(client, USER, BIZ, APPROVAL_ID);

  assert.equal(outcome, "already_done");
  assert.equal(calls.filter((c) => c.op === "update").length, 0);
});

test("executeApproveForUser: rejected content is not_pending (can't be approved from this link)", async () => {
  const { client } = buildApprovalClient(approvalRow({ status: "rejected" }));

  const outcome = await executeApproveForUser(client, USER, BIZ, APPROVAL_ID);

  assert.equal(outcome, "not_pending");
});

test("executeApproveForUser: unknown contentApprovalId is not_found", async () => {
  const { client, calls } = createFakeSupabaseClient({
    content_approvals: { data: null, error: null },
  });

  const outcome = await executeApproveForUser(client, USER, BIZ, "does-not-exist");

  assert.equal(outcome, "not_found");
  assert.equal(calls.filter((c) => c.op === "update").length, 0);
});

test("executeApproveForUser: cross-tenant businessProfileId mismatch is not_found, never approved", async () => {
  // The row exists (and getContentApprovalById's own userId filter would even match if
  // the userId happened to line up), but it belongs to a different business profile --
  // defense-in-depth beyond the userId check alone.
  const { client, calls } = buildApprovalClient(approvalRow({ business_profile_id: "biz-OTHER" }));

  const outcome = await executeApproveForUser(client, USER, BIZ, APPROVAL_ID);

  assert.equal(outcome, "not_found");
  assert.equal(calls.filter((c) => c.op === "update").length, 0);
});

test("executeApproveAllForUser: continues past an ineligible item and reports partial results (Phase 4)", async () => {
  // The fake client resolves one canned response per table for every call, so it can't
  // model three different underlying rows behind independent .eq("id", x) filters in a
  // single executeApproveAllForUser invocation. executeApproveForUser (exercised above
  // per-status) already proves each individual outcome; what's specific to
  // executeApproveAllForUser is that it aggregates per-id results without aborting on a
  // non-"done" outcome, which this drives with a single ineligible row repeated for
  // every id in the snapshot.
  const { client } = buildApprovalClient(approvalRow({ status: "rejected" }));

  const result = await executeApproveAllForUser(client, USER, BIZ, ["ca-1", "ca-2", "ca-3"]);

  assert.equal(result.items.length, 3);
  assert.ok(result.items.every((item) => item.outcome === "not_pending"));
  assert.deepEqual(
    result.items.map((i) => i.contentApprovalId),
    ["ca-1", "ca-2", "ca-3"]
  );
});

test("executeApproveAllForUser: only iterates the ids passed in (immutable package membership) -- never queries beyond the snapshot", async () => {
  const { client, calls } = buildApprovalClient(approvalRow(), { status: "approved" });

  const result = await executeApproveAllForUser(client, USER, BIZ, [APPROVAL_ID]);

  assert.equal(result.action, "approve_all");
  assert.deepEqual(result.items, [{ contentApprovalId: APPROVAL_ID, outcome: "done" }]);
  // Every .eq("id", ...) filter used across the call must be for this one snapshot id --
  // proves no broader "all pending" re-query occurs and no other item is touched.
  const idFilters = calls.filter((c) => c.op === "eq" && c.args[0] === "id");
  assert.ok(idFilters.length > 0);
  assert.ok(idFilters.every((c) => c.args[1] === APPROVAL_ID));
});

test("executeApproveAllForUser: empty snapshot resolves with no items and no queries", async () => {
  const { client, calls } = createFakeSupabaseClient({});

  const result = await executeApproveAllForUser(client, USER, BIZ, []);

  assert.deepEqual(result.items, []);
  assert.equal(calls.filter((c) => c.table === "content_approvals").length, 0);
});

test("executeRejectForUser: pending -> rejected (done) with a valid structured reason", async () => {
  const { client, calls } = buildApprovalClient(approvalRow(), {
    status: "rejected",
    rejected_reason: "Too pushy",
    rejection_reason_code: "too_promotional",
  });

  const outcome = await executeRejectForUser(client, USER, BIZ, APPROVAL_ID, "too_promotional", "Too pushy");

  assert.equal(outcome, "done");
  assert.equal(calls.filter((c) => c.table === "content_approvals" && c.op === "update").length, 1);
});

test("executeRejectForUser: invalid reason code is rejected before the mutation ever runs", async () => {
  const { client, calls } = buildApprovalClient(approvalRow());

  const outcome = await executeRejectForUser(client, USER, BIZ, APPROVAL_ID, "not_a_real_reason", undefined);

  assert.equal(outcome, "invalid_reason");
  assert.equal(calls.filter((c) => c.op === "update").length, 0);
});

test("executeRejectForUser: missing reason code is rejected the same as an invalid one", async () => {
  const { client, calls } = buildApprovalClient(approvalRow());

  const outcome = await executeRejectForUser(client, USER, BIZ, APPROVAL_ID, undefined, undefined);

  assert.equal(outcome, "invalid_reason");
  assert.equal(calls.filter((c) => c.op === "update").length, 0);
});

test("executeRejectForUser: replay after rejection returns already_done, never re-invokes the mutation", async () => {
  const { client, calls } = buildApprovalClient(approvalRow(), { status: "rejected", rejection_reason_code: "other" });

  const first = await executeRejectForUser(client, USER, BIZ, APPROVAL_ID, "other", undefined);
  const second = await executeRejectForUser(client, USER, BIZ, APPROVAL_ID, "other", undefined);

  assert.equal(first, "done");
  assert.equal(second, "already_done");
  assert.equal(calls.filter((c) => c.op === "update").length, 1);
});

test("executeRejectForUser: cross-tenant businessProfileId mismatch is not_found, never rejected", async () => {
  const { client, calls } = buildApprovalClient(approvalRow({ business_profile_id: "biz-OTHER" }));

  const outcome = await executeRejectForUser(client, USER, BIZ, APPROVAL_ID, "too_promotional", undefined);

  assert.equal(outcome, "not_found");
  assert.equal(calls.filter((c) => c.op === "update").length, 0);
});

test("executeRejectForUser: already-approved content cannot be rejected from this link (not_pending)", async () => {
  const { client } = buildApprovalClient(approvalRow({ status: "approved" }));

  const outcome = await executeRejectForUser(client, USER, BIZ, APPROVAL_ID, "too_promotional", undefined);

  assert.equal(outcome, "not_pending");
});

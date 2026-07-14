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
    status: "pending",
    source: "marketing_recommendation",
    version: 1,
    ai_score: 88,
    notes: null,
    marketing_recommendation_id: REC_ID,
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
 * Client covering patchContentApprovalForUser's full read-then-write chain plus this
 * milestone's outcome-event insert. content_approvals needs to distinguish the initial
 * maybeSingle lookup (existing row) from the update's own maybeSingle/single result --
 * a stateful closure models "the update actually changed the row".
 */
function buildPatchClient(initialApproval: Record<string, unknown>, updatedFields: Record<string, unknown> = {}) {
  let updated = false;
  return createFakeSupabaseClient({
    content_approvals: (op) => {
      if (op === "maybeSingle") {
        return { data: initialApproval, error: null };
      }
      if (op === "single") {
        updated = true;
        return { data: { ...initialApproval, ...updatedFields }, error: null };
      }
      return { data: updated ? { ...initialApproval, ...updatedFields } : initialApproval, error: null };
    },
    recommendation_outcome_events: { data: { id: "event-1" }, error: null },
  });
}

test("patchContentApprovalForUser: approve records a draft_approved outcome event when recommendation-linked", async () => {
  const { client, calls } = buildPatchClient(approvalRow(), {
    status: "approved",
    approved_at: "2026-07-05T00:00:00.000Z",
  });

  await patchContentApprovalForUser(USER, { id: APPROVAL_ID, action: "approve" }, client);

  const insertCalls = calls.filter((c) => c.table === "recommendation_outcome_events" && c.op === "insert");
  assert.equal(insertCalls.length, 1);
  const args = insertCalls[0].args[0] as Record<string, unknown>;
  assert.equal(args.event_type, "draft_approved");
  assert.equal(args.recommendation_id, REC_ID);
  assert.equal(args.content_approval_id, APPROVAL_ID);
});

test("patchContentApprovalForUser: approving content with no marketing_recommendation_id records no outcome event", async () => {
  const { client, calls } = buildPatchClient(approvalRow({ marketing_recommendation_id: null }), {
    status: "approved",
  });

  await patchContentApprovalForUser(USER, { id: APPROVAL_ID, action: "approve" }, client);

  const insertCalls = calls.filter((c) => c.table === "recommendation_outcome_events" && c.op === "insert");
  assert.equal(insertCalls.length, 0);
});

test("patchContentApprovalForUser: reject records a draft_rejected outcome event with the structured reason code", async () => {
  const { client, calls } = buildPatchClient(approvalRow(), {
    status: "rejected",
    rejected_reason: "Too pushy",
    rejection_reason_code: "too_promotional",
  });

  await patchContentApprovalForUser(
    USER,
    {
      id: APPROVAL_ID,
      action: "reject",
      rejected_reason: "Too pushy",
      rejection_reason_code: "too_promotional",
    },
    client
  );

  const insertCalls = calls.filter((c) => c.table === "recommendation_outcome_events" && c.op === "insert");
  assert.equal(insertCalls.length, 1);
  const args = insertCalls[0].args[0] as Record<string, unknown>;
  assert.equal(args.event_type, "draft_rejected");
  assert.equal((args.metadata as Record<string, unknown>).reasonCode, "too_promotional");
});

test("patchContentApprovalForUser: rejecting without a reason code still records the event, normalized to 'other'", async () => {
  const { client, calls } = buildPatchClient(approvalRow(), { status: "rejected" });

  await patchContentApprovalForUser(USER, { id: APPROVAL_ID, action: "reject" }, client);

  const insertCalls = calls.filter((c) => c.table === "recommendation_outcome_events" && c.op === "insert");
  const args = insertCalls[0].args[0] as Record<string, unknown>;
  assert.equal((args.metadata as Record<string, unknown>).reasonCode, "other");
});

test("patchContentApprovalForUser: a meaningful edit (default/update action) records a draft_edited outcome event", async () => {
  const { client, calls } = buildPatchClient(approvalRow(), { title: "New Holiday Title" });

  await patchContentApprovalForUser(
    USER,
    {
      id: APPROVAL_ID,
      title: "New Holiday Title",
      content: approvalRow().content,
    },
    client
  );

  const insertCalls = calls.filter((c) => c.table === "recommendation_outcome_events" && c.op === "insert");
  assert.equal(insertCalls.length, 1);
  const args = insertCalls[0].args[0] as Record<string, unknown>;
  assert.equal(args.event_type, "draft_edited");
  assert.equal((args.metadata as Record<string, unknown>).titleChanged, true);
  assert.equal((args.metadata as Record<string, unknown>).bodyChanged, false);
});

test("patchContentApprovalForUser: saving identical title/content records no draft_edited event", async () => {
  const original = approvalRow();
  const { client, calls } = buildPatchClient(original);

  await patchContentApprovalForUser(
    USER,
    {
      id: APPROVAL_ID,
      title: original.title,
      content: original.content,
    },
    client
  );

  const insertCalls = calls.filter((c) => c.table === "recommendation_outcome_events" && c.op === "insert");
  assert.equal(insertCalls.length, 0);
});

test("patchContentApprovalForUser: edit metadata never contains the raw before/after content, only structured fields", async () => {
  const { client, calls } = buildPatchClient(approvalRow(), { content: "Totally different new content here" });

  await patchContentApprovalForUser(
    USER,
    {
      id: APPROVAL_ID,
      title: approvalRow().title,
      content: "Totally different new content here",
    },
    client
  );

  const insertCalls = calls.filter((c) => c.table === "recommendation_outcome_events" && c.op === "insert");
  const args = insertCalls[0].args[0] as Record<string, unknown>;
  const serialized = JSON.stringify(args);
  assert.equal(serialized.includes("Totally different new content here"), false);
  assert.deepEqual(Object.keys(args.metadata as Record<string, unknown>).sort(), [
    "bodyChanged",
    "channelChanged",
    "fieldsChanged",
    "textLengthDelta",
    "titleChanged",
  ]);
});

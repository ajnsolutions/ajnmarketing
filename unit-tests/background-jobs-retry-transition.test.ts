import assert from "node:assert/strict";
import test from "node:test";
import { resetBackgroundJobForRetry } from "../lib/background-jobs/persistence.ts";

/**
 * Covers the shared DB safe-transition primitive reused by both the customer
 * self-service retry (PATCH /api/jobs) and the Phase 3C admin cross-tenant retry
 * (POST /api/admin/ops/jobs/[id]/retry). This function had no prior direct test
 * coverage anywhere in the repo despite being the single point both retry paths
 * depend on for atomicity — exercised here via a fake query-builder that mirrors
 * the exact .update().eq().eq().in().select().maybeSingle() chain it calls.
 */
function fakeSupabaseFor(matchResult: { data: unknown; error: { message: string } | null }) {
  const calls: { method: string; args: unknown[] }[] = [];
  const chain = {
    update(args: unknown) {
      calls.push({ method: "update", args: [args] });
      return chain;
    },
    eq(...args: unknown[]) {
      calls.push({ method: "eq", args });
      return chain;
    },
    in(...args: unknown[]) {
      calls.push({ method: "in", args });
      return chain;
    },
    select(...args: unknown[]) {
      calls.push({ method: "select", args });
      return chain;
    },
    maybeSingle: () => Promise.resolve(matchResult),
  };
  return { from: () => chain, calls };
}

test("resetBackgroundJobForRetry transitions a failed job to queued and clears retry fields", async () => {
  const returned = {
    id: "job-1",
    user_id: "user-1",
    status: "queued",
    attempts: 0,
    error: null,
    result: null,
    started_at: null,
    completed_at: null,
  };
  const { from } = fakeSupabaseFor({ data: returned, error: null });
  const job = await resetBackgroundJobForRetry({ from } as never, "user-1", "job-1");
  assert.equal(job?.status, "queued");
  assert.equal(job?.attempts, 0);
});

test("resetBackgroundJobForRetry constrains the WHERE clause to failed|cancelled source states only", async () => {
  const { from, calls } = fakeSupabaseFor({ data: null, error: null });
  await resetBackgroundJobForRetry({ from } as never, "user-1", "job-1");
  const inCall = calls.find((c) => c.method === "in");
  assert.deepEqual(inCall?.args, ["status", ["failed", "cancelled"]]);
  const eqCalls = calls.filter((c) => c.method === "eq");
  assert.ok(eqCalls.some((c) => c.args[0] === "id" && c.args[1] === "job-1"));
  assert.ok(eqCalls.some((c) => c.args[0] === "user_id" && c.args[1] === "user-1"));
});

test("resetBackgroundJobForRetry returns null (not an error/throw) when no row matches — the idempotent duplicate-retry case", async () => {
  // Simulates: a second concurrent retry request (or a retry of a job that already
  // transitioned to completed/running) — the WHERE clause matches zero rows, so
  // Supabase returns { data: null, error: null } via maybeSingle(), not an error.
  const { from } = fakeSupabaseFor({ data: null, error: null });
  const job = await resetBackgroundJobForRetry({ from } as never, "user-1", "job-already-retried");
  assert.equal(job, null);
});

test("resetBackgroundJobForRetry returns null (never throws) on a real database error", async () => {
  const { from } = fakeSupabaseFor({ data: null, error: { message: "connection reset" } });
  const job = await resetBackgroundJobForRetry({ from } as never, "user-1", "job-1");
  assert.equal(job, null);
});

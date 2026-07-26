import test from "node:test";
import assert from "node:assert/strict";
import {
  claimSnapshotCacheKey,
  getSnapshotClaimOwner,
  resetSnapshotClaimStore,
} from "../lib/business-discovery/continuation/claimStore.ts";

test("first claim succeeds", () => {
  resetSnapshotClaimStore();
  const result = claimSnapshotCacheKey("key-1", "user-a");
  assert.equal(result.status, "claimed");
  assert.equal(getSnapshotClaimOwner("key-1"), "user-a");
});

test("same-user retry is idempotent and returns the original claim time", () => {
  resetSnapshotClaimStore();
  const first = claimSnapshotCacheKey("key-1", "user-a");
  assert.equal(first.status, "claimed");
  const second = claimSnapshotCacheKey("key-1", "user-a");
  assert.equal(second.status, "already_claimed_by_you");
  assert.equal((second as { claimedAt: string }).claimedAt, (first as { claimedAt: string }).claimedAt);
});

test("a different user attempting to claim an already-claimed key is rejected", () => {
  resetSnapshotClaimStore();
  claimSnapshotCacheKey("key-1", "user-a");
  const result = claimSnapshotCacheKey("key-1", "user-b");
  assert.equal(result.status, "claimed_by_another_user");
  // Ownership is unchanged by the rejected attempt.
  assert.equal(getSnapshotClaimOwner("key-1"), "user-a");
});

test("an expired claim can be claimed fresh by a new user", () => {
  resetSnapshotClaimStore();
  claimSnapshotCacheKey("key-1", "user-a", -1); // already expired
  const result = claimSnapshotCacheKey("key-1", "user-b");
  assert.equal(result.status, "claimed");
  assert.equal(getSnapshotClaimOwner("key-1"), "user-b");
});

test("getSnapshotClaimOwner returns null for a never-claimed key", () => {
  resetSnapshotClaimStore();
  assert.equal(getSnapshotClaimOwner("never-claimed"), null);
});

test("getSnapshotClaimOwner returns null once a claim has expired", () => {
  resetSnapshotClaimStore();
  claimSnapshotCacheKey("key-1", "user-a", -1);
  assert.equal(getSnapshotClaimOwner("key-1"), null);
});

test("claims on different keys never cross over", () => {
  resetSnapshotClaimStore();
  claimSnapshotCacheKey("key-1", "user-a");
  claimSnapshotCacheKey("key-2", "user-b");
  assert.equal(getSnapshotClaimOwner("key-1"), "user-a");
  assert.equal(getSnapshotClaimOwner("key-2"), "user-b");
});

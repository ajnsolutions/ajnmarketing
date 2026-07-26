import test from "node:test";
import assert from "node:assert/strict";
import { isValidSnapshotReferenceFormat } from "../lib/business-discovery/continuation/validateReference.ts";
import { issuePublicSnapshotReference } from "../lib/business-discovery/public/cache.ts";

test("accepts a real, freshly issued reference", () => {
  const reference = issuePublicSnapshotReference("https://example.com/");
  assert.equal(isValidSnapshotReferenceFormat(reference), true);
});

test("rejects a missing reference", () => {
  assert.equal(isValidSnapshotReferenceFormat(undefined), false);
  assert.equal(isValidSnapshotReferenceFormat(null), false);
});

test("rejects a non-string reference", () => {
  assert.equal(isValidSnapshotReferenceFormat(12345), false);
  assert.equal(isValidSnapshotReferenceFormat({ reference: "x" }), false);
  assert.equal(isValidSnapshotReferenceFormat(["a"]), false);
});

test("rejects an empty string", () => {
  assert.equal(isValidSnapshotReferenceFormat(""), false);
});

test("rejects a malformed reference (wrong length, wrong characters)", () => {
  assert.equal(isValidSnapshotReferenceFormat("not-a-real-reference"), false);
  assert.equal(isValidSnapshotReferenceFormat("abc123"), false);
  assert.equal(isValidSnapshotReferenceFormat("g".repeat(48)), false); // 'g' is not hex
});

test("rejects an oversized string before even attempting a regex match", () => {
  assert.equal(isValidSnapshotReferenceFormat("a".repeat(10_000)), false);
});

test("rejects a well-formed-looking but wrong-length hex string", () => {
  assert.equal(isValidSnapshotReferenceFormat("a".repeat(47)), false);
  assert.equal(isValidSnapshotReferenceFormat("a".repeat(49)), false);
});

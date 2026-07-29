import test from "node:test";
import assert from "node:assert/strict";
import {
  validatePublicSnapshotRequest,
  PublicSnapshotValidationError,
} from "../lib/business-discovery/public/validateRequest.ts";
import { PUBLIC_SNAPSHOT_FIELD_LIMITS } from "../lib/business-discovery/public/types.ts";

function expectRejected(body: unknown) {
  assert.throws(() => validatePublicSnapshotRequest(body), (error: unknown) => error instanceof PublicSnapshotValidationError);
}

test("accepts a minimal valid request with only websiteUrl", () => {
  const result = validatePublicSnapshotRequest({ websiteUrl: "https://example.com" });
  assert.equal(result.websiteUrl, "https://example.com");
  assert.equal(result.contractVersion, "v1");
});

test("accepts a full valid request", () => {
  const result = validatePublicSnapshotRequest({
    contractVersion: "v1",
    websiteUrl: "https://example.com",
    businessName: "Acme HVAC",
    city: "Springfield",
    stateOrRegion: "IL",
    country: "US",
  });
  assert.equal(result.businessName, "Acme HVAC");
  assert.equal(result.city, "Springfield");
  assert.equal(result.stateOrRegion, "IL");
  assert.equal(result.country, "US");
});

test("rejects a missing websiteUrl", () => {
  expectRejected({});
});

test("rejects a blank websiteUrl", () => {
  expectRejected({ websiteUrl: "   " });
});

test("rejects a non-string websiteUrl", () => {
  expectRejected({ websiteUrl: 12345 });
});

test("rejects a request body that isn't an object", () => {
  expectRejected(null);
  expectRejected("a string");
  expectRejected(["array"]);
});

test("rejects an unsupported field", () => {
  expectRejected({ websiteUrl: "https://example.com", email: "visitor@example.com" });
});

test("rejects an unsupported contract version", () => {
  expectRejected({ websiteUrl: "https://example.com", contractVersion: "v2" });
});

test("rejects a websiteUrl longer than the field limit", () => {
  const longUrl = `https://example.com/${"a".repeat(PUBLIC_SNAPSHOT_FIELD_LIMITS.websiteUrl)}`;
  expectRejected({ websiteUrl: longUrl });
});

test("rejects a businessName longer than the field limit", () => {
  expectRejected({
    websiteUrl: "https://example.com",
    businessName: "a".repeat(PUBLIC_SNAPSHOT_FIELD_LIMITS.businessName + 1),
  });
});

test("treats a blank optional field as absent rather than an empty string", () => {
  const result = validatePublicSnapshotRequest({ websiteUrl: "https://example.com", city: "   " });
  assert.equal("city" in result, false);
});

test("rejects a non-string optional field", () => {
  expectRejected({ websiteUrl: "https://example.com", businessName: 42 });
});

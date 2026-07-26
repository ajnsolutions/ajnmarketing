import test from "node:test";
import assert from "node:assert/strict";
import {
  getCachedPublicSnapshot,
  issuePublicSnapshotReference,
  publicSnapshotCacheKey,
  resetPublicSnapshotCache,
  resolvePublicSnapshotReference,
  setCachedPublicSnapshot,
} from "../lib/business-discovery/public/cache.ts";
import type { PublicBusinessDiscoveryResultV1 } from "../lib/business-discovery/public/types.ts";

function fakeResult(overrides: Partial<PublicBusinessDiscoveryResultV1> = {}): PublicBusinessDiscoveryResultV1 {
  return {
    contractVersion: "v1",
    generatedAt: "2026-01-01T00:00:00.000Z",
    snapshotReference: "placeholder",
    websiteUrl: "https://example.com/",
    businessName: null,
    city: null,
    stateOrRegion: null,
    businessSummary: { value: "x", confidenceTier: "known", confidenceScore: 90, sources: [], reason: "x", evidenceRefs: [] },
    primaryServices: { value: [], confidenceTier: "missing", confidenceScore: 0, sources: [], reason: "x", evidenceRefs: [] },
    likelyTargetCustomers: { value: null, confidenceTier: "missing", confidenceScore: 0, sources: [], reason: "x", evidenceRefs: [] },
    brandPersonality: { value: [], confidenceTier: "missing", confidenceScore: 0, sources: [], reason: "x", evidenceRefs: [] },
    visibleStrengths: { value: [], confidenceTier: "missing", confidenceScore: 0, sources: [], reason: "x", evidenceRefs: [] },
    onlinePresence: {
      website: { value: { connected: true, analyzed: true }, confidenceTier: "known", confidenceScore: 90, sources: [], reason: "x", evidenceRefs: [] },
      googleBusinessProfile: { value: { connected: false }, confidenceTier: "missing", confidenceScore: 0, sources: [], reason: "x", evidenceRefs: [] },
      socialPresence: { value: null, confidenceTier: "missing", confidenceScore: 0, sources: [], reason: "x", evidenceRefs: [] },
    },
    possibleGrowthOpportunities: { value: [], confidenceTier: "missing", confidenceScore: 0, sources: [], reason: "x", evidenceRefs: [] },
    missingOrUnclearInformation: [],
    overallConfidence: { tier: "assumed", label: "Building a picture", explanation: "x" },
    ...overrides,
  } as PublicBusinessDiscoveryResultV1;
}

test("returns null on a cache miss", () => {
  resetPublicSnapshotCache();
  assert.equal(getCachedPublicSnapshot("https://never-cached.example/"), null);
});

test("returns the cached value on a hit within the TTL", () => {
  resetPublicSnapshotCache();
  const value = fakeResult();
  setCachedPublicSnapshot("https://example.com/", value);
  const hit = getCachedPublicSnapshot("https://example.com/");
  assert.deepEqual(hit, value);
});

test("expires an entry after its TTL", () => {
  resetPublicSnapshotCache();
  setCachedPublicSnapshot("https://example.com/", fakeResult(), -1); // already expired
  assert.equal(getCachedPublicSnapshot("https://example.com/"), null);
});

test("normalizes the cache key (case-insensitive, trimmed)", () => {
  assert.equal(publicSnapshotCacheKey("HTTPS://Example.com/"), publicSnapshotCacheKey("  https://example.com/  "));
});

test("a cache key is a one-way hash, not the raw URL", () => {
  const key = publicSnapshotCacheKey("https://example.com/");
  assert.doesNotMatch(key, /example\.com/);
  assert.equal(key.length, 64); // sha256 hex digest length
});

test("issues a reference distinct from the cache key and unguessable from the URL alone", () => {
  resetPublicSnapshotCache();
  const referenceOne = issuePublicSnapshotReference("https://example.com/");
  const referenceTwo = issuePublicSnapshotReference("https://example.com/");
  assert.notEqual(referenceOne, referenceTwo); // two issuances for the same URL never collide
  assert.notEqual(referenceOne, publicSnapshotCacheKey("https://example.com/"));
});

test("resolves a valid reference back to its cache key", () => {
  resetPublicSnapshotCache();
  const reference = issuePublicSnapshotReference("https://example.com/");
  assert.equal(resolvePublicSnapshotReference(reference), publicSnapshotCacheKey("https://example.com/"));
});

test("fails safe (returns null, never throws) for an unknown reference", () => {
  resetPublicSnapshotCache();
  assert.equal(resolvePublicSnapshotReference("not-a-real-reference"), null);
});

test("an expired reference resolves to null", () => {
  resetPublicSnapshotCache();
  const reference = issuePublicSnapshotReference("https://example.com/", -1);
  assert.equal(resolvePublicSnapshotReference(reference), null);
});

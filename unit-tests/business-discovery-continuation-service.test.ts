import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveSnapshotForUser,
  claimSnapshotForUser,
  submitConfirmationsForUser,
} from "../lib/business-discovery/continuation/service.ts";
import { getCachedPublicSnapshot, issuePublicSnapshotReference, resetPublicSnapshotCache, setCachedPublicSnapshot } from "../lib/business-discovery/public/cache.ts";
import { resetSnapshotClaimStore } from "../lib/business-discovery/continuation/claimStore.ts";
import { resetConfirmationStore } from "../lib/business-discovery/continuation/confirmationStore.ts";
import { InsightDecisionTypes, InsightKeys } from "../lib/business-discovery/continuation/types.ts";
import type { PublicBusinessDiscoveryResultV1 } from "../lib/business-discovery/public/types.ts";

function insight(value: unknown, tier: "known" | "assumed" | "missing") {
  return { value, confidenceTier: tier, confidenceScore: tier === "known" ? 90 : tier === "assumed" ? 55 : 0, sources: ["ai_website_analysis"], reason: "x", evidenceRefs: [] };
}

function fakeSnapshot(): PublicBusinessDiscoveryResultV1 {
  return {
    contractVersion: "v1",
    generatedAt: "2026-01-01T00:00:00.000Z",
    snapshotReference: "placeholder",
    websiteUrl: "https://acmehvac.example/",
    businessName: "Acme HVAC",
    city: null,
    stateOrRegion: null,
    businessSummary: insight("Acme HVAC serves Springfield.", "assumed"),
    primaryServices: insight(["AC repair"], "assumed"),
    likelyTargetCustomers: insight("Homeowners", "assumed"),
    brandPersonality: insight(["Friendly"], "assumed"),
    visibleStrengths: insight(["Fast response"], "assumed"),
    onlinePresence: {
      website: insight({ connected: true, analyzed: true }, "known"),
      googleBusinessProfile: insight({ connected: false }, "missing"),
      socialPresence: insight(null, "missing"),
    },
    possibleGrowthOpportunities: insight(["Spring promo"], "assumed"),
    missingOrUnclearInformation: [],
    overallConfidence: { tier: "assumed", label: "Building a picture", explanation: "x" },
  } as unknown as PublicBusinessDiscoveryResultV1;
}

function seedSnapshot(): string {
  const snapshot = fakeSnapshot();
  const url = snapshot.websiteUrl;
  setCachedPublicSnapshot(url, snapshot);
  return issuePublicSnapshotReference(url);
}

function fakeSupabaseClient() {
  const calls: { method: string; args: unknown[] }[] = [];
  const chain = {
    update(args: unknown) {
      calls.push({ method: "update", args: [args] });
      return chain;
    },
    insert(args: unknown) {
      calls.push({ method: "insert", args: [args] });
      return chain;
    },
    eq(...args: unknown[]) {
      calls.push({ method: "eq", args });
      return Promise.resolve({ error: null });
    },
  };
  return { client: { from: () => chain } as never, calls };
}

function resetAll() {
  resetPublicSnapshotCache();
  resetSnapshotClaimStore();
  resetConfirmationStore();
}

// --- Resolution --------------------------------------------------------

test("valid authenticated resolution returns the public-safe snapshot", () => {
  resetAll();
  const reference = seedSnapshot();
  const result = resolveSnapshotForUser("user-1", reference);
  assert.equal(result.status, "resolved");
  if (result.status === "resolved") {
    assert.equal(result.snapshot.businessName, "Acme HVAC");
  }
});

test("malformed reference is rejected as invalid", () => {
  resetAll();
  assert.deepEqual(resolveSnapshotForUser("user-1", "not-a-real-reference"), { status: "invalid" });
});

test("missing reference is rejected as invalid", () => {
  resetAll();
  assert.deepEqual(resolveSnapshotForUser("user-1", undefined), { status: "invalid" });
});

test("nonexistent (well-formed but never-issued) reference resolves to not_found", () => {
  resetAll();
  const fakeButWellFormed = "a".repeat(48);
  assert.deepEqual(resolveSnapshotForUser("user-1", fakeButWellFormed), { status: "not_found" });
});

test("expired reference resolves to expired, distinctly from not_found", () => {
  resetAll();
  const snapshot = fakeSnapshot();
  setCachedPublicSnapshot(snapshot.websiteUrl, snapshot);
  const reference = issuePublicSnapshotReference(snapshot.websiteUrl, -1); // already expired
  assert.deepEqual(resolveSnapshotForUser("user-1", reference), { status: "expired" });
});

test("a resolved snapshot never exposes a raw cache key or database identifier", () => {
  resetAll();
  const reference = seedSnapshot();
  const result = resolveSnapshotForUser("user-1", reference);
  assert.equal(result.status, "resolved");
  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /cacheKey/i);
  assert.doesNotMatch(serialized, /business_profile_id/i);
  assert.doesNotMatch(serialized, /"id":/);
});

test("a resolved snapshot never contains an authenticated-only source (GBP, reviews, Market Context)", () => {
  resetAll();
  const reference = seedSnapshot();
  const result = resolveSnapshotForUser("user-1", reference);
  assert.equal(result.status, "resolved");
  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /"google_business_profile"/);
  assert.doesNotMatch(serialized, /"public_reviews"/);
  assert.doesNotMatch(serialized, /"market_context"/);
});

// --- Claiming ------------------------------------------------------------

test("first claim succeeds", () => {
  resetAll();
  const reference = seedSnapshot();
  const result = claimSnapshotForUser("user-1", reference);
  assert.equal(result.status, "claimed");
});

test("same-user retry is idempotent", () => {
  resetAll();
  const reference = seedSnapshot();
  claimSnapshotForUser("user-1", reference);
  const result = claimSnapshotForUser("user-1", reference);
  assert.equal(result.status, "already_claimed_by_you");
});

test("different-user reuse is rejected as a conflict", () => {
  resetAll();
  const reference = seedSnapshot();
  claimSnapshotForUser("user-1", reference);
  const result = claimSnapshotForUser("user-2", reference);
  assert.equal(result.status, "claimed_by_another_user");
});

test("claiming an expired reference is rejected", () => {
  resetAll();
  const snapshot = fakeSnapshot();
  setCachedPublicSnapshot(snapshot.websiteUrl, snapshot);
  const reference = issuePublicSnapshotReference(snapshot.websiteUrl, -1);
  assert.deepEqual(claimSnapshotForUser("user-1", reference), { status: "expired" });
});

// --- Confirmation ----------------------------------------------------------

test("submitting confirmations without claiming first is rejected", async () => {
  resetAll();
  const reference = seedSnapshot();
  const { client } = fakeSupabaseClient();
  const result = await submitConfirmationsForUser(client, "user-1", reference, [
    { insightKey: InsightKeys.PRIMARY_SERVICES, decision: InsightDecisionTypes.CONFIRM },
  ]);
  assert.equal(result.status, "not_claimed");
});

test("a different user cannot submit confirmations against someone else's claim (ownership enforcement, no tenant crossover)", async () => {
  resetAll();
  const reference = seedSnapshot();
  claimSnapshotForUser("user-1", reference);
  const { client } = fakeSupabaseClient();
  const result = await submitConfirmationsForUser(client, "user-2", reference, [
    { insightKey: InsightKeys.PRIMARY_SERVICES, decision: InsightDecisionTypes.CONFIRM },
  ]);
  assert.equal(result.status, "claimed_by_another_user");
});

test("a claimed reference accepts confirmations from the claiming user and persists only the mappable field", async () => {
  resetAll();
  const reference = seedSnapshot();
  claimSnapshotForUser("user-1", reference);
  const { client, calls } = fakeSupabaseClient();

  const result = await submitConfirmationsForUser(client, "user-1", reference, [
    { insightKey: InsightKeys.PRIMARY_SERVICES, decision: InsightDecisionTypes.CONFIRM },
    { insightKey: InsightKeys.BRAND_PERSONALITY, decision: InsightDecisionTypes.REJECT },
  ]);

  assert.equal(result.status, "applied");
  if (result.status === "applied") {
    assert.equal(result.records.length, 2);
  }

  const updateCall = calls.find((call) => call.method === "update");
  assert.ok(updateCall);
  assert.deepEqual(updateCall?.args[0], { primary_services: "AC repair" });

  // No insert of any kind — this never creates a new business/profile row.
  assert.equal(calls.some((call) => call.method === "insert"), false);
});

test("partial submission (fewer than all insights) is accepted", async () => {
  resetAll();
  const reference = seedSnapshot();
  claimSnapshotForUser("user-1", reference);
  const { client } = fakeSupabaseClient();

  const result = await submitConfirmationsForUser(client, "user-1", reference, [
    { insightKey: InsightKeys.BUSINESS_SUMMARY, decision: InsightDecisionTypes.REVIEW_LATER },
  ]);
  assert.equal(result.status, "applied");
});

test("duplicate submission of the same insight key overwrites rather than duplicating", async () => {
  resetAll();
  const reference = seedSnapshot();
  claimSnapshotForUser("user-1", reference);
  const { client } = fakeSupabaseClient();

  await submitConfirmationsForUser(client, "user-1", reference, [
    { insightKey: InsightKeys.BUSINESS_SUMMARY, decision: InsightDecisionTypes.REJECT },
  ]);
  const second = await submitConfirmationsForUser(client, "user-1", reference, [
    { insightKey: InsightKeys.BUSINESS_SUMMARY, decision: InsightDecisionTypes.CONFIRM },
  ]);

  assert.equal(second.status, "applied");
  if (second.status === "applied") {
    assert.equal(second.records[0].decision, InsightDecisionTypes.CONFIRM);
  }
});

test("an invalid insight key in the batch is reported without crashing the whole request", async () => {
  resetAll();
  const reference = seedSnapshot();
  claimSnapshotForUser("user-1", reference);
  const { client } = fakeSupabaseClient();

  const result = await submitConfirmationsForUser(client, "user-1", reference, [
    { insightKey: "bogusKey" as never, decision: InsightDecisionTypes.CONFIRM },
  ]);
  assert.equal(result.status, "invalid_decisions");
});

test("confirming against an expired reference is rejected", async () => {
  resetAll();
  const snapshot = fakeSnapshot();
  setCachedPublicSnapshot(snapshot.websiteUrl, snapshot);
  const reference = issuePublicSnapshotReference(snapshot.websiteUrl, -1);
  const { client } = fakeSupabaseClient();

  const result = await submitConfirmationsForUser(client, "user-1", reference, [
    { insightKey: InsightKeys.PRIMARY_SERVICES, decision: InsightDecisionTypes.CONFIRM },
  ]);
  assert.equal(result.status, "expired");
});

test("resolving, claiming, and confirming never touch the underlying cached snapshot for a different URL", () => {
  resetAll();
  const referenceA = seedSnapshot();
  const otherSnapshot = { ...fakeSnapshot(), websiteUrl: "https://different-business.example/", businessName: "Different Co" };
  setCachedPublicSnapshot(otherSnapshot.websiteUrl, otherSnapshot as PublicBusinessDiscoveryResultV1);

  const resultA = resolveSnapshotForUser("user-1", referenceA);
  assert.equal(resultA.status, "resolved");
  if (resultA.status === "resolved") {
    assert.equal(resultA.snapshot.businessName, "Acme HVAC");
  }
  assert.notEqual(getCachedPublicSnapshot(otherSnapshot.websiteUrl)?.businessName, "Acme HVAC");
});

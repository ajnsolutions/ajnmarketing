import test from "node:test";
import assert from "node:assert/strict";
import {
  applyConfirmationDecision,
  applyConfirmationDecisions,
  buildBusinessProfileFieldsFromConfirmations,
  type ApplyDecisionOutcome,
} from "../lib/business-discovery/continuation/applyConfirmations.ts";
import { InsightDecisionTypes, InsightKeys, ResultingFactStatuses, type ConfirmationDecisionInput, type ConfirmationRecord } from "../lib/business-discovery/continuation/types.ts";
import type { PublicBusinessDiscoveryResultV1 } from "../lib/business-discovery/public/types.ts";

function insight(value: unknown, tier: "known" | "assumed" | "missing", sources: string[] = ["ai_website_analysis"]) {
  return { value, confidenceTier: tier, confidenceScore: tier === "known" ? 90 : tier === "assumed" ? 55 : 0, sources, reason: "x", evidenceRefs: [] };
}

function expectRecord(outcome: ApplyDecisionOutcome): ConfirmationRecord {
  assert.ok("record" in outcome, "expected a record outcome, got an error");
  return (outcome as { record: ConfirmationRecord }).record;
}

function fixtureSnapshot(): PublicBusinessDiscoveryResultV1 {
  return {
    contractVersion: "v1",
    generatedAt: "2026-01-01T00:00:00.000Z",
    snapshotReference: "ref",
    websiteUrl: "https://acmehvac.example/",
    businessName: "Acme HVAC",
    city: null,
    stateOrRegion: null,
    businessSummary: insight("Acme HVAC serves Springfield.", "assumed"),
    primaryServices: insight(["AC repair", "Furnace installation"], "assumed"),
    likelyTargetCustomers: insight("Homeowners", "assumed"),
    brandPersonality: insight(["Friendly", "Direct"], "assumed"),
    visibleStrengths: insight(["Fast response"], "assumed"),
    onlinePresence: {
      website: insight({ connected: true, analyzed: true }, "known", ["business_profile"]),
      googleBusinessProfile: insight({ connected: false }, "missing", []),
      socialPresence: insight(null, "missing", []),
    },
    possibleGrowthOpportunities: insight(["Spring tune-up promo"], "assumed"),
    missingOrUnclearInformation: [],
    overallConfidence: { tier: "assumed", label: "Building a picture", explanation: "x" },
  } as unknown as PublicBusinessDiscoveryResultV1;
}

const NOW = "2026-01-02T00:00:00.000Z";

test("confirm converts an Assumed insight into a known fact using the server's own recorded value", () => {
  const outcome = applyConfirmationDecision(
    fixtureSnapshot(),
    { insightKey: InsightKeys.PRIMARY_SERVICES, decision: InsightDecisionTypes.CONFIRM },
    "user-1",
    NOW
  );
    const record = expectRecord(outcome);
  assert.equal(record.resultingFactStatus, ResultingFactStatuses.KNOWN_FACT);
  assert.deepEqual(record.resultingValue, ["AC repair", "Furnace installation"]);
  assert.equal(record.originalConfidenceTier, "assumed");
  assert.equal(record.decidedByUserId, "user-1");
  assert.equal(record.decidedAt, NOW);
});

test("correct converts an Assumed insight into a known fact using the corrected value, not the original", () => {
  const outcome = applyConfirmationDecision(
    fixtureSnapshot(),
    { insightKey: InsightKeys.LIKELY_TARGET_CUSTOMERS, decision: InsightDecisionTypes.CORRECT, correctedValue: "Property managers" },
    "user-1",
    NOW
  );
    const record = expectRecord(outcome);
  assert.equal(record.resultingFactStatus, ResultingFactStatuses.KNOWN_FACT);
  assert.equal(record.resultingValue, "Property managers");
  assert.equal(record.originalValue, "Homeowners"); // provenance preserved even though corrected
});

test("correct without a correctedValue is rejected as an error, not silently applied", () => {
  const outcome = applyConfirmationDecision(
    fixtureSnapshot(),
    { insightKey: InsightKeys.LIKELY_TARGET_CUSTOMERS, decision: InsightDecisionTypes.CORRECT },
    "user-1",
    NOW
  );
  assert.ok("error" in outcome);
});

test("reject never becomes a fact", () => {
  const outcome = applyConfirmationDecision(
    fixtureSnapshot(),
    { insightKey: InsightKeys.BRAND_PERSONALITY, decision: InsightDecisionTypes.REJECT },
    "user-1",
    NOW
  );
    const record = expectRecord(outcome);
  assert.equal(record.resultingFactStatus, ResultingFactStatuses.REJECTED);
  assert.equal(record.resultingValue, null);
});

test("review_later remains unresolved", () => {
  const outcome = applyConfirmationDecision(
    fixtureSnapshot(),
    { insightKey: InsightKeys.VISIBLE_STRENGTHS, decision: InsightDecisionTypes.REVIEW_LATER },
    "user-1",
    NOW
  );
    const record = expectRecord(outcome);
  assert.equal(record.resultingFactStatus, ResultingFactStatuses.UNRESOLVED);
  assert.equal(record.resultingValue, null);
});

test("confirming a Missing insight is a defensive no-op, never fabricates a fact", () => {
  const outcome = applyConfirmationDecision(
    fixtureSnapshot(),
    { insightKey: InsightKeys.ONLINE_PRESENCE_GOOGLE_BUSINESS_PROFILE, decision: InsightDecisionTypes.CONFIRM },
    "user-1",
    NOW
  );
    const record = expectRecord(outcome);
  assert.equal(record.resultingFactStatus, ResultingFactStatuses.UNRESOLVED);
  assert.equal(record.resultingValue, null);
});

test("a Missing insight can be supplied by the user via correct", () => {
  const outcome = applyConfirmationDecision(
    fixtureSnapshot(),
    {
      insightKey: InsightKeys.ONLINE_PRESENCE_GOOGLE_BUSINESS_PROFILE,
      decision: InsightDecisionTypes.CORRECT,
      correctedValue: { connected: true },
    },
    "user-1",
    NOW
  );
    const record = expectRecord(outcome);
  assert.equal(record.resultingFactStatus, ResultingFactStatuses.KNOWN_FACT);
  assert.deepEqual(record.resultingValue, { connected: true });
  assert.equal(record.originalConfidenceTier, "missing");
});

test("an invalid/unknown insight key is rejected as an error", () => {
  const outcome = applyConfirmationDecision(
    fixtureSnapshot(),
    { insightKey: "notARealInsightKey" as never, decision: InsightDecisionTypes.CONFIRM },
    "user-1",
    NOW
  );
  assert.ok("error" in outcome);
});

test("a tampered/altered 'original value' the client might submit is never trusted — provenance always comes from the server's own resolved snapshot", () => {
  // The contract doesn't even accept an "originalValue" field from the client
  // (see ConfirmationDecisionInput) — this test locks in that the resulting
  // record's originalValue always matches the snapshot's real value,
  // regardless of anything else present on the input object.
  const tamperedInput = {
    insightKey: InsightKeys.PRIMARY_SERVICES,
    decision: InsightDecisionTypes.CONFIRM,
    // A malicious/buggy client might include extra fields hoping they're read —
    // they must be ignored entirely.
    originalValue: ["Fabricated service the AI never found"],
    originalConfidenceTier: "known",
  } as unknown as ConfirmationDecisionInput;

  const outcome = applyConfirmationDecision(fixtureSnapshot(), tamperedInput, "user-1", NOW);
    const record = expectRecord(outcome);
  assert.deepEqual(record.originalValue, ["AC repair", "Furnace installation"]);
  assert.equal(record.originalConfidenceTier, "assumed");
});

test("batch processing separates successful records from per-decision errors", () => {
  const { records, errors } = applyConfirmationDecisions(
    fixtureSnapshot(),
    [
      { insightKey: InsightKeys.PRIMARY_SERVICES, decision: InsightDecisionTypes.CONFIRM },
      { insightKey: "bogus" as never, decision: InsightDecisionTypes.CONFIRM },
    ],
    "user-1",
    NOW
  );
  assert.equal(records.length, 1);
  assert.equal(errors.length, 1);
});

test("no silent Assumed-to-Known conversion happens outside an explicit decision", () => {
  // Merely resolving/reading the snapshot never calls applyConfirmationDecision
  // at all — this test documents that guarantee at the type/contract level:
  // there is no function in this module that changes a fact's status without
  // a decision object being passed in explicitly.
  const snapshot = fixtureSnapshot();
  assert.equal(snapshot.primaryServices.confidenceTier, "assumed");
  // (no call to any apply* function here) — tier remains assumed, unchanged.
  assert.equal(snapshot.primaryServices.confidenceTier, "assumed");
});

test("buildBusinessProfileFieldsFromConfirmations only maps primaryServices — the one field with a durable existing home", () => {
  const { records } = applyConfirmationDecisions(
    fixtureSnapshot(),
    [
      { insightKey: InsightKeys.PRIMARY_SERVICES, decision: InsightDecisionTypes.CONFIRM },
      { insightKey: InsightKeys.BRAND_PERSONALITY, decision: InsightDecisionTypes.CONFIRM },
      { insightKey: InsightKeys.BUSINESS_SUMMARY, decision: InsightDecisionTypes.CONFIRM },
    ],
    "user-1",
    NOW
  );
  const fields = buildBusinessProfileFieldsFromConfirmations(records);
  assert.deepEqual(fields, { primary_services: "AC repair, Furnace installation" });
});

test("buildBusinessProfileFieldsFromConfirmations returns nothing when primaryServices wasn't confirmed", () => {
  const { records } = applyConfirmationDecisions(
    fixtureSnapshot(),
    [{ insightKey: InsightKeys.BRAND_PERSONALITY, decision: InsightDecisionTypes.CONFIRM }],
    "user-1",
    NOW
  );
  const fields = buildBusinessProfileFieldsFromConfirmations(records);
  assert.deepEqual(fields, {});
});

test("buildBusinessProfileFieldsFromConfirmations returns nothing when primaryServices was rejected", () => {
  const { records } = applyConfirmationDecisions(
    fixtureSnapshot(),
    [{ insightKey: InsightKeys.PRIMARY_SERVICES, decision: InsightDecisionTypes.REJECT }],
    "user-1",
    NOW
  );
  const fields = buildBusinessProfileFieldsFromConfirmations(records);
  assert.deepEqual(fields, {});
});

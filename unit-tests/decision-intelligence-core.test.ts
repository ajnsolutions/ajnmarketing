import assert from "node:assert/strict";
import test from "node:test";
import { computeDecisionInputFingerprint } from "../lib/decision-intelligence/fingerprint.ts";
import { compareDecisionSnapshots } from "../lib/decision-intelligence/comparisonEngine.ts";
import { buildChangeExplanation } from "../lib/decision-intelligence/explanations.ts";
import { DecisionChangeTypes, DecisionEvidenceTypes } from "../lib/decision-intelligence/types.ts";
import type { MarketingDirectorDecision } from "../lib/marketing-director/types.ts";
import type {
  DecisionEvidenceTrace,
  MarketingDirectorDecisionSnapshot,
} from "../lib/decision-intelligence/types.ts";

function decision(overrides: Partial<MarketingDirectorDecision> = {}): MarketingDirectorDecision {
  return {
    decisionType: "high_value_recommendation",
    title: "Improve review activity",
    summary: "Request more reviews this week.",
    rationale: "internal only",
    targetOutcome: "more reviews",
    confidenceLabel: "high",
    requiresCustomerAction: true,
    primaryAction: { kind: "review_recommendation", label: "Review", href: "/dashboard" },
    deferred: [],
    supportingSignals: [],
    sourceRecommendationId: "rec-1",
    presentationPriority: 1,
    evaluatedAt: "2026-07-19T00:00:00.000Z",
    memoryContext: {
      preferencesApplied: [],
      learningsConsidered: [],
      contextConsidered: [],
      ignoredLearnings: [],
      ignoredPreferences: [],
      precedenceExplanation: "x",
      confidenceExplanation: "x",
      appliedPreferenceIds: [],
      consideredLearningIds: [],
    },
    ...overrides,
  };
}

function snapshot(overrides: Partial<MarketingDirectorDecisionSnapshot> = {}): MarketingDirectorDecisionSnapshot {
  return {
    id: "snap-1",
    user_id: "user-1",
    business_profile_id: "biz-1",
    decision_type: "high_value_recommendation",
    title: "Improve review activity",
    customer_summary: "Request more reviews this week.",
    priority_rank: 1,
    action_type: "review_recommendation",
    source_recommendation_id: "rec-1",
    source_campaign_id: null,
    consulted_learning_ids: [],
    consulted_preference_ids: [],
    ignored_evidence: [],
    was_cold_start: false,
    decision_status: "active",
    evidence_version: 1,
    input_fingerprint: "fp-1",
    supersedes_decision_id: null,
    evaluated_at: "2026-07-19T00:00:00.000Z",
    created_at: "2026-07-19T00:00:00.000Z",
    ...overrides,
  };
}

function trace(overrides: Partial<DecisionEvidenceTrace> = {}): DecisionEvidenceTrace {
  return {
    id: "trace-1",
    decisionId: "snap-1",
    businessProfileId: "biz-1",
    evidenceType: DecisionEvidenceTypes.MARKETING_MEMORY_LEARNING,
    evidenceId: "learning-1",
    relationshipType: "informed_by",
    influenceState: "considered",
    customerExplanation: "A learning was considered.",
    confidenceState: "developing",
    recencyState: "current",
    authoritative: false,
    overridden: false,
    superseded: false,
    excluded: false,
    exclusionReason: null,
    observedAt: "2026-07-18T00:00:00.000Z",
    effectiveFrom: null,
    effectiveTo: null,
    sourceTarget: "/dashboard/decision-intelligence",
    ...overrides,
  };
}

// --- Fingerprint determinism -----------------------------------------------------------

test("computeDecisionInputFingerprint: identical decisions produce identical fingerprints", () => {
  const a = decision();
  const b = decision();
  assert.equal(computeDecisionInputFingerprint(a), computeDecisionInputFingerprint(b));
});

test("computeDecisionInputFingerprint: a changed title produces a different fingerprint", () => {
  const a = decision();
  const b = decision({ title: "Different title" });
  assert.notEqual(computeDecisionInputFingerprint(a), computeDecisionInputFingerprint(b));
});

test("computeDecisionInputFingerprint: a changed consulted-learning set produces a different fingerprint", () => {
  const a = decision();
  const b = decision({
    memoryContext: { ...a.memoryContext!, consideredLearningIds: ["learning-1"] },
  });
  assert.notEqual(computeDecisionInputFingerprint(a), computeDecisionInputFingerprint(b));
});

test("computeDecisionInputFingerprint: consulted-ID order does not matter (sorted before hashing)", () => {
  const a = decision({
    memoryContext: { ...decision().memoryContext!, consideredLearningIds: ["a", "b"] },
  });
  const b = decision({
    memoryContext: { ...decision().memoryContext!, consideredLearningIds: ["b", "a"] },
  });
  assert.equal(computeDecisionInputFingerprint(a), computeDecisionInputFingerprint(b));
});

test("computeDecisionInputFingerprint: cold start (null memoryContext) differs from evidence-backed", () => {
  const withMemory = decision();
  const coldStart = decision({ memoryContext: null });
  assert.notEqual(computeDecisionInputFingerprint(withMemory), computeDecisionInputFingerprint(coldStart));
});

// --- Comparison engine -------------------------------------------------------------------

test("compareDecisionSnapshots: no previous snapshot is reported as 'added', not a fabricated comparison", () => {
  const current = snapshot();
  const result = compareDecisionSnapshots(current, null, [trace()], []);
  assert.equal(result.changeType, DecisionChangeTypes.ADDED);
  assert.equal(result.certainty, "no_safe_comparison");
  assert.equal(result.previousDecisionId, null);
});

test("compareDecisionSnapshots: identical snapshots and traces are deterministic and unchanged", () => {
  const current = snapshot();
  const previous = snapshot({ id: "snap-0" });
  const traces = [trace()];
  const first = compareDecisionSnapshots(current, previous, traces, traces);
  const second = compareDecisionSnapshots(current, previous, traces, traces);
  assert.deepEqual(first, second);
  assert.equal(first.changeType, DecisionChangeTypes.UNCHANGED);
});

test("compareDecisionSnapshots: lower priority_rank number (higher priority) is increased_priority", () => {
  const current = snapshot({ priority_rank: 1 });
  const previous = snapshot({ id: "snap-0", priority_rank: 5 });
  const result = compareDecisionSnapshots(current, previous, [trace()], [trace()]);
  assert.equal(result.changeType, DecisionChangeTypes.INCREASED_PRIORITY);
  assert.equal(result.rankChanged, true);
});

test("compareDecisionSnapshots: higher priority_rank number (lower priority) is decreased_priority", () => {
  const current = snapshot({ priority_rank: 5 });
  const previous = snapshot({ id: "snap-0", priority_rank: 1 });
  const result = compareDecisionSnapshots(current, previous, [trace()], [trace()]);
  assert.equal(result.changeType, DecisionChangeTypes.DECREASED_PRIORITY);
});

test("compareDecisionSnapshots: new evidence with unchanged rank is evidence_strengthened", () => {
  const current = snapshot();
  const previous = snapshot({ id: "snap-0" });
  const currentTraces = [trace({ id: "t1", evidenceId: "learning-1" }), trace({ id: "t2", evidenceId: "learning-2" })];
  const previousTraces = [trace({ id: "t1", evidenceId: "learning-1" })];
  const result = compareDecisionSnapshots(current, previous, currentTraces, previousTraces);
  assert.equal(result.changeType, DecisionChangeTypes.EVIDENCE_STRENGTHENED);
  assert.equal(result.evidenceAdded.length, 1);
});

test("compareDecisionSnapshots: removed evidence with unchanged rank is evidence_weakened", () => {
  const current = snapshot();
  const previous = snapshot({ id: "snap-0" });
  const currentTraces = [trace({ id: "t1", evidenceId: "learning-1" })];
  const previousTraces = [trace({ id: "t1", evidenceId: "learning-1" }), trace({ id: "t2", evidenceId: "learning-2" })];
  const result = compareDecisionSnapshots(current, previous, currentTraces, previousTraces);
  assert.equal(result.changeType, DecisionChangeTypes.EVIDENCE_WEAKENED);
  assert.equal(result.evidenceRemoved.length, 1);
});

test("compareDecisionSnapshots: excluded evidence is never counted as added or removed", () => {
  const current = snapshot();
  const previous = snapshot({ id: "snap-0" });
  const currentTraces = [trace({ id: "t1", evidenceId: "learning-1", excluded: true })];
  const result = compareDecisionSnapshots(current, previous, currentTraces, []);
  assert.equal(result.evidenceAdded.length, 0);
});

test("compareDecisionSnapshots: superseded current decision is reported as superseded", () => {
  const current = snapshot({ decision_status: "superseded" });
  const previous = snapshot({ id: "snap-0" });
  const result = compareDecisionSnapshots(current, previous, [trace()], [trace()]);
  assert.equal(result.changeType, DecisionChangeTypes.SUPERSEDED);
});

test("compareDecisionSnapshots: preferenceImpact is true only when a preference trace was added or removed", () => {
  const current = snapshot();
  const previous = snapshot({ id: "snap-0" });
  const currentTraces = [trace({ id: "t1", evidenceType: DecisionEvidenceTypes.MARKETING_MEMORY_PREFERENCE, evidenceId: "pref-1" })];
  const result = compareDecisionSnapshots(current, previous, currentTraces, []);
  assert.equal(result.preferenceImpact, true);
});

test("compareDecisionSnapshots: comparing two snapshots by title never substitutes for ID identity", () => {
  // Same title, different IDs -- must not be treated as "the same decision, unchanged".
  const current = snapshot({ id: "snap-a", title: "Same title", priority_rank: 1 });
  const previous = snapshot({ id: "snap-b", title: "Same title", priority_rank: 1 });
  const result = compareDecisionSnapshots(current, previous, [trace()], [trace()]);
  assert.equal(result.previousDecisionId, "snap-b");
  assert.equal(result.currentDecisionId, "snap-a");
});

// --- Explanations ---------------------------------------------------------------------

test("buildChangeExplanation: never claims causation beyond what evidence supports (no 'caused' language)", () => {
  const current = snapshot();
  const text = buildChangeExplanation({
    changeType: DecisionChangeTypes.INCREASED_PRIORITY,
    current,
    previous: snapshot({ id: "snap-0" }),
    evidenceAdded: [trace({ evidenceType: DecisionEvidenceTypes.MARKETING_MEMORY_LEARNING })],
    evidenceRemoved: [],
  });
  assert.doesNotMatch(text, /\bcaused\b/i);
});

test("buildChangeExplanation: unchanged case never implies a fabricated reason", () => {
  const current = snapshot();
  const text = buildChangeExplanation({
    changeType: DecisionChangeTypes.UNCHANGED,
    current,
    previous: snapshot({ id: "snap-0" }),
    evidenceAdded: [],
    evidenceRemoved: [],
  });
  assert.match(text, /no new evidence/i);
});

test("buildChangeExplanation is deterministic for identical inputs", () => {
  const input = {
    changeType: DecisionChangeTypes.INCREASED_PRIORITY,
    current: snapshot(),
    previous: snapshot({ id: "snap-0" }),
    evidenceAdded: [trace()],
    evidenceRemoved: [],
  };
  assert.equal(buildChangeExplanation(input), buildChangeExplanation(input));
});

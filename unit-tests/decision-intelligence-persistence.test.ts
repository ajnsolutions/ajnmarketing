import assert from "node:assert/strict";
import test from "node:test";
import {
  getLatestActiveDecisionSnapshot,
  recordDecisionSnapshot,
} from "../lib/decision-intelligence/persistence.ts";
import { recordDecisionSnapshotForCurrentUser } from "../lib/decision-intelligence/snapshotService.ts";
import { computeDecisionInputFingerprint } from "../lib/decision-intelligence/fingerprint.ts";
import { createFakeSupabaseClient } from "./support/fake-supabase-client.ts";
import type { MarketingDirectorDecision } from "../lib/marketing-director/types.ts";

const USER = "user-1";
const OTHER = "user-2";
const BIZ = "biz-1";

function draft(overrides: Record<string, unknown> = {}) {
  return {
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
    input_fingerprint: "fp-1",
    evaluated_at: "2026-07-19T00:00:00.000Z",
    supersedes_decision_id: null,
    ...overrides,
  };
}

function snapshotRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "snap-1",
    user_id: USER,
    business_profile_id: BIZ,
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

function decision(overrides: Partial<MarketingDirectorDecision> = {}): MarketingDirectorDecision {
  return {
    decisionType: "high_value_recommendation",
    title: "Improve review activity",
    summary: "Request more reviews this week.",
    rationale: "internal",
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

// --- Decision persistence --------------------------------------------------------------

test("recordDecisionSnapshot: creates a snapshot from authoritative Marketing Director output", async () => {
  const created = snapshotRow();
  const { client, calls } = createFakeSupabaseClient({
    marketing_memory_decision_links: { data: created, error: null },
  });

  const result = await recordDecisionSnapshot(client, USER, BIZ, draft());
  assert.ok(result.snapshot);
  assert.equal(result.snapshot!.title, "Improve review activity");
  const insertCall = calls.find((c) => c.table === "marketing_memory_decision_links" && c.op === "insert");
  assert.ok(insertCall);
});

test("recordDecisionSnapshot: a unique-constraint violation returns the already-existing row (idempotent)", async () => {
  const existing = snapshotRow();
  const { client } = createFakeSupabaseClient({
    marketing_memory_decision_links: (op) => {
      if (op === "single") return { data: null, error: { code: "23505", message: "duplicate" } };
      return { data: existing, error: null };
    },
  });

  const result = await recordDecisionSnapshot(client, USER, BIZ, draft());
  assert.ok(result.snapshot);
  assert.equal(result.snapshot!.id, "snap-1");
});

test("recordDecisionSnapshotForCurrentUser: identical decision run is idempotent (no insert)", async () => {
  const fixedDecision = decision();
  const matchingFingerprint = computeDecisionInputFingerprint(fixedDecision);
  const existing = snapshotRow({ input_fingerprint: matchingFingerprint });
  const { client, calls } = createFakeSupabaseClient({
    marketing_memory_decision_links: { data: existing, error: null },
  });

  const result = await recordDecisionSnapshotForCurrentUser(client, USER, BIZ, fixedDecision);
  assert.equal(result.recorded, false);
  assert.equal(result.snapshot!.id, existing.id);

  const insertCalls = calls.filter((c) => c.table === "marketing_memory_decision_links" && c.op === "insert");
  assert.equal(insertCalls.length, 0, "identical fingerprint must never insert a duplicate row");
});

test("recordDecisionSnapshotForCurrentUser: a changed decision (different fingerprint) creates a new snapshot", async () => {
  const fixedDecision = decision();
  const existing = snapshotRow({ id: "snap-old", input_fingerprint: "definitely-not-matching" });
  const created = snapshotRow({ id: "snap-new", input_fingerprint: computeDecisionInputFingerprint(fixedDecision) });
  const { client, calls } = createFakeSupabaseClient({
    marketing_memory_decision_links: (op) => {
      if (op === "maybeSingle") return { data: existing, error: null };
      if (op === "single") return { data: created, error: null };
      if (op === "update") return { data: created, error: null };
      return { data: existing, error: null };
    },
  });

  const result = await recordDecisionSnapshotForCurrentUser(client, USER, BIZ, fixedDecision);
  assert.equal(result.recorded, true);
  assert.equal(result.snapshot!.id, "snap-new");
  const insertCalls = calls.filter((c) => c.table === "marketing_memory_decision_links" && c.op === "insert");
  assert.equal(insertCalls.length, 1);
});

test("recordDecisionSnapshotForCurrentUser: a changed decision creates a new snapshot and supersedes the old one", async () => {
  const oldActive = snapshotRow({ id: "snap-old", input_fingerprint: "fp-old" });
  const newSnapshot = snapshotRow({ id: "snap-new", input_fingerprint: "fp-new" });
  const { client, calls } = createFakeSupabaseClient({
    marketing_memory_decision_links: (op) => {
      if (op === "maybeSingle") return { data: oldActive, error: null };
      if (op === "single") return { data: newSnapshot, error: null };
      if (op === "update") return { data: newSnapshot, error: null };
      return { data: oldActive, error: null };
    },
  });

  const result = await recordDecisionSnapshotForCurrentUser(client, USER, BIZ, decision());
  assert.equal(result.recorded, true);
  const updateCall = calls.find((c) => c.table === "marketing_memory_decision_links" && c.op === "update");
  assert.ok(updateCall, "expected the prior active snapshot to be superseded");
});

test("recordDecisionSnapshotForCurrentUser: a failure never throws (best-effort)", async () => {
  const { client } = createFakeSupabaseClient({
    marketing_memory_decision_links: { data: null, error: { message: "db unavailable" } },
  });

  const result = await recordDecisionSnapshotForCurrentUser(client, USER, BIZ, decision());
  assert.equal(result.recorded, false);
  assert.equal(result.snapshot, null);
});

test("getLatestActiveDecisionSnapshot: cross-tenant isolation -- lookups always filter by caller user_id", async () => {
  const { client, calls } = createFakeSupabaseClient({
    marketing_memory_decision_links: { data: snapshotRow(), error: null },
  });

  await getLatestActiveDecisionSnapshot(client, OTHER, BIZ);
  const userIdFilters = calls
    .filter((c) => c.table === "marketing_memory_decision_links" && c.op === "eq" && c.args[0] === "user_id")
    .map((c) => c.args[1]);
  assert.deepEqual(userIdFilters, [OTHER]);
});

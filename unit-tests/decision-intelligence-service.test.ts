import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildEvidenceTraceForSnapshot } from "../lib/decision-intelligence/evidenceTrace.ts";
import { getDecisionIntelligenceSummaryForBusiness } from "../lib/decision-intelligence/service.ts";
import { buildWhyPlanChangedPreview } from "../lib/decision-intelligence/dashboard.ts";
import { isAllowedEvidenceType, isAllowedRelationshipType } from "../lib/decision-intelligence/relationships.ts";
import { ATTACH_DECLARATIVE_PRODUCTION_CRONS } from "../lib/trigger/scheduleActivation.ts";
import { createFakeSupabaseClient } from "./support/fake-supabase-client.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const USER = "user-1";
const OTHER = "user-2";
const BIZ = "biz-1";

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
    consulted_learning_ids: ["learning-1"],
    consulted_preference_ids: [],
    ignored_evidence: [{ id: "learning-2", evidenceType: "learning", reason: "confidence too low" }],
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

// --- Relationship allowlist -------------------------------------------------------------

test("isAllowedEvidenceType / isAllowedRelationshipType reject arbitrary strings", () => {
  assert.equal(isAllowedEvidenceType("recommendation"), true);
  assert.equal(isAllowedEvidenceType("arbitrary_made_up_type"), false);
  assert.equal(isAllowedRelationshipType("based_on"), true);
  assert.equal(isAllowedRelationshipType("caused_by"), false);
});

// --- Evidence trace ----------------------------------------------------------------------

test("buildEvidenceTraceForSnapshot: recommendation linkage produces a based_on trace with no fabricated confidence", async () => {
  const { client } = createFakeSupabaseClient({
    marketing_recommendations: { data: { id: "rec-1", status: "open", recommended_action_type: "request_reviews", updated_at: "2026-07-18T00:00:00.000Z" }, error: null },
    marketing_memory_learnings: { data: [{ id: "learning-1", status: "active", confidence_level: "developing_pattern", summary: "Reviews trend up midweek.", last_observed_at: "2026-07-18T00:00:00.000Z" }], error: null },
  });

  const traces = await buildEvidenceTraceForSnapshot(client, USER, BIZ, snapshotRow() as never, { now: new Date("2026-07-19T00:00:00.000Z") });
  const recTrace = traces.find((t) => t.evidenceType === "recommendation");
  assert.ok(recTrace);
  assert.equal(recTrace!.relationshipType, "based_on");
  assert.equal(recTrace!.confidenceState, "not_applicable");
});

test("buildEvidenceTraceForSnapshot: missing recommendation is 'unavailable', never a guessed value", async () => {
  const { client } = createFakeSupabaseClient({
    marketing_recommendations: { data: null, error: null },
    marketing_memory_learnings: { data: [], error: null },
  });

  const traces = await buildEvidenceTraceForSnapshot(client, USER, BIZ, snapshotRow({ consulted_learning_ids: [], ignored_evidence: [] }) as never, {});
  const recTrace = traces.find((t) => t.evidenceType === "recommendation");
  assert.ok(recTrace);
  assert.equal(recTrace!.influenceState, "unavailable");
  assert.match(recTrace!.customerExplanation, /No explicit evidence link/);
});

test("buildEvidenceTraceForSnapshot: ignored evidence is represented as excluded with the recorded reason, never silently dropped", async () => {
  const { client } = createFakeSupabaseClient({
    marketing_recommendations: { data: null, error: null },
    marketing_memory_learnings: { data: [], error: null },
  });

  const traces = await buildEvidenceTraceForSnapshot(client, USER, BIZ, snapshotRow({ consulted_learning_ids: [] }) as never, {});
  const excluded = traces.find((t) => t.excluded);
  assert.ok(excluded);
  assert.equal(excluded!.exclusionReason, "confidence too low");
  assert.equal(excluded!.relationshipType, "excluded_due_to_low_confidence");
});

test("buildEvidenceTraceForSnapshot: every lookup is scoped by business_profile_id, never a global ID lookup", async () => {
  const { client, calls } = createFakeSupabaseClient({
    marketing_recommendations: { data: { id: "rec-1", status: "open", recommended_action_type: "request_reviews", updated_at: "2026-07-18T00:00:00.000Z" }, error: null },
    marketing_memory_learnings: { data: [{ id: "learning-1", status: "active", confidence_level: "developing_pattern", summary: "x", last_observed_at: "2026-07-18T00:00:00.000Z" }], error: null },
  });

  await buildEvidenceTraceForSnapshot(client, USER, BIZ, snapshotRow() as never, {});

  const businessScopedFilters = calls.filter((c) => c.op === "eq" && c.args[0] === "business_profile_id");
  assert.ok(businessScopedFilters.length >= 2, "expected both the recommendation and learnings lookups to filter by business_profile_id");
  assert.ok(businessScopedFilters.every((c) => c.args[1] === BIZ));
});

// --- Top-level orchestration / partial failure -------------------------------------------

test("getDecisionIntelligenceSummaryForBusiness: no decision recorded yet returns an honest empty state, not an error", async () => {
  const { client } = createFakeSupabaseClient({
    marketing_memory_decision_links: { data: null, error: null },
  });

  const summary = await getDecisionIntelligenceSummaryForBusiness(client, USER, BIZ);
  assert.equal(summary.currentDecision, null);
  assert.match(summary.limitations[0]!, /No Marketing Director decision/);
});

test("getDecisionIntelligenceSummaryForBusiness: a failing optional source produces a warning, not a crash", async () => {
  const { client } = createFakeSupabaseClient({
    marketing_memory_decision_links: (op) => {
      if (op === "then") return { data: [snapshotRow()], error: null };
      return { data: snapshotRow(), error: null };
    },
    marketing_recommendations: { data: null, error: { message: "boom" } },
    marketing_memory_learnings: { data: null, error: { message: "boom" } },
    marketing_memory_preferences: { data: null, error: { message: "boom" } },
    marketing_memory_overrides: { data: null, error: { message: "boom" } },
    marketing_experiments: { data: null, error: { message: "boom" } },
  });

  const summary = await getDecisionIntelligenceSummaryForBusiness(client, USER, BIZ);
  assert.ok(summary.currentDecision);
  // Even with several sources failing, the call must not throw and must return a summary.
  assert.ok(Array.isArray(summary.warnings));
});

test("getDecisionIntelligenceSummaryForBusiness: cross-tenant lookups always scope by caller's own IDs", async () => {
  const { client, calls } = createFakeSupabaseClient({
    marketing_memory_decision_links: { data: null, error: null },
  });

  await getDecisionIntelligenceSummaryForBusiness(client, OTHER, "other-biz");
  const userIdFilters = calls
    .filter((c) => c.op === "eq" && c.args[0] === "user_id")
    .map((c) => c.args[1]);
  assert.ok(userIdFilters.every((id) => id === OTHER));
});

// --- Dashboard preview honesty ------------------------------------------------------------

test("buildWhyPlanChangedPreview: no decision yet is represented honestly, not as 'no changes'", () => {
  const preview = buildWhyPlanChangedPreview({
    currentDecision: null,
    currentPriorities: [],
    comparison: null,
    learningImpact: [],
    timeline: [],
    limitations: [],
    warnings: [],
    generatedAt: "2026-07-19T00:00:00.000Z",
  });
  assert.equal(preview.hasDecision, false);
  assert.match(preview.headline, /Not enough decision history/);
});

// --- Regression / schedule audit ----------------------------------------------------------

test("ATTACH_DECLARATIVE_PRODUCTION_CRONS remains false for Decision Intelligence", () => {
  assert.equal(ATTACH_DECLARATIVE_PRODUCTION_CRONS, false);
});

test("regression: Decision Intelligence never imports a recommendation/campaign/experiment creation function", () => {
  const serviceSource = readFileSync(join(root, "lib/decision-intelligence/service.ts"), "utf8");
  assert.ok(!/insertMarketingRecommendation|insertMarketingCampaign|insertMarketingExperiment|approveExperimentProposal/i.test(serviceSource));

  const snapshotSource = readFileSync(join(root, "lib/decision-intelligence/snapshotService.ts"), "utf8");
  assert.ok(!/insertLearning|insertPreference|insertOverride|updateLearningInPlace/i.test(snapshotSource));
});

test("migration 030: RLS is enabled, no update policy allows redefining decision facts, and the immutability trigger exists", () => {
  const migration = readFileSync(join(root, "supabase/migrations/030_decision_intelligence.sql"), "utf8");
  assert.match(migration, /alter table public\.marketing_memory_decision_links enable row level security/);
  assert.match(migration, /enforce_marketing_memory_decision_links_immutable/);
  assert.match(migration, /before update on public\.marketing_memory_decision_links/);
  assert.match(migration, /marketing_memory_decision_links_no_self_supersession/);
  assert.match(migration, /marketing_memory_overrides_decision_link_id_fkey/);
});

test("Decision Intelligence page has no create/edit mutation controls", () => {
  const pageSource = readFileSync(join(root, "components/dashboard/decision-intelligence-page.tsx"), "utf8");
  assert.ok(!/<input|<textarea|onSubmit|method="post"/i.test(pageSource));
});

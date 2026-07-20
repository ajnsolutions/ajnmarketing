import assert from "node:assert/strict";
import test from "node:test";
import {
  approveExperimentProposalForUser,
  evaluateAndPersistExperimentProposalsForBusiness,
  listExperimentProposalsForBusiness,
} from "../lib/marketing-experimentation/proposal-service.ts";
import { ExperimentStatuses } from "../lib/marketing-experimentation/experiment-types.ts";
import { createFakeSupabaseClient } from "./support/fake-supabase-client.ts";

const USER = "user-1";
const OTHER = "user-2";
const BIZ = "biz-1";
const REC = "rec-1";

function recommendationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: REC,
    user_id: USER,
    business_profile_id: BIZ,
    recommended_action_type: "publish_gbp_post",
    status: "open",
    priority_score: 80,
    urgency: "medium",
    business_impact: "medium",
    estimated_effort: "low",
    confidence: 70,
    reasoning: "",
    related_opportunity_ids: [],
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

function snapshotRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "snap-1",
    user_id: USER,
    business_profile_id: BIZ,
    snapshot_date: "2026-07-18",
    google_views: 10,
    searches: 1,
    calls: 1,
    direction_requests: 1,
    website_clicks: 1,
    review_count: 1,
    average_rating: 4.5,
    posts_published: 1,
    engagement_score: 1,
    metadata: {},
    created_at: "2026-07-18T00:00:00.000Z",
    ...overrides,
  };
}

function proposalRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "prop-1",
    user_id: USER,
    business_profile_id: BIZ,
    recommendation_id: REC,
    campaign_id: null,
    experiment_type: "posting_time",
    title: "Posting time",
    hypothesis: "Mid-week posts earn more engagement than weekend posts.",
    control_definition: { key: "control", label: "Mid-week", description: "Publish Tuesday–Thursday mornings." },
    treatment_definition: { key: "treatment", label: "Weekend", description: "Publish Saturday–Sunday mornings." },
    primary_kpi: "engagement",
    secondary_kpis: [],
    measurement_window_days: 14,
    proposal_status: "pending",
    decision_reason: "eligible",
    marketing_director_decision_key: "eligibility_rule_v1|x",
    template_id: "tmpl_posting_time_v1",
    created_at: "2026-07-18T00:00:00.000Z",
    updated_at: "2026-07-18T00:00:00.000Z",
    approved_at: null,
    approved_by: null,
    converted_experiment_id: null,
    ...overrides,
  };
}

// --- Marketing Director proposal creation --------------------------------------------

test("evaluateAndPersistExperimentProposalsForBusiness: eligible recommendation creates a bounded proposal", async () => {
  const created = proposalRow();
  const { client } = createFakeSupabaseClient({
    marketing_recommendations: { data: [recommendationRow()], error: null },
    analytics_snapshots: { data: [snapshotRow(), snapshotRow(), snapshotRow()], error: null },
    marketing_experiments: { data: [], error: null },
    marketing_experiment_proposals: (op) => {
      if (op === "maybeSingle") return { data: null, error: null }; // no existing pending
      if (op === "single") return { data: created, error: null };
      return { data: [], error: null };
    },
  });

  const summary = await evaluateAndPersistExperimentProposalsForBusiness(client, USER, BIZ);
  assert.equal(summary.evaluated, 1);
  assert.equal(summary.proposed, 1);
});

test("evaluateAndPersistExperimentProposalsForBusiness: dismissed recommendation creates no proposal", async () => {
  const { client } = createFakeSupabaseClient({
    marketing_recommendations: { data: [recommendationRow({ status: "dismissed" })], error: null },
    analytics_snapshots: { data: [snapshotRow(), snapshotRow(), snapshotRow()], error: null },
    marketing_experiments: { data: [], error: null },
  });

  const summary = await evaluateAndPersistExperimentProposalsForBusiness(client, USER, BIZ);
  assert.equal(summary.proposed, 0);
  assert.equal(summary.skipped.length, 1);
});

test("evaluateAndPersistExperimentProposalsForBusiness: superseded recommendation creates no proposal", async () => {
  const { client } = createFakeSupabaseClient({
    marketing_recommendations: { data: [recommendationRow({ status: "superseded" })], error: null },
    analytics_snapshots: { data: [snapshotRow(), snapshotRow(), snapshotRow()], error: null },
    marketing_experiments: { data: [], error: null },
  });

  const summary = await evaluateAndPersistExperimentProposalsForBusiness(client, USER, BIZ);
  assert.equal(summary.proposed, 0);
});

test("evaluateAndPersistExperimentProposalsForBusiness: unsupported action type creates no proposal", async () => {
  const { client } = createFakeSupabaseClient({
    marketing_recommendations: { data: [recommendationRow({ recommended_action_type: "upload_photos" })], error: null },
    analytics_snapshots: { data: [snapshotRow(), snapshotRow(), snapshotRow()], error: null },
    marketing_experiments: { data: [], error: null },
  });

  const summary = await evaluateAndPersistExperimentProposalsForBusiness(client, USER, BIZ);
  assert.equal(summary.proposed, 0);
});

test("evaluateAndPersistExperimentProposalsForBusiness: insufficient analytics history creates no proposal", async () => {
  const { client } = createFakeSupabaseClient({
    marketing_recommendations: { data: [recommendationRow()], error: null },
    analytics_snapshots: { data: [snapshotRow()], error: null },
    marketing_experiments: { data: [], error: null },
  });

  const summary = await evaluateAndPersistExperimentProposalsForBusiness(client, USER, BIZ);
  assert.equal(summary.proposed, 0);
});

test("evaluateAndPersistExperimentProposalsForBusiness: duplicate proposal prevented when a pending one already exists", async () => {
  const { client } = createFakeSupabaseClient({
    marketing_recommendations: { data: [recommendationRow()], error: null },
    analytics_snapshots: { data: [snapshotRow(), snapshotRow(), snapshotRow()], error: null },
    marketing_experiments: { data: [], error: null },
    marketing_experiment_proposals: (op) => {
      if (op === "maybeSingle") return { data: proposalRow(), error: null }; // already pending
      return { data: [], error: null };
    },
  });

  const summary = await evaluateAndPersistExperimentProposalsForBusiness(client, USER, BIZ);
  assert.equal(summary.proposed, 0);
});

test("evaluateAndPersistExperimentProposalsForBusiness: recommendation belonging to a different business is skipped", async () => {
  const { client } = createFakeSupabaseClient({
    marketing_recommendations: { data: [recommendationRow({ business_profile_id: "other-biz" })], error: null },
    analytics_snapshots: { data: [snapshotRow(), snapshotRow(), snapshotRow()], error: null },
    marketing_experiments: { data: [], error: null },
  });

  const summary = await evaluateAndPersistExperimentProposalsForBusiness(client, USER, BIZ);
  assert.equal(summary.evaluated, 0);
  assert.equal(summary.proposed, 0);
});

// --- Reads -----------------------------------------------------------------------------

test("listExperimentProposalsForBusiness: returns customer-safe cards", async () => {
  const { client } = createFakeSupabaseClient({
    marketing_experiment_proposals: { data: [proposalRow()], error: null },
  });

  const cards = await listExperimentProposalsForBusiness(client, USER, BIZ);
  assert.equal(cards.length, 1);
  assert.equal(cards[0]!.recommendationId, REC);
  assert.equal(cards[0]!.controlDefinition.key, "control");
});

// --- Approval and conversion ------------------------------------------------------------

test("approveExperimentProposalForUser: valid approval creates exactly one experiment", async () => {
  const pending = proposalRow({ proposal_status: "pending" });
  const approved = { ...pending, proposal_status: "approved", approved_at: "2026-07-19T00:00:00.000Z", approved_by: USER };
  const createdExperiment = {
    id: "exp-1",
    user_id: USER,
    business_profile_id: BIZ,
    experiment_type: "posting_time",
    title: "Posting time",
    hypothesis: pending.hypothesis,
    status: ExperimentStatuses.APPROVED,
    variants: [pending.control_definition, pending.treatment_definition],
    outcome: { direction: "insufficient_data", confidenceLevel: "insufficient", winningVariantKey: null, summary: "Not enough measured data yet.", primaryMetric: "engagement", liftPercent: null, attributionAvailable: false },
    metrics: { primaryMetric: "engagement", aggregateValue: null, measurementStart: null, measurementEnd: null },
    created_from_recommendation_id: REC,
    related_campaign_id: null,
    marketing_director_decision_key: pending.marketing_director_decision_key,
    template_id: pending.template_id,
    source_proposal_id: pending.id,
    started_at: null,
    measured_at: null,
    completed_at: null,
    schema_version: 1,
    created_at: "2026-07-19T00:00:00.000Z",
    updated_at: "2026-07-19T00:00:00.000Z",
  };

  const { client, calls } = createFakeSupabaseClient({
    marketing_experiment_proposals: (op) => {
      if (op === "maybeSingle") return { data: pending, error: null };
      if (op === "update") return { data: approved, error: null };
      return { data: approved, error: null };
    },
    marketing_recommendations: { data: recommendationRow(), error: null },
    marketing_experiments: (op) => {
      if (op === "maybeSingle") return { data: null, error: null }; // self-heal lookup finds nothing
      return { data: createdExperiment, error: null };
    },
  });

  const result = await approveExperimentProposalForUser(client, USER, BIZ, "prop-1");
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.experiment.source_proposal_id, "prop-1");
    assert.equal(result.experiment.status, ExperimentStatuses.APPROVED);
  }
  const insertCall = calls.find((c) => c.table === "marketing_experiments" && c.op === "insert");
  assert.ok(insertCall, "expected exactly one experiment insert");
});

test("approveExperimentProposalForUser: repeated approval is idempotent (returns the same experiment)", async () => {
  const experimentId = "exp-1";
  const already = proposalRow({ proposal_status: "approved", converted_experiment_id: experimentId, approved_at: "x", approved_by: USER });
  const experiment = {
    id: experimentId,
    user_id: USER,
    business_profile_id: BIZ,
    experiment_type: "posting_time",
    title: "Posting time",
    hypothesis: "x",
    status: ExperimentStatuses.RUNNING,
    variants: [],
    outcome: { direction: "insufficient_data", confidenceLevel: "insufficient", winningVariantKey: null, summary: "", primaryMetric: "engagement", liftPercent: null, attributionAvailable: false },
    metrics: { primaryMetric: "engagement", aggregateValue: null, measurementStart: null, measurementEnd: null },
    created_from_recommendation_id: REC,
    related_campaign_id: null,
    marketing_director_decision_key: "x",
    template_id: "tmpl_posting_time_v1",
    source_proposal_id: already.id,
    started_at: null,
    measured_at: null,
    completed_at: null,
    schema_version: 1,
    created_at: "x",
    updated_at: "x",
  };

  const { client, calls } = createFakeSupabaseClient({
    marketing_experiment_proposals: { data: already, error: null },
    marketing_experiments: { data: experiment, error: null },
  });

  const first = await approveExperimentProposalForUser(client, USER, BIZ, "prop-1");
  const second = await approveExperimentProposalForUser(client, USER, BIZ, "prop-1");
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  if (first.ok && second.ok) {
    assert.equal(first.experiment.id, second.experiment.id);
  }
  const insertCalls = calls.filter((c) => c.table === "marketing_experiments" && c.op === "insert");
  assert.equal(insertCalls.length, 0, "idempotent approval must never insert a new experiment");
});

test("approveExperimentProposalForUser: cross-tenant proposal cannot be approved (404)", async () => {
  const { client } = createFakeSupabaseClient({
    marketing_experiment_proposals: { data: null, error: null }, // scoped lookup finds nothing for OTHER
  });

  const result = await approveExperimentProposalForUser(client, OTHER, "other-biz", "prop-1");
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 404);
});

test("approveExperimentProposalForUser: expired proposal cannot create an experiment", async () => {
  const expired = proposalRow({ proposal_status: "expired" });
  const { client, calls } = createFakeSupabaseClient({
    marketing_experiment_proposals: { data: expired, error: null },
  });

  const result = await approveExperimentProposalForUser(client, USER, BIZ, "prop-1");
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 409);
  const insertCalls = calls.filter((c) => c.table === "marketing_experiments" && c.op === "insert");
  assert.equal(insertCalls.length, 0);
});

test("approveExperimentProposalForUser: recommendation eligibility is rechecked at approval time", async () => {
  const pending = proposalRow({ proposal_status: "pending" });
  const { client, calls } = createFakeSupabaseClient({
    marketing_experiment_proposals: { data: pending, error: null },
    // Recommendation is no longer open by the time of approval.
    marketing_recommendations: { data: null, error: null },
  });

  const result = await approveExperimentProposalForUser(client, USER, BIZ, "prop-1");
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 409);
  const insertCalls = calls.filter((c) => c.table === "marketing_experiments" && c.op === "insert");
  assert.equal(insertCalls.length, 0, "no direct experiment insert without eligibility recheck passing");
});

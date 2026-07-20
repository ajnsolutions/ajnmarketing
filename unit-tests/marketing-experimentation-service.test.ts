import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceExperimentForUser,
  completeExperimentForUser,
  getExperimentDashboardForBusiness,
  measureExperimentForUser,
  proposeExperimentForBusiness,
} from "../lib/marketing-experimentation/experiment-service.ts";
import { toExperimentDashboardCard } from "../lib/marketing-experimentation/experiment-dashboard.ts";
import {
  ExperimentStatuses,
  ExperimentTypes,
} from "../lib/marketing-experimentation/experiment-types.ts";
import { MarketingMemoryObservationTypes } from "../lib/marketing-memory/types.ts";
import { createFakeSupabaseClient, userIdsQueried } from "./support/fake-supabase-client.ts";

const USER = "user-1";
const OTHER = "user-2";
const BIZ = "biz-1";
const REC = "rec-1";

function experimentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "exp-1",
    user_id: USER,
    business_profile_id: BIZ,
    experiment_type: ExperimentTypes.POSTING_TIME,
    title: "Posting time",
    hypothesis: "Mid-week posts earn more engagement than weekend posts.",
    status: ExperimentStatuses.DRAFT,
    variants: [
      { key: "a", label: "Mid-week", description: "Publish Tuesday–Thursday mornings." },
      { key: "b", label: "Weekend", description: "Publish Saturday–Sunday mornings." },
    ],
    outcome: {
      direction: "insufficient_data",
      confidenceLevel: "insufficient",
      winningVariantKey: null,
      summary: "Not enough measured data yet.",
      primaryMetric: "engagement",
      liftPercent: null,
    },
    metrics: {
      engagementA: 0,
      engagementB: 0,
      clicksA: 0,
      clicksB: 0,
      reviewsA: 0,
      reviewsB: 0,
      reachA: 0,
      reachB: 0,
      conversionsA: 0,
      conversionsB: 0,
      publishingConsistencyA: 0,
      publishingConsistencyB: 0,
    },
    created_from_recommendation_id: REC,
    related_campaign_id: null,
    marketing_director_decision_key: "md|key",
    template_id: "tmpl_posting_time_v1",
    started_at: null,
    measured_at: null,
    completed_at: null,
    schema_version: 1,
    created_at: "2026-07-18T00:00:00.000Z",
    updated_at: "2026-07-18T00:00:00.000Z",
    ...overrides,
  };
}

test("proposeExperimentForBusiness: Marketing Director required", async () => {
  const { client } = createFakeSupabaseClient({
    marketing_recommendations: {
      data: { id: REC, business_profile_id: BIZ, user_id: USER, status: "open" },
      error: null,
    },
    marketing_experiments: { data: experimentRow(), error: null },
  });

  const refused = await proposeExperimentForBusiness(
    USER,
    BIZ,
    {
      experimentType: ExperimentTypes.POSTING_TIME,
      createdFromRecommendationId: REC,
      marketingDirectorDecisionKey: "x",
      proposedBy: "experiment_engine",
    } as never,
    { supabaseClient: client },
  );
  assert.equal(refused.ok, false);
  if (!refused.ok) assert.equal(refused.status, 403);
});

test("proposeExperimentForBusiness: recommendation must belong to tenant", async () => {
  const { client } = createFakeSupabaseClient({
    marketing_recommendations: { data: null, error: null },
  });

  const result = await proposeExperimentForBusiness(
    USER,
    BIZ,
    {
      experimentType: ExperimentTypes.POSTING_TIME,
      createdFromRecommendationId: REC,
      marketingDirectorDecisionKey: "md|key",
      proposedBy: "marketing_director",
    },
    { supabaseClient: client },
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 400);
    assert.match(result.error, /Recommendation/);
  }
});

test("proposeExperimentForBusiness: creates draft linked to recommendation", async () => {
  const created = experimentRow({ related_campaign_id: "camp-1" });
  const { client } = createFakeSupabaseClient({
    marketing_recommendations: {
      data: { id: REC, business_profile_id: BIZ, user_id: USER, status: "open" },
      error: null,
    },
    marketing_campaigns: {
      data: { id: "camp-1", business_profile_id: BIZ, user_id: USER },
      error: null,
    },
    marketing_experiments: (op) => {
      if (op === "single") return { data: created, error: null };
      return { data: created, error: null };
    },
  });

  const result = await proposeExperimentForBusiness(
    USER,
    BIZ,
    {
      experimentType: ExperimentTypes.POSTING_TIME,
      createdFromRecommendationId: REC,
      marketingDirectorDecisionKey: "md|key",
      relatedCampaignId: "camp-1",
      proposedBy: "marketing_director",
    },
    { supabaseClient: client },
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.experiment.created_from_recommendation_id, REC);
    assert.equal(result.experiment.related_campaign_id, "camp-1");
  }
});

test("proposeExperimentForBusiness: dismissed recommendation is rejected", async () => {
  const { client } = createFakeSupabaseClient({
    marketing_recommendations: {
      data: { id: REC, business_profile_id: BIZ, user_id: USER, status: "dismissed" },
      error: null,
    },
  });

  const result = await proposeExperimentForBusiness(
    USER,
    BIZ,
    {
      experimentType: ExperimentTypes.POSTING_TIME,
      createdFromRecommendationId: REC,
      marketingDirectorDecisionKey: "md|key",
      proposedBy: "marketing_director",
    },
    { supabaseClient: client },
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 400);
    assert.match(result.error, /no longer eligible/);
  }
});

test("proposeExperimentForBusiness: superseded recommendation is rejected", async () => {
  const { client } = createFakeSupabaseClient({
    marketing_recommendations: {
      data: { id: REC, business_profile_id: BIZ, user_id: USER, status: "superseded" },
      error: null,
    },
  });

  const result = await proposeExperimentForBusiness(
    USER,
    BIZ,
    {
      experimentType: ExperimentTypes.POSTING_TIME,
      createdFromRecommendationId: REC,
      marketingDirectorDecisionKey: "md|key",
      proposedBy: "marketing_director",
    },
    { supabaseClient: client },
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 400);
});

test("proposeExperimentForBusiness: cross-tenant campaign is rejected", async () => {
  const { client } = createFakeSupabaseClient({
    marketing_recommendations: {
      data: { id: REC, business_profile_id: BIZ, user_id: USER, status: "open" },
      error: null,
    },
    // Campaign lookup scoped to this tenant finds nothing — it belongs to another business.
    marketing_campaigns: { data: null, error: null },
  });

  const result = await proposeExperimentForBusiness(
    USER,
    BIZ,
    {
      experimentType: ExperimentTypes.POSTING_TIME,
      createdFromRecommendationId: REC,
      marketingDirectorDecisionKey: "md|key",
      relatedCampaignId: "other-tenant-campaign",
      proposedBy: "marketing_director",
    },
    { supabaseClient: client },
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 400);
    assert.match(result.error, /campaign/i);
  }
});

test("cross-tenant isolation: lookups filter by caller user_id and 404 when missing", async () => {
  const { client, calls } = createFakeSupabaseClient({
    marketing_experiments: { data: null, error: null },
  });

  const missing = await advanceExperimentForUser(OTHER, "exp-1", { supabaseClient: client });
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.status, 404);
  assert.deepEqual(userIdsQueried(calls), [OTHER]);
});

test("advanceExperimentForUser progresses lifecycle", async () => {
  const draft = experimentRow({ status: ExperimentStatuses.DRAFT });
  const proposed = { ...draft, status: ExperimentStatuses.PROPOSED };
  const { client } = createFakeSupabaseClient({
    marketing_experiments: (op) => {
      if (op === "maybeSingle") return { data: draft, error: null };
      if (op === "single") return { data: proposed, error: null };
      return { data: draft, error: null };
    },
  });

  const result = await advanceExperimentForUser(USER, "exp-1", { supabaseClient: client });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.experiment.status, ExperimentStatuses.PROPOSED);
});

test("measureExperimentForUser uses analytics KPIs deterministically", async () => {
  const running = experimentRow({ status: ExperimentStatuses.RUNNING });
  const measured = {
    ...running,
    status: ExperimentStatuses.MEASURING,
    metrics: {
      ...running.metrics,
      engagementA: 25,
      engagementB: 25,
    },
  };
  const { client } = createFakeSupabaseClient({
    marketing_experiments: (op) => {
      if (op === "maybeSingle") return { data: running, error: null };
      if (op === "single") return { data: measured, error: null };
      return { data: running, error: null };
    },
  });

  const first = await measureExperimentForUser(USER, "exp-1", {
    supabaseClient: client,
    loadLatestAnalytics: async () =>
      ({
        id: "snap-1",
        user_id: USER,
        business_profile_id: BIZ,
        snapshot_date: "2026-07-18",
        google_views: 100,
        searches: 10,
        calls: 4,
        direction_requests: 2,
        website_clicks: 20,
        review_count: 6,
        average_rating: 4.5,
        posts_published: 4,
        engagement_score: 50,
        metadata: {},
        created_at: "2026-07-18T00:00:00.000Z",
      }) as never,
  });
  const second = await measureExperimentForUser(USER, "exp-1", {
    supabaseClient: client,
    loadLatestAnalytics: async () =>
      ({
        id: "snap-1",
        user_id: USER,
        business_profile_id: BIZ,
        snapshot_date: "2026-07-18",
        google_views: 100,
        searches: 10,
        calls: 4,
        direction_requests: 2,
        website_clicks: 20,
        review_count: 6,
        average_rating: 4.5,
        posts_published: 4,
        engagement_score: 50,
        metadata: {},
        created_at: "2026-07-18T00:00:00.000Z",
      }) as never,
  });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
});

test("measureExperimentForUser splits evenly, never fabricating a variant B win", async () => {
  const running = experimentRow({ status: ExperimentStatuses.RUNNING });
  const { client, calls } = createFakeSupabaseClient({
    marketing_experiments: (op) => {
      if (op === "maybeSingle") return { data: running, error: null };
      return { data: { ...running, status: ExperimentStatuses.MEASURING }, error: null };
    },
  });

  await measureExperimentForUser(USER, "exp-1", {
    supabaseClient: client,
    loadLatestAnalytics: async () =>
      ({
        id: "snap-1",
        user_id: USER,
        business_profile_id: BIZ,
        snapshot_date: "2026-07-18",
        google_views: 101,
        searches: 10,
        calls: 5,
        direction_requests: 2,
        website_clicks: 21,
        review_count: 7,
        average_rating: 4.5,
        posts_published: 5,
        engagement_score: 51,
        metadata: {},
        created_at: "2026-07-18T00:00:00.000Z",
      }) as never,
  });

  const update = calls.find((call) => call.table === "marketing_experiments" && call.op === "update");
  assert.ok(update, "expected an update() call against marketing_experiments");
  const fields = update!.args[0] as { metrics: Record<string, number>; outcome: { direction: string; confidenceLevel: string } };
  // Every KPI total above is odd — a prior floor/ceil split would have made B = A + 1 for
  // all six metrics, guaranteeing a fabricated "variant B outperformed" outcome. Equal
  // split means A === B for every metric, and the outcome must be honest (no winner).
  assert.equal(fields.metrics.engagementA, fields.metrics.engagementB);
  assert.equal(fields.metrics.clicksA, fields.metrics.clicksB);
  assert.equal(fields.metrics.reviewsA, fields.metrics.reviewsB);
  assert.equal(fields.metrics.reachA, fields.metrics.reachB);
  assert.equal(fields.metrics.conversionsA, fields.metrics.conversionsB);
  assert.equal(fields.metrics.publishingConsistencyA, fields.metrics.publishingConsistencyB);
  assert.equal(fields.outcome.direction, "inconclusive");
  assert.notEqual(fields.outcome.confidenceLevel, "moderate");
  assert.notEqual(fields.outcome.confidenceLevel, "strong");
});

test("measureExperimentForUser rejects measuring a draft experiment", async () => {
  const draft = experimentRow({ status: ExperimentStatuses.DRAFT });
  const { client } = createFakeSupabaseClient({
    marketing_experiments: { data: draft, error: null },
  });

  const result = await measureExperimentForUser(USER, "exp-1", {
    supabaseClient: client,
    loadLatestAnalytics: async () => null,
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 409);
});

test("measureExperimentForUser rejects re-measuring a completed experiment", async () => {
  const completed = experimentRow({ status: ExperimentStatuses.COMPLETED });
  const { client } = createFakeSupabaseClient({
    marketing_experiments: { data: completed, error: null },
  });

  const result = await measureExperimentForUser(USER, "exp-1", {
    supabaseClient: client,
    loadLatestAnalytics: async () => null,
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 409);
});

test("completeExperimentForUser rejects completing directly from running (must measure first)", async () => {
  const running = experimentRow({ status: ExperimentStatuses.RUNNING });
  const { client } = createFakeSupabaseClient({
    marketing_experiments: { data: running, error: null },
  });

  const result = await completeExperimentForUser(USER, "exp-1", { supabaseClient: client });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 409);
});

test("completeExperimentForUser rejects completing an already-archived experiment", async () => {
  const archived = experimentRow({ status: ExperimentStatuses.ARCHIVED });
  const { client } = createFakeSupabaseClient({
    marketing_experiments: { data: archived, error: null },
  });

  const result = await completeExperimentForUser(USER, "exp-1", { supabaseClient: client });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 409);
});

test("completeExperimentForUser records experiment_completed observation once", async () => {
  const measuring = experimentRow({ status: ExperimentStatuses.MEASURING });
  const completed = {
    ...measuring,
    status: ExperimentStatuses.COMPLETED,
    completed_at: "2026-07-19T00:00:00.000Z",
  };
  let observationCalls = 0;
  const { client } = createFakeSupabaseClient({
    marketing_experiments: (op) => {
      if (op === "maybeSingle") return { data: measuring, error: null };
      if (op === "single") return { data: completed, error: null };
      return { data: measuring, error: null };
    },
  });

  const result = await completeExperimentForUser(USER, "exp-1", {
    supabaseClient: client,
    recordCompletionObservation: async (_supabase, experiment) => {
      observationCalls += 1;
      assert.equal(experiment.id, "exp-1");
      return { recorded: true, duplicate: false, observationId: "obs-exp-1" };
    },
  });

  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.experiment.status, ExperimentStatuses.COMPLETED);
  assert.equal(observationCalls, 1);
});

test("Marketing Memory observation type for completion is experiment_completed", async () => {
  const observationTypes: string[] = [];
  const measuring = experimentRow({ status: ExperimentStatuses.MEASURING });
  const completed = {
    ...measuring,
    status: ExperimentStatuses.COMPLETED,
    completed_at: "2026-07-19T00:00:00.000Z",
  };
  const { client } = createFakeSupabaseClient({
    marketing_experiments: (op) => {
      if (op === "maybeSingle") return { data: measuring, error: null };
      if (op === "single") return { data: completed, error: null };
      return { data: measuring, error: null };
    },
  });

  await completeExperimentForUser(USER, "exp-1", {
    supabaseClient: client,
    recordCompletionObservation: async () => {
      observationTypes.push(MarketingMemoryObservationTypes.EXPERIMENT_COMPLETED);
      return { recorded: true, duplicate: false, observationId: "obs-1" };
    },
  });

  assert.deepEqual(observationTypes, [MarketingMemoryObservationTypes.EXPERIMENT_COMPLETED]);
});

test("dashboard cards expose recommendation and campaign linkage", async () => {
  const active = experimentRow({
    status: ExperimentStatuses.RUNNING,
    related_campaign_id: "camp-7",
  });
  const { client } = createFakeSupabaseClient({
    marketing_experiments: { data: [active], error: null },
  });

  const dashboard = await getExperimentDashboardForBusiness(USER, BIZ, {
    supabaseClient: client,
  });
  const card = toExperimentDashboardCard(active as never);
  assert.equal(card.recommendationId, REC);
  assert.equal(card.campaignId, "camp-7");
  assert.ok(Array.isArray(dashboard.active));
  assert.ok(Array.isArray(dashboard.completed));
});

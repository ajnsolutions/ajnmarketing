import test from "node:test";
import assert from "node:assert/strict";
import {
  recordObservationForAnalyticsSnapshot,
  recordObservationForOutcomeEvent,
} from "../lib/marketing-memory/service.ts";
import { insertRecommendationOutcomeEvent } from "../lib/recommendation-outcomes/persistence.ts";
import { captureSnapshotForUser } from "../lib/analytics/analyticsEngine.ts";
import { REQUIRED_GOOGLE_BUSINESS_SCOPE } from "../lib/google-business-profile/oauth.ts";
import {
  MarketingMemoryLinkTypes,
  MarketingMemoryObservationTypes,
  MarketingMemorySourceEntityTypes,
} from "../lib/marketing-memory/types.ts";
import { createFakeSupabaseClient } from "./support/fake-supabase-client.ts";

const USER = "user-1";
const BIZ = "biz-1";
const REC_ID = "rec-1";
const APPROVAL_ID = "approval-1";
const JOB_ID = "job-1";
const EVENT_ID = "event-1";

function eventRow(overrides: Record<string, unknown> = {}) {
  return {
    id: EVENT_ID,
    user_id: USER,
    business_profile_id: BIZ,
    recommendation_id: REC_ID,
    content_approval_id: APPROVAL_ID,
    publishing_job_id: null,
    event_type: "draft_approved",
    event_version: 1,
    source: "system",
    idempotency_key: `${APPROVAL_ID}:draft_approved`,
    metadata: { note: "approved by owner" },
    created_at: "2026-07-02T09:00:00.000Z",
    ...overrides,
  };
}

function snapshotRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "snap-1",
    user_id: USER,
    business_profile_id: BIZ,
    snapshot_date: "2026-07-02",
    google_views: 50,
    searches: 10,
    calls: 4,
    direction_requests: 1,
    website_clicks: 6,
    review_count: 3,
    average_rating: 4.5,
    posts_published: 2,
    engagement_score: 61,
    metadata: { connected: true, monthlyTrends: [{ month: "2026-06", views: 40 }] },
    created_at: "2026-07-02T09:00:00.000Z",
    ...overrides,
  };
}

function baseMemoryTables(overrides: Record<string, unknown> = {}) {
  return {
    market_context_items: { data: [], error: null },
    marketing_memory_context_snapshots: { data: { id: "ctx-1" }, error: null },
    marketing_memory_observations: { data: null, error: null },
    marketing_memory_evidence_links: { data: [{ id: "link-1" }], error: null },
    ...overrides,
  };
}

// --- recordObservationForOutcomeEvent (service-level) ------------------------------

test("recordObservationForOutcomeEvent: happy path records an observation and its evidence links", async () => {
  const observationRow = {
    id: "obs-1",
    user_id: USER,
    business_profile_id: BIZ,
    observation_type: MarketingMemoryObservationTypes.RECOMMENDATION_APPROVED,
    source_system: "recommendation-outcomes",
    source_outcome_event_id: EVENT_ID,
    source_analytics_snapshot_id: null,
    context_snapshot_id: "ctx-1",
    occurred_at: "2026-07-02T09:00:00.000Z",
    outcome_direction: "positive",
    location_scope: null,
    metric_summary: { note: "approved by owner" },
    schema_version: 1,
    retention_classification: "long_term_audit_evidence",
    idempotency_key: `obs:${BIZ}:recommendation_outcome_event:${EVENT_ID}`,
    created_at: "2026-07-02T09:00:01.000Z",
  };

  const { client, calls } = createFakeSupabaseClient(
    baseMemoryTables({ marketing_memory_observations: { data: observationRow, error: null } })
  );

  const result = await recordObservationForOutcomeEvent(client, eventRow() as never);

  assert.equal(result.recorded, true);
  assert.equal(result.duplicate, false);
  assert.equal(result.observationId, "obs-1");

  const observationInsert = calls.find((c) => c.table === "marketing_memory_observations" && c.op === "insert");
  assert.ok(observationInsert);
  const [payload] = observationInsert!.args as [Record<string, unknown>];
  assert.equal(payload.observation_type, MarketingMemoryObservationTypes.RECOMMENDATION_APPROVED);
  assert.equal(payload.outcome_direction, "positive");
  assert.equal(payload.source_outcome_event_id, EVENT_ID);
  assert.equal(payload.source_analytics_snapshot_id, null);

  const evidenceUpsert = calls.find((c) => c.table === "marketing_memory_evidence_links" && c.op === "upsert");
  assert.ok(evidenceUpsert);
  const [links] = evidenceUpsert!.args as [Array<{ source_type: string; link_type: string; source_id: string }>];
  const bySourceType = Object.fromEntries(links.map((l) => [l.source_type, l]));

  assert.equal(bySourceType[MarketingMemorySourceEntityTypes.RECOMMENDATION_OUTCOME_EVENT].link_type, MarketingMemoryLinkTypes.PRIMARY_SOURCE);
  assert.equal(bySourceType[MarketingMemorySourceEntityTypes.RECOMMENDATION].source_id, REC_ID);
  assert.equal(bySourceType[MarketingMemorySourceEntityTypes.RECOMMENDATION].link_type, MarketingMemoryLinkTypes.RELATED_SOURCE);
  assert.equal(bySourceType[MarketingMemorySourceEntityTypes.CONTENT_APPROVAL].source_id, APPROVAL_ID);
  // No publishing_job_id on this event -> no publishing_job evidence link.
  assert.equal(bySourceType[MarketingMemorySourceEntityTypes.PUBLISHING_JOB], undefined);
});

test("recordObservationForOutcomeEvent: includes a publishing_job evidence link only when the event carries one", async () => {
  const { client, calls } = createFakeSupabaseClient(
    baseMemoryTables({
      marketing_memory_observations: {
        data: { id: "obs-2", observation_type: "publishing_succeeded", outcome_direction: "positive" },
        error: null,
      },
    })
  );

  await recordObservationForOutcomeEvent(
    client,
    eventRow({ event_type: "publishing_succeeded", publishing_job_id: JOB_ID }) as never
  );

  const evidenceUpsert = calls.find((c) => c.table === "marketing_memory_evidence_links" && c.op === "upsert");
  const [links] = evidenceUpsert!.args as [Array<{ source_type: string; source_id: string }>];
  const jobLink = links.find((l) => l.source_type === MarketingMemorySourceEntityTypes.PUBLISHING_JOB);
  assert.ok(jobLink);
  assert.equal(jobLink!.source_id, JOB_ID);
});

test("recordObservationForOutcomeEvent: a duplicate observation short-circuits before any evidence-link write", async () => {
  const { client, calls } = createFakeSupabaseClient(
    baseMemoryTables({
      marketing_memory_observations: { data: null, error: { code: "23505", message: "duplicate key" } },
    })
  );

  const result = await recordObservationForOutcomeEvent(client, eventRow() as never);

  assert.equal(result.recorded, false);
  assert.equal(result.duplicate, true);
  assert.equal(calls.some((c) => c.table === "marketing_memory_evidence_links"), false);
});

test("recordObservationForOutcomeEvent: an unexpected failure never throws, and is reported as not recorded", async () => {
  const { client } = createFakeSupabaseClient(
    baseMemoryTables({
      marketing_memory_observations: { data: null, error: { code: "42P01", message: "relation does not exist" } },
    })
  );

  const result = await recordObservationForOutcomeEvent(client, eventRow() as never);

  assert.equal(result.recorded, false);
  assert.equal(result.duplicate, false);
  assert.equal(result.observationId, null);
});

test("recordObservationForOutcomeEvent: missing/failed context resolution does not block the observation from being recorded", async () => {
  const { client } = createFakeSupabaseClient(
    baseMemoryTables({
      market_context_items: { data: null, error: { message: "provider unavailable" } },
      marketing_memory_context_snapshots: { data: null, error: { code: "500", message: "unreachable" } },
      marketing_memory_observations: {
        data: { id: "obs-3", observation_type: "recommendation_approved", outcome_direction: "positive" },
        error: null,
      },
    })
  );

  const result = await recordObservationForOutcomeEvent(client, eventRow() as never);
  assert.equal(result.recorded, true);
});

// --- recordObservationForAnalyticsSnapshot -----------------------------------------

test("recordObservationForAnalyticsSnapshot: records a bounded metric summary, never the raw metadata payload", async () => {
  const { client, calls } = createFakeSupabaseClient(
    baseMemoryTables({
      marketing_memory_observations: {
        data: { id: "obs-analytics-1", observation_type: MarketingMemoryObservationTypes.ANALYTICS_SNAPSHOT_CAPTURED },
        error: null,
      },
    })
  );

  const result = await recordObservationForAnalyticsSnapshot(client, snapshotRow() as never);
  assert.equal(result.recorded, true);

  const observationInsert = calls.find((c) => c.table === "marketing_memory_observations" && c.op === "insert");
  const [payload] = observationInsert!.args as [Record<string, unknown>];
  assert.equal(payload.observation_type, MarketingMemoryObservationTypes.ANALYTICS_SNAPSHOT_CAPTURED);
  assert.equal(payload.source_analytics_snapshot_id, "snap-1");
  assert.equal(payload.source_outcome_event_id, null);

  const metricSummary = payload.metric_summary as Record<string, unknown>;
  // Only the small, allowlisted numeric fields -- never the full metadata object
  // (which in this fixture contains a nested monthlyTrends array).
  assert.deepEqual(Object.keys(metricSummary).sort(), ["calls", "engagementScore", "googleViews", "websiteClicks"]);
  assert.equal(metricSummary.googleViews, 50);
});

// --- integration: real production hook points --------------------------------------

test("integration: insertRecommendationOutcomeEvent still returns its original result unchanged when memory ingestion fails", async () => {
  const { client } = createFakeSupabaseClient({
    recommendation_outcome_events: { data: eventRow(), error: null },
    ...baseMemoryTables({
      marketing_memory_observations: { data: null, error: { code: "42P01", message: "relation missing" } },
    }),
  });

  const result = await insertRecommendationOutcomeEvent(client, {
    userId: USER,
    businessProfileId: BIZ,
    recommendationId: REC_ID,
    contentApprovalId: APPROVAL_ID,
    eventType: "draft_approved",
    idempotencyKey: `${APPROVAL_ID}:draft_approved`,
  });

  assert.equal(result.duplicate, false);
  assert.ok(result.event);
  assert.equal(result.event!.id, EVENT_ID);
});

test("integration: insertRecommendationOutcomeEvent triggers Marketing Memory ingestion for a genuinely new event", async () => {
  const { calls, client } = createFakeSupabaseClient({
    recommendation_outcome_events: { data: eventRow(), error: null },
    ...baseMemoryTables({
      marketing_memory_observations: {
        data: { id: "obs-integration-1", observation_type: "recommendation_approved" },
        error: null,
      },
    }),
  });

  await insertRecommendationOutcomeEvent(client, {
    userId: USER,
    businessProfileId: BIZ,
    recommendationId: REC_ID,
    contentApprovalId: APPROVAL_ID,
    eventType: "draft_approved",
    idempotencyKey: `${APPROVAL_ID}:draft_approved`,
  });

  assert.ok(calls.some((c) => c.table === "marketing_memory_observations" && c.op === "insert"));
});

test("integration: insertRecommendationOutcomeEvent does NOT attempt memory ingestion for an already-duplicate event", async () => {
  const { calls, client } = createFakeSupabaseClient({
    recommendation_outcome_events: { data: null, error: { code: "23505", message: "duplicate key" } },
  });

  const result = await insertRecommendationOutcomeEvent(client, {
    userId: USER,
    businessProfileId: BIZ,
    recommendationId: REC_ID,
    contentApprovalId: APPROVAL_ID,
    eventType: "draft_approved",
    idempotencyKey: `${APPROVAL_ID}:draft_approved`,
  });

  assert.equal(result.duplicate, true);
  assert.equal(calls.some((c) => c.table === "marketing_memory_observations"), false);
});

function withEnv(vars: Record<string, string | undefined>, fn: () => Promise<void> | void) {
  const originals: Record<string, string | undefined> = {};
  for (const key of Object.keys(vars)) {
    originals[key] = process.env[key];
    if (vars[key] === undefined) delete process.env[key];
    else process.env[key] = vars[key];
  }
  return Promise.resolve(fn()).finally(() => {
    for (const key of Object.keys(originals)) {
      if (originals[key] === undefined) delete process.env[key];
      else process.env[key] = originals[key];
    }
  });
}

const GOOGLE_OAUTH_ENV = {
  GOOGLE_CLIENT_ID: "test-client-id",
  GOOGLE_CLIENT_SECRET: "test-client-secret",
  GOOGLE_REDIRECT_URI: "https://example.com/callback",
  TOKEN_ENCRYPTION_KEY: "0".repeat(64),
};

function connectedFixture(userId: string) {
  return {
    id: "conn-1",
    user_id: userId,
    business_profile_id: BIZ,
    google_account_email: "owner@example.com",
    google_account_name: "Owner",
    google_account_id: "google-account-1",
    gbp_account_id: null,
    gbp_location_id: null,
    gbp_location_name: null,
    token_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    scopes: [REQUIRED_GOOGLE_BUSINESS_SCOPE],
    connection_status: "connected",
    last_synced_at: null,
    last_verified_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function analyticsCaptureFixture(options: { memoryInsertFails: boolean }) {
  return createFakeSupabaseClient({
    business_profiles: { data: { id: BIZ, competitors: null }, error: null },
    google_business_profile_connections: { data: connectedFixture(USER), error: null },
    google_business_locations: { data: null, error: null },
    google_business_reviews: { data: [], error: null },
    google_business_posts: { data: [], error: null },
    google_business_insights: { data: [], error: null },
    google_business_sync_log: { data: [], error: null },
    publishing_jobs: { data: [], error: null },
    analytics_snapshots: { data: snapshotRow(), error: null },
    audit_logs: { data: { id: "audit-1" }, error: null },
    ...baseMemoryTables({
      marketing_memory_observations: options.memoryInsertFails
        ? { data: null, error: { code: "42P01", message: "relation missing" } }
        : { data: { id: "obs-analytics-integration-1", observation_type: "analytics_snapshot_captured" }, error: null },
    }),
  });
}

test("integration: captureSnapshotForUser still returns its original result unchanged when memory ingestion fails", async () => {
  await withEnv(GOOGLE_OAUTH_ENV, async () => {
    const { client } = analyticsCaptureFixture({ memoryInsertFails: true });
    const result = await captureSnapshotForUser(USER, client);
    assert.ok(result.snapshot, "expected a snapshot to still be produced despite memory ingestion failing");
    assert.equal(result.snapshot!.id, "snap-1");
  });
});

test("integration: captureSnapshotForUser triggers Marketing Memory ingestion after a successful capture", async () => {
  await withEnv(GOOGLE_OAUTH_ENV, async () => {
    const { client, calls } = analyticsCaptureFixture({ memoryInsertFails: false });
    await captureSnapshotForUser(USER, client);
    assert.ok(calls.some((c) => c.table === "marketing_memory_observations" && c.op === "insert"));
  });
});

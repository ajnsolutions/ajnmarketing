import test from "node:test";
import assert from "node:assert/strict";
import {
  getExpiredContextSnapshotCandidatesForUser,
  getMarketingMemoryEvidenceLinksForObservation,
  getMarketingMemoryObservationsForBusiness,
  insertMarketingMemoryEvidenceLinks,
  insertMarketingMemoryObservation,
} from "../lib/marketing-memory/persistence.ts";
import { resolveContextSnapshotForObservation } from "../lib/marketing-memory/contextNormalization.ts";
import {
  MarketingMemoryLinkTypes,
  MarketingMemoryObservationTypes,
  MarketingMemoryOutcomeDirections,
  MarketingMemoryRetentionClassifications,
  MarketingMemorySourceEntityTypes,
  MarketingMemorySourceSystems,
} from "../lib/marketing-memory/types.ts";
import { createFakeSupabaseClient, userIdsQueried } from "./support/fake-supabase-client.ts";

const USER = "user-1";
const OTHER_USER = "user-2";
const BIZ = "biz-1";

function observationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "obs-1",
    user_id: USER,
    business_profile_id: BIZ,
    observation_type: MarketingMemoryObservationTypes.RECOMMENDATION_APPROVED,
    source_system: MarketingMemorySourceSystems.RECOMMENDATION_OUTCOMES,
    source_outcome_event_id: "event-1",
    source_analytics_snapshot_id: null,
    context_snapshot_id: null,
    occurred_at: "2026-07-01T09:00:00.000Z",
    outcome_direction: MarketingMemoryOutcomeDirections.POSITIVE,
    location_scope: null,
    metric_summary: {},
    schema_version: 1,
    retention_classification: MarketingMemoryRetentionClassifications.LONG_TERM_AUDIT_EVIDENCE,
    idempotency_key: "obs:biz-1:recommendation_outcome_event:event-1",
    created_at: "2026-07-01T09:00:01.000Z",
    ...overrides,
  };
}

function baseObservationInput(overrides: Partial<Parameters<typeof insertMarketingMemoryObservation>[1]> = {}) {
  return {
    userId: USER,
    businessProfileId: BIZ,
    observationType: MarketingMemoryObservationTypes.RECOMMENDATION_APPROVED,
    sourceSystem: MarketingMemorySourceSystems.RECOMMENDATION_OUTCOMES,
    sourceOutcomeEventId: "event-1",
    sourceAnalyticsSnapshotId: null,
    contextSnapshotId: null,
    occurredAt: "2026-07-01T09:00:00.000Z",
    outcomeDirection: MarketingMemoryOutcomeDirections.POSITIVE,
    locationScope: null,
    metricSummary: {},
    retentionClassification: MarketingMemoryRetentionClassifications.LONG_TERM_AUDIT_EVIDENCE,
    idempotencyKey: "obs:biz-1:recommendation_outcome_event:event-1",
    ...overrides,
  };
}

// --- insertMarketingMemoryObservation ---------------------------------------------

test("insertMarketingMemoryObservation: happy path returns the inserted observation", async () => {
  const { client } = createFakeSupabaseClient({
    marketing_memory_observations: { data: observationRow(), error: null },
  });

  const result = await insertMarketingMemoryObservation(client, baseObservationInput());

  assert.equal(result.duplicate, false);
  assert.ok(result.observation);
  assert.equal(result.observation?.id, "obs-1");
  assert.equal(result.observation?.observation_type, MarketingMemoryObservationTypes.RECOMMENDATION_APPROVED);
});

test("insertMarketingMemoryObservation: a 23505 unique violation is treated as a safe duplicate, never an error", async () => {
  const { client } = createFakeSupabaseClient({
    marketing_memory_observations: { data: null, error: { code: "23505", message: "duplicate key" } },
  });

  const result = await insertMarketingMemoryObservation(client, baseObservationInput());

  assert.equal(result.duplicate, true);
  assert.equal(result.observation, null);
  assert.equal("error" in result, false);
});

test("insertMarketingMemoryObservation: a genuine error is surfaced distinctly from a duplicate", async () => {
  const { client } = createFakeSupabaseClient({
    marketing_memory_observations: { data: null, error: { code: "23502", message: "not null violation" } },
  });

  const result = await insertMarketingMemoryObservation(client, baseObservationInput());

  assert.equal(result.duplicate, false);
  assert.equal(result.observation, null);
  assert.ok("error" in result && result.error?.code === "23502");
});

test("insertMarketingMemoryObservation: repeated ingestion of the same source event produces exactly one stored observation", async () => {
  // Models a database with a real unique constraint: the first insert succeeds, every
  // subsequent attempt with the same idempotency_key hits the constraint.
  let created = false;
  const { client } = createFakeSupabaseClient({
    marketing_memory_observations: (op: string) => {
      if (op !== "single") return { data: null, error: null };
      if (!created) {
        created = true;
        return { data: observationRow(), error: null };
      }
      return { data: null, error: { code: "23505", message: "duplicate key" } };
    },
  });

  const first = await insertMarketingMemoryObservation(client, baseObservationInput());
  const second = await insertMarketingMemoryObservation(client, baseObservationInput());
  const third = await insertMarketingMemoryObservation(client, baseObservationInput());

  assert.equal(first.duplicate, false);
  assert.ok(first.observation);
  assert.equal(second.duplicate, true);
  assert.equal(third.duplicate, true);
});

// --- insertMarketingMemoryEvidenceLinks --------------------------------------------

test("insertMarketingMemoryEvidenceLinks: upserts with ignoreDuplicates so one bad row can't fail the whole batch", async () => {
  const { client, calls } = createFakeSupabaseClient({
    marketing_memory_evidence_links: { data: [{ id: "link-1" }, { id: "link-2" }], error: null },
  });

  const result = await insertMarketingMemoryEvidenceLinks(client, USER, BIZ, "obs-1", [
    {
      sourceType: MarketingMemorySourceEntityTypes.RECOMMENDATION_OUTCOME_EVENT,
      sourceId: "event-1",
      linkType: MarketingMemoryLinkTypes.PRIMARY_SOURCE,
      idempotencyKey: "obs-1:recommendation_outcome_event:event-1",
    },
    {
      sourceType: MarketingMemorySourceEntityTypes.RECOMMENDATION,
      sourceId: "rec-1",
      linkType: MarketingMemoryLinkTypes.RELATED_SOURCE,
      idempotencyKey: "obs-1:recommendation:rec-1",
    },
  ]);

  assert.equal(result.error, null);
  assert.equal(result.inserted, 2);

  const upsertCall = calls.find((c) => c.table === "marketing_memory_evidence_links" && c.op === "upsert");
  assert.ok(upsertCall);
  const [, options] = upsertCall!.args as [unknown, { onConflict: string; ignoreDuplicates: boolean }];
  assert.equal(options.onConflict, "idempotency_key");
  assert.equal(options.ignoreDuplicates, true);
});

test("insertMarketingMemoryEvidenceLinks: only supported source entity types can appear in the batch payload", async () => {
  const { client, calls } = createFakeSupabaseClient({
    marketing_memory_evidence_links: { data: [{ id: "link-1" }], error: null },
  });

  await insertMarketingMemoryEvidenceLinks(client, USER, BIZ, "obs-1", [
    {
      sourceType: MarketingMemorySourceEntityTypes.CONTENT_APPROVAL,
      sourceId: "approval-1",
      linkType: MarketingMemoryLinkTypes.RELATED_SOURCE,
      idempotencyKey: "obs-1:content_approval:approval-1",
    },
  ]);

  const upsertCall = calls.find((c) => c.table === "marketing_memory_evidence_links" && c.op === "upsert");
  const [rows] = upsertCall!.args as [Array<{ source_type: string }>];
  const supported = Object.values(MarketingMemorySourceEntityTypes) as string[];
  for (const row of rows) {
    assert.ok(supported.includes(row.source_type), `unsupported source_type leaked into payload: ${row.source_type}`);
  }
});

test("insertMarketingMemoryEvidenceLinks: no-op for an empty link list (never an empty write)", async () => {
  const { client, calls } = createFakeSupabaseClient({});
  const result = await insertMarketingMemoryEvidenceLinks(client, USER, BIZ, "obs-1", []);
  assert.equal(result.inserted, 0);
  assert.equal(calls.length, 0);
});

// --- tenant isolation contract (fake-client query-filtering proof) ----------------

test("getMarketingMemoryObservationsForBusiness: every query is scoped to the given userId", async () => {
  const { client, calls } = createFakeSupabaseClient({
    marketing_memory_observations: { data: [observationRow()], error: null },
  });

  await getMarketingMemoryObservationsForBusiness(client, USER, BIZ);
  const ids = userIdsQueried(calls);
  assert.ok(ids.length > 0 && ids.every((id) => id === USER));
  assert.ok(!ids.includes(OTHER_USER));
});

test("getMarketingMemoryEvidenceLinksForObservation: scoped to the given userId", async () => {
  const { client, calls } = createFakeSupabaseClient({
    marketing_memory_evidence_links: { data: [], error: null },
  });

  await getMarketingMemoryEvidenceLinksForObservation(client, USER, "obs-1");
  const ids = userIdsQueried(calls);
  assert.deepEqual(ids, [USER]);
});

test("getExpiredContextSnapshotCandidatesForUser: filters by tenant and expires_at, never deletes anything", async () => {
  const { client, calls } = createFakeSupabaseClient({
    marketing_memory_context_snapshots: {
      data: [{ id: "ctx-1", captured_at: "2026-01-01T00:00:00.000Z", expires_at: "2026-01-05T00:00:00.000Z" }],
      error: null,
    },
  });

  const result = await getExpiredContextSnapshotCandidatesForUser(client, USER, BIZ, new Date("2026-07-01T00:00:00.000Z"));

  assert.equal(result.length, 1);
  assert.equal(result[0].id, "ctx-1");
  assert.ok(!calls.some((c) => c.op === "update" || c.op === "delete" || (client as unknown as { delete?: unknown }).delete));
  const ltCall = calls.find((c) => c.op === "lt");
  assert.ok(ltCall);
  assert.equal(ltCall!.args[0], "expires_at");
});

// --- resolveContextSnapshotForObservation ------------------------------------------

test("resolveContextSnapshotForObservation: creates a new snapshot with bounded, relevant context items", async () => {
  const { client, calls } = createFakeSupabaseClient({
    market_context_items: {
      data: [
        { id: "ctxitem-1" },
        { id: "ctxitem-2" },
      ],
      error: null,
    },
    marketing_memory_context_snapshots: { data: { id: "snapshot-1" }, error: null },
  });

  const snapshotId = await resolveContextSnapshotForObservation(client, {
    userId: USER,
    businessProfileId: BIZ,
    occurredAt: new Date("2026-07-02T09:00:00.000Z"), // a Thursday
  });

  assert.equal(snapshotId, "snapshot-1");

  const insertCall = calls.find((c) => c.table === "marketing_memory_context_snapshots" && c.op === "insert");
  assert.ok(insertCall);
  const [payload] = insertCall!.args as [Record<string, unknown>];
  assert.equal(payload.business_profile_id, BIZ);
  assert.deepEqual(payload.context_item_ids, ["ctxitem-1", "ctxitem-2"]);
  const summary = payload.context_summary as Record<string, unknown>;
  assert.equal(summary.dayOfWeek, "thursday");
  assert.equal(summary.month, 7);
  assert.equal(summary.season, "summer");
});

test("resolveContextSnapshotForObservation: on conflict, reuses the existing snapshot for that business/day instead of erroring", async () => {
  const { client } = createFakeSupabaseClient({
    market_context_items: { data: [], error: null },
    marketing_memory_context_snapshots: (op: string) => {
      if (op === "single") return { data: null, error: { code: "23505", message: "duplicate key" } };
      if (op === "maybeSingle") return { data: { id: "existing-snapshot" }, error: null };
      return { data: null, error: null };
    },
  });

  const snapshotId = await resolveContextSnapshotForObservation(client, {
    userId: USER,
    businessProfileId: BIZ,
    occurredAt: new Date("2026-07-02T09:00:00.000Z"),
  });

  assert.equal(snapshotId, "existing-snapshot");
});

test("resolveContextSnapshotForObservation: missing/unavailable context never throws, returns null instead", async () => {
  const { client } = createFakeSupabaseClient({
    market_context_items: { data: null, error: { message: "provider unavailable" } },
    marketing_memory_context_snapshots: { data: null, error: { code: "500", message: "db unreachable" } },
  });

  const snapshotId = await resolveContextSnapshotForObservation(client, {
    userId: USER,
    businessProfileId: BIZ,
    occurredAt: new Date("2026-07-02T09:00:00.000Z"),
  });

  assert.equal(snapshotId, null);
});

test("resolveContextSnapshotForObservation: caps context item ids at the documented bound (limit call issued)", async () => {
  const { client, calls } = createFakeSupabaseClient({
    market_context_items: { data: [], error: null },
    marketing_memory_context_snapshots: { data: { id: "snapshot-1" }, error: null },
  });

  await resolveContextSnapshotForObservation(client, {
    userId: USER,
    businessProfileId: BIZ,
    occurredAt: new Date("2026-07-02T09:00:00.000Z"),
  });

  const limitCall = calls.find((c) => c.table === "market_context_items" && c.op === "limit");
  assert.ok(limitCall);
  assert.equal(limitCall!.args[0], 5);
});

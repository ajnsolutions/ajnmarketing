import test from "node:test";
import assert from "node:assert/strict";
import { getBusinessesDueForAnalyticsCapture } from "../lib/analytics/analyticsEligibility.ts";
import { createFakeSupabaseClient } from "./support/fake-supabase-client.ts";

const NOW = new Date("2026-07-15T12:00:00.000Z");
const TODAY = "2026-07-15";
const YESTERDAY = "2026-07-14";
const TEN_DAYS_AGO = "2026-07-05";
const TWENTY_DAYS_AGO = "2026-06-25"; // outside the default 14-day lookback window

/**
 * business_profiles fixture already represents "post onboarding_completed=true filter" —
 * this fake client doesn't simulate real Postgres filtering, so the test separately
 * asserts the correct filter was requested (see the dedicated test below) rather than
 * relying on the fake to enforce it.
 */
const ONBOARDED_PROFILES = [
  { id: "biz-1", user_id: "user-1" }, // never captured, ever
  { id: "biz-2", user_id: "user-2" }, // captured today -> not due
  { id: "biz-3", user_id: "user-3" }, // captured yesterday -> due, stale
  { id: "biz-4", user_id: "user-4" }, // captured 10 days ago -> due, stale, older
  { id: "biz-5", user_id: "user-5" }, // last capture is outside the lookback window -> treated as never_captured
];

const RECENT_SNAPSHOTS_WITHIN_WINDOW = [
  { user_id: "user-2", snapshot_date: TODAY },
  { user_id: "user-3", snapshot_date: YESTERDAY },
  { user_id: "user-4", snapshot_date: TEN_DAYS_AGO },
  // user-5's real last snapshot (TWENTY_DAYS_AGO) is outside the window and correctly absent here.
];

test("getBusinessesDueForAnalyticsCapture excludes snapshots older than the lookback window from its query, per the .gte() filter", async () => {
  const { client, calls } = createFakeSupabaseClient({
    business_profiles: { data: [{ id: "biz-5", user_id: "user-5" }], error: null },
    analytics_snapshots: { data: [], error: null }, // simulates the real DB excluding a TWENTY_DAYS_AGO row via .gte()
  });

  await getBusinessesDueForAnalyticsCapture(client, { now: NOW, lookbackDays: 14 });

  const gteFilter = calls.find((call) => call.table === "analytics_snapshots" && call.op === "gte");
  assert.ok(gteFilter, "expected a gte('snapshot_date', ...) filter on analytics_snapshots");
  const [column, cutoff] = gteFilter!.args as [string, string];
  assert.equal(column, "snapshot_date");
  // A snapshot dated TWENTY_DAYS_AGO must fall before this cutoff (i.e., be excluded by it).
  assert.ok(
    TWENTY_DAYS_AGO < cutoff,
    `expected the lookback cutoff (${cutoff}) to exclude a snapshot from ${TWENTY_DAYS_AGO}`
  );
});

function createFakeClient() {
  return createFakeSupabaseClient({
    business_profiles: { data: ONBOARDED_PROFILES, error: null },
    analytics_snapshots: { data: RECENT_SNAPSHOTS_WITHIN_WINDOW, error: null },
  });
}

test("getBusinessesDueForAnalyticsCapture requests only onboarded businesses", async () => {
  const { client, calls } = createFakeClient();
  await getBusinessesDueForAnalyticsCapture(client, { now: NOW });

  const onboardingFilter = calls.find(
    (call) => call.table === "business_profiles" && call.op === "eq" && call.args[0] === "onboarding_completed"
  );
  assert.ok(onboardingFilter, "expected an eq('onboarding_completed', true) filter");
  assert.equal(onboardingFilter?.args[1], true);
});

test("getBusinessesDueForAnalyticsCapture returns only eligible (due) tenants, with correct reasons and timestamps", async () => {
  const { client } = createFakeClient();
  const due = await getBusinessesDueForAnalyticsCapture(client, { now: NOW });

  const byUserId = new Map(due.map((tenant) => [tenant.userId, tenant]));

  assert.equal(due.length, 4, "user-2 (captured today) must be excluded");
  assert.equal(byUserId.has("user-2"), false);

  assert.deepEqual(byUserId.get("user-1"), {
    userId: "user-1",
    businessProfileId: "biz-1",
    lastCapturedAt: null,
    reason: "never_captured",
  });
  assert.deepEqual(byUserId.get("user-5"), {
    userId: "user-5",
    businessProfileId: "biz-5",
    lastCapturedAt: null,
    reason: "never_captured",
  });
  assert.deepEqual(byUserId.get("user-3"), {
    userId: "user-3",
    businessProfileId: "biz-3",
    lastCapturedAt: YESTERDAY,
    reason: "stale_snapshot",
  });
  assert.deepEqual(byUserId.get("user-4"), {
    userId: "user-4",
    businessProfileId: "biz-4",
    lastCapturedAt: TEN_DAYS_AGO,
    reason: "stale_snapshot",
  });
});

test("getBusinessesDueForAnalyticsCapture orders deterministically, oldest-due-first, and respects the limit", async () => {
  const { client } = createFakeClient();
  const due = await getBusinessesDueForAnalyticsCapture(client, { now: NOW });

  // Unknown/never-captured (tie-broken alphabetically) first, then ascending by known stale date.
  assert.deepEqual(
    due.map((tenant) => tenant.userId),
    ["user-1", "user-5", "user-4", "user-3"]
  );

  const limited = await getBusinessesDueForAnalyticsCapture(client, { now: NOW, limit: 2 });
  assert.deepEqual(
    limited.map((tenant) => tenant.userId),
    ["user-1", "user-5"]
  );
});

test("getBusinessesDueForAnalyticsCapture cadence boundary is deterministic: same-day capture excludes, any earlier day includes", async () => {
  const { client } = createFakeSupabaseClient({
    business_profiles: { data: [{ id: "biz-x", user_id: "user-x" }], error: null },
    analytics_snapshots: { data: [{ user_id: "user-x", snapshot_date: TODAY }], error: null },
  });

  const dueWhenCapturedToday = await getBusinessesDueForAnalyticsCapture(client, { now: NOW });
  assert.deepEqual(dueWhenCapturedToday, []);

  const { client: clientYesterday } = createFakeSupabaseClient({
    business_profiles: { data: [{ id: "biz-x", user_id: "user-x" }], error: null },
    analytics_snapshots: { data: [{ user_id: "user-x", snapshot_date: YESTERDAY }], error: null },
  });
  const dueWhenCapturedYesterday = await getBusinessesDueForAnalyticsCapture(clientYesterday, { now: NOW });
  assert.equal(dueWhenCapturedYesterday.length, 1);
  assert.equal(dueWhenCapturedYesterday[0].userId, "user-x");
});

test("getBusinessesDueForAnalyticsCapture does not exclude tenants with a disconnected/revoked/missing GBP connection", async () => {
  // The eligibility query deliberately never reads google_business_profile_connections at
  // all — captureSnapshotForUser already degrades gracefully without a working GBP
  // connection, so excluding these tenants here would contradict existing product
  // behavior. This test proves that table is never even queried.
  const { client, calls } = createFakeClient();
  await getBusinessesDueForAnalyticsCapture(client, { now: NOW });

  const touchedTables = new Set(calls.map((call) => call.table));
  assert.equal(touchedTables.has("google_business_profile_connections"), false);
  // Confirms the tenants that ARE due (none of which have any GBP connection fixture
  // configured at all) are still present, per the previous test's assertions.
});

test("getBusinessesDueForAnalyticsCapture fails clearly instead of silently returning an empty result when the underlying query errors", async () => {
  const { client } = createFakeSupabaseClient({
    business_profiles: { data: null, error: { message: "permission denied for table business_profiles" } },
  });

  await assert.rejects(
    () => getBusinessesDueForAnalyticsCapture(client, { now: NOW }),
    /failed to read business_profiles/
  );
});

test("getBusinessesDueForAnalyticsCapture returns an empty (not thrown) result when there are simply no onboarded businesses", async () => {
  const { client } = createFakeSupabaseClient({
    business_profiles: { data: [], error: null },
  });

  const due = await getBusinessesDueForAnalyticsCapture(client, { now: NOW });
  assert.deepEqual(due, []);
});

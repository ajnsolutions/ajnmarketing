import test from "node:test";
import assert from "node:assert/strict";
import { captureSnapshotForUser } from "../lib/analytics/analyticsEngine.ts";
import { REQUIRED_GOOGLE_BUSINESS_SCOPE } from "../lib/google-business-profile/oauth.ts";
import { createFakeSupabaseClient, userIdsQueried } from "./support/fake-supabase-client.ts";

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
    business_profile_id: "biz-1",
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

/** businessProfileId null/present controls whether captureSnapshotForUser proceeds past its first branch. */
function createFakeClient(userId: string, options: { hasBusinessProfile: boolean }) {
  return createFakeSupabaseClient({
    business_profiles: {
      data: options.hasBusinessProfile ? { id: "biz-1", competitors: null } : null,
      error: null,
    },
    google_business_profile_connections: { data: connectedFixture(userId), error: null },
    google_business_locations: { data: null, error: null },
    google_business_reviews: { data: [], error: null },
    google_business_posts: { data: [], error: null },
    google_business_insights: { data: [], error: null },
    google_business_sync_log: { data: [], error: null },
    publishing_jobs: { data: [], error: null },
    analytics_snapshots: { data: { id: "snap-1", business_profile_id: "biz-1" }, error: null },
    audit_logs: { data: { id: "audit-1" }, error: null },
  });
}

test("captureSnapshotForUser executes to completion using an injected client, with no cookies and no request context", async () => {
  await withEnv(GOOGLE_OAUTH_ENV, async () => {
    const userId = "user-analytics-1";
    const { client, calls } = createFakeClient(userId, { hasBusinessProfile: true });

    const result = await captureSnapshotForUser(userId, client);

    assert.ok(result.snapshot, "expected a snapshot to be produced");

    // Confirms the whole call graph — including the Google Business dashboard data fetch
    // that used to be hard-wired to the current session — ran through the one injected
    // client, touching real tables, with no cookies/next-headers involved anywhere.
    const touchedTables = new Set(calls.map((call) => call.table));
    assert.ok(touchedTables.has("business_profiles"));
    assert.ok(touchedTables.has("google_business_profile_connections"));
    assert.ok(touchedTables.has("analytics_snapshots"));
  });
});

test("captureSnapshotForUser respects tenant isolation: every query is scoped to the given userId", async () => {
  await withEnv(GOOGLE_OAUTH_ENV, async () => {
    const userA = "user-tenant-a";
    const userB = "user-tenant-b";

    const fakeA = createFakeClient(userA, { hasBusinessProfile: true });
    const fakeB = createFakeClient(userB, { hasBusinessProfile: true });

    await captureSnapshotForUser(userA, fakeA.client);
    await captureSnapshotForUser(userB, fakeB.client);

    const idsForA = userIdsQueried(fakeA.calls);
    const idsForB = userIdsQueried(fakeB.calls);

    assert.ok(idsForA.length > 0 && idsForA.every((id) => id === userA));
    assert.ok(idsForB.length > 0 && idsForB.every((id) => id === userB));
    assert.ok(!idsForA.includes(userB));
    assert.ok(!idsForB.includes(userA));
  });
});

test("captureSnapshotForUser fails clearly (no snapshot, no partial writes) rather than guessing when there is no business profile", async () => {
  await withEnv(GOOGLE_OAUTH_ENV, async () => {
    const userId = "user-no-profile";
    const { client, calls } = createFakeClient(userId, { hasBusinessProfile: false });

    const result = await captureSnapshotForUser(userId, client);

    assert.deepEqual(result, { snapshot: null, contentPerformanceCount: 0 });

    // Stops immediately after the business_profiles lookup — never reaches the GBP
    // dashboard fetch or writes a snapshot for a tenant that doesn't fully exist yet.
    const touchedTables = new Set(calls.map((call) => call.table));
    assert.deepEqual([...touchedTables], ["business_profiles"]);
  });
});

test("captureSnapshotForUser still defaults to the request-scoped client when no client is injected (preserves existing behavior)", async () => {
  await withEnv(GOOGLE_OAUTH_ENV, async () => {
    await assert.rejects(
      () => captureSnapshotForUser("user-analytics-1"),
      /next\/headers\.cookies\(\) called outside a Next\.js request context/
    );
  });
});

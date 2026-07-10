import test from "node:test";
import assert from "node:assert/strict";
import {
  getGoogleBusinessDashboardDataForCurrentUser,
  getGoogleBusinessDashboardDataForUser,
} from "../lib/google-business/service.ts";
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

function connectedFixture(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "conn-1",
    user_id: "will-be-overwritten-by-eq-filter-in-real-life",
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
    last_verified_at: new Date().toISOString(), // fresh — skips live network verification entirely
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function createConnectedFakeClient(userId: string) {
  return createFakeSupabaseClient({
    google_business_profile_connections: { data: connectedFixture({ user_id: userId }), error: null },
    business_profiles: { data: null, error: null }, // no profile -> buildLocalPublishingPosts is skipped
    google_business_locations: { data: null, error: null },
    google_business_reviews: { data: [], error: null },
    google_business_posts: { data: [], error: null },
    google_business_insights: { data: [], error: null },
    google_business_sync_log: { data: [], error: null },
  });
}

test("getGoogleBusinessDashboardDataForUser uses the supplied userId, not a current session, and touches no cookies", async () => {
  await withEnv(GOOGLE_OAUTH_ENV, async () => {
    const userId = "user-aaa";
    const { client, calls } = createConnectedFakeClient(userId);

    const result = await getGoogleBusinessDashboardDataForUser(userId, client);

    assert.equal(result.connected, true);
    assert.equal(result.setupRequired, false);

    // Every user-scoped table query used exactly this userId — nothing else.
    const queriedUserIds = userIdsQueried(calls);
    assert.ok(queriedUserIds.length > 0, "expected at least one user_id-scoped query");
    assert.ok(
      queriedUserIds.every((id) => id === userId),
      `expected every query to use "${userId}", got: ${JSON.stringify(queriedUserIds)}`
    );
  });
});

test("getGoogleBusinessDashboardDataForUser respects tenant isolation across two different users", async () => {
  await withEnv(GOOGLE_OAUTH_ENV, async () => {
    const userA = "user-tenant-a";
    const userB = "user-tenant-b";

    const fakeA = createConnectedFakeClient(userA);
    const fakeB = createConnectedFakeClient(userB);

    await getGoogleBusinessDashboardDataForUser(userA, fakeA.client);
    await getGoogleBusinessDashboardDataForUser(userB, fakeB.client);

    const idsQueriedForA = userIdsQueried(fakeA.calls);
    const idsQueriedForB = userIdsQueried(fakeB.calls);

    assert.ok(idsQueriedForA.every((id) => id === userA));
    assert.ok(idsQueriedForB.every((id) => id === userB));
    // Neither client's call log ever mentions the other tenant's id.
    assert.ok(!idsQueriedForA.includes(userB));
    assert.ok(!idsQueriedForB.includes(userA));
  });
});

test("getGoogleBusinessDashboardDataForUser fails clearly (setupRequired) instead of silently guessing when OAuth isn't configured", async () => {
  await withEnv(
    { GOOGLE_CLIENT_ID: undefined, GOOGLE_CLIENT_SECRET: undefined, GOOGLE_REDIRECT_URI: undefined },
    async () => {
      const { client } = createConnectedFakeClient("user-aaa");
      const result = await getGoogleBusinessDashboardDataForUser("user-aaa", client);

      assert.equal(result.setupRequired, true);
      assert.equal(result.connected, false);
      assert.ok(result.setupMessage);
    }
  );
});

test("getGoogleBusinessDashboardDataForCurrentUser still defaults to the request-scoped client (preserves existing behavior)", async () => {
  await withEnv(GOOGLE_OAUTH_ENV, async () => {
    // No fake client is injectable here — this proves the CurrentUser wrapper still
    // genuinely depends on cookies()/next-headers exactly as before, rather than
    // silently succeeding some other way now that the *ForUser variant exists.
    await assert.rejects(
      () => getGoogleBusinessDashboardDataForCurrentUser(),
      /next\/headers\.cookies\(\) called outside a Next\.js request context/
    );
  });
});

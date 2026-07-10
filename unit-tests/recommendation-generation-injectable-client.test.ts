import test from "node:test";
import assert from "node:assert/strict";
import {
  generateRecommendationsForUser,
  getAnalyticsFeedbackForCurrentUser,
} from "../lib/analytics/analyticsEngine.ts";
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

/** GBP connection intentionally absent -> exercises the "disconnected tenant" path too. */
function createFakeClient(userId: string) {
  return createFakeSupabaseClient({
    business_profiles: { data: { id: "biz-1", user_id: userId, competitors: null }, error: null },
    google_business_profile_connections: { data: null, error: null },
    analytics_snapshots: { data: [], error: null },
    publishing_queue: { data: [], error: null },
    publishing_jobs: { data: [], error: null },
    ai_recommendations: { data: [], error: null },
    audit_logs: { data: { id: "audit-1" }, error: null },
  });
}

test("generateRecommendationsForUser executes to completion using an injected client, with no cookies and no request context, even with no GBP connection", async () => {
  await withEnv(GOOGLE_OAUTH_ENV, async () => {
    const userId = "user-rec-1";
    const { client, calls } = createFakeClient(userId);

    const recommendations = await generateRecommendationsForUser(userId, client);

    // Doesn't throw, doesn't require a GBP connection to exist — matches
    // captureSnapshotForUser's same graceful-degradation behavior.
    assert.ok(Array.isArray(recommendations));

    const touchedTables = new Set(calls.map((call) => call.table));
    assert.ok(touchedTables.has("business_profiles"));
    assert.ok(touchedTables.has("google_business_profile_connections"));
    assert.ok(touchedTables.has("analytics_snapshots"));
  });
});

test("generateRecommendationsForUser uses the supplied userId consistently throughout the full path (tenant isolation)", async () => {
  await withEnv(GOOGLE_OAUTH_ENV, async () => {
    const userA = "user-tenant-rec-a";
    const userB = "user-tenant-rec-b";

    const fakeA = createFakeClient(userA);
    const fakeB = createFakeClient(userB);

    await generateRecommendationsForUser(userA, fakeA.client);
    await generateRecommendationsForUser(userB, fakeB.client);

    const idsForA = userIdsQueried(fakeA.calls);
    const idsForB = userIdsQueried(fakeB.calls);

    assert.ok(idsForA.length > 0 && idsForA.every((id) => id === userA));
    assert.ok(idsForB.length > 0 && idsForB.every((id) => id === userB));
    assert.ok(!idsForA.includes(userB), "tenant A's queries must never reference tenant B's id");
    assert.ok(!idsForB.includes(userA), "tenant B's queries must never reference tenant A's id");
  });
});

test("generateRecommendationsForUser still defaults to the request-scoped client when no client is injected (preserves existing behavior)", async () => {
  await withEnv(GOOGLE_OAUTH_ENV, async () => {
    await assert.rejects(
      () => generateRecommendationsForUser("user-rec-1"),
      /next\/headers\.cookies\(\) called outside a Next\.js request context/
    );
  });
});

test("getAnalyticsFeedbackForCurrentUser (an existing current-user wrapper) still requires cookies exactly as before", async () => {
  await withEnv(GOOGLE_OAUTH_ENV, async () => {
    await assert.rejects(
      () => getAnalyticsFeedbackForCurrentUser(),
      /next\/headers\.cookies\(\) called outside a Next\.js request context/
    );
  });
});

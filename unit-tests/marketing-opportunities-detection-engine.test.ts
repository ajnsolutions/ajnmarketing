import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateOpportunitiesForUser,
  evaluateOpportunitiesForCurrentUser,
} from "../lib/marketing-opportunities/detectionEngine.ts";
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

/** GBP connection intentionally absent -> exercises graceful degradation, matching the
 *  established pattern used for captureSnapshotForUser/generateRecommendationsForUser. */
function createFakeClient(userId: string, businessId = "biz-1") {
  return createFakeSupabaseClient({
    business_profiles: {
      data: { id: businessId, user_id: userId, seasonal_services: null, website: "https://example.com", phone: "555-1234", primary_services: "Plumbing", city: "Springfield", state: "IL" },
      error: null,
    },
    google_business_profile_connections: { data: null, error: null },
    analytics_snapshots: { data: [], error: null },
    website_analysis: { data: null, error: null },
    market_context_items: { data: [], error: null },
    marketing_opportunities: { data: null, error: null },
    audit_logs: { data: { id: "audit-1" }, error: null },
  });
}

test("evaluateOpportunitiesForUser: runs to completion with an injected client, no cookies, no request context", async () => {
  await withEnv(GOOGLE_OAUTH_ENV, async () => {
    const userId = "user-opp-1";
    const { client } = createFakeClient(userId);

    const result = await evaluateOpportunitiesForUser(userId, client);

    assert.ok(result);
    assert.equal(result!.businessProfileId, "biz-1");
    assert.ok(Array.isArray(result!.opportunities));
  });
});

test("evaluateOpportunitiesForUser: returns null (not throw) when the user has no business profile", async () => {
  await withEnv(GOOGLE_OAUTH_ENV, async () => {
    const { client } = createFakeSupabaseClient({
      business_profiles: { data: null, error: null },
      audit_logs: { data: { id: "audit-1" }, error: null },
    });

    const result = await evaluateOpportunitiesForUser("user-no-profile", client);
    assert.equal(result, null);
  });
});

test("evaluateOpportunitiesForUser: uses the supplied userId consistently throughout the full path (tenant isolation)", async () => {
  await withEnv(GOOGLE_OAUTH_ENV, async () => {
    const userA = "user-opp-a";
    const userB = "user-opp-b";

    const fakeA = createFakeClient(userA, "biz-a");
    const fakeB = createFakeClient(userB, "biz-b");

    await evaluateOpportunitiesForUser(userA, fakeA.client);
    await evaluateOpportunitiesForUser(userB, fakeB.client);

    const idsForA = userIdsQueried(fakeA.calls);
    const idsForB = userIdsQueried(fakeB.calls);

    assert.ok(idsForA.length > 0 && idsForA.every((id) => id === userA));
    assert.ok(idsForB.length > 0 && idsForB.every((id) => id === userB));
    assert.ok(!idsForA.includes(userB));
    assert.ok(!idsForB.includes(userA));
  });
});

test("evaluateOpportunitiesForUser: still defaults to the request-scoped client when no client is injected (preserves existing behavior)", async () => {
  await withEnv(GOOGLE_OAUTH_ENV, async () => {
    await assert.rejects(
      () => evaluateOpportunitiesForUser("user-opp-1"),
      /next\/headers\.cookies\(\) called outside a Next\.js request context/
    );
  });
});

test("evaluateOpportunitiesForCurrentUser: still requires cookies exactly as before", async () => {
  await withEnv(GOOGLE_OAUTH_ENV, async () => {
    await assert.rejects(
      () => evaluateOpportunitiesForCurrentUser(),
      /next\/headers\.cookies\(\) called outside a Next\.js request context/
    );
  });
});

test("evaluateOpportunitiesForUser: closes expired opportunities before evaluating new ones", async () => {
  await withEnv(GOOGLE_OAUTH_ENV, async () => {
    const userId = "user-opp-expiry";
    const { client, calls } = createFakeClient(userId);

    await evaluateOpportunitiesForUser(userId, client);

    const updateCall = calls.find(
      (c) => c.table === "marketing_opportunities" && c.op === "update"
    );
    assert.ok(updateCall, "expected closeExpiredMarketingOpportunities to issue an update");
    assert.deepEqual(updateCall!.args[0], { status: "expired" });
  });
});

test("evaluateOpportunitiesForUser: logs a started and completed audit event", async () => {
  await withEnv(GOOGLE_OAUTH_ENV, async () => {
    const userId = "user-opp-audit";
    const { client, calls } = createFakeClient(userId);

    await evaluateOpportunitiesForUser(userId, client);

    const auditInserts = calls.filter((c) => c.table === "audit_logs" && c.op === "insert");
    assert.equal(auditInserts.length, 2, "expected one 'started' and one 'completed' audit log write");

    const [startedPayload, completedPayload] = auditInserts.map(
      (c) => c.args[0] as Record<string, unknown>
    );
    assert.equal(startedPayload.action, "marketing_opportunities.detection_started");
    assert.equal(completedPayload.action, "marketing_opportunities.detection_completed");
  });
});

test("evaluateOpportunitiesForUser: missing_business_info opportunity is not raised when all required fields are present", async () => {
  await withEnv(GOOGLE_OAUTH_ENV, async () => {
    const userId = "user-opp-complete";
    const { client, calls } = createFakeClient(userId);

    await evaluateOpportunitiesForUser(userId, client);

    const upserts = calls.filter((c) => c.table === "marketing_opportunities" && c.op === "upsert");
    const categories = upserts.map((c) => (c.args[0] as Record<string, unknown>).category);
    assert.ok(!categories.includes("missing_business_info"));
  });
});

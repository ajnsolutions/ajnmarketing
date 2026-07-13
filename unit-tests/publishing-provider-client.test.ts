import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GoogleBusinessProvider } from "../lib/publishing/providers/googleBusinessProvider.ts";
import { executePublishingJobById } from "../lib/publishing/publishingEngine.ts";
import { getPublishingProvider } from "../lib/publishing/providerRouter.ts";
import { createGoogleBusinessLocalPost } from "../lib/google-business/publish.ts";
import { claimPublishingJobForExecution } from "../lib/publishing/publishingHistory.ts";
import { encryptToken } from "../lib/security/token-encryption.ts";
import { REQUIRED_GOOGLE_BUSINESS_SCOPE } from "../lib/google-business-profile/oauth.ts";
import {
  PublishingJobStatuses,
  type PublishProviderContext,
  type PublishingJob,
} from "../lib/publishing/publishingTypes.ts";
import { createFakeSupabaseClient, userIdsQueried } from "./support/fake-supabase-client.ts";
import { createConcurrentPublishingClaimHarness } from "./support/concurrent-publishing-claim-harness.ts";

const PROVIDER_SOURCE = readFileSync(
  new URL("../lib/publishing/providers/googleBusinessProvider.ts", import.meta.url),
  "utf8"
);
const ENGINE_SOURCE = readFileSync(
  new URL("../lib/publishing/publishingEngine.ts", import.meta.url),
  "utf8"
);
const TRIGGER_SOURCE = readFileSync(
  new URL("../trigger/publishingDue.ts", import.meta.url),
  "utf8"
);
const ROUTER_SOURCE = readFileSync(
  new URL("../lib/publishing/providerRouter.ts", import.meta.url),
  "utf8"
);

const GOOGLE_OAUTH_ENV = {
  GOOGLE_CLIENT_ID: "test-client-id",
  GOOGLE_CLIENT_SECRET: "test-client-secret",
  GOOGLE_REDIRECT_URI: "https://example.com/callback",
  TOKEN_ENCRYPTION_KEY: "0".repeat(64),
};

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

function baseJob(overrides: Partial<PublishingJob> = {}): PublishingJob {
  return {
    id: "job-1",
    user_id: "user-1",
    business_profile_id: "biz-1",
    content_id: "queue-1",
    provider: "google_business_profile",
    provider_post_id: null,
    status: PublishingJobStatuses.QUEUED,
    scheduled_for: null,
    published_at: null,
    retry_count: 0,
    last_error: null,
    metadata: {},
    created_at: "2026-07-14T00:00:00.000Z",
    updated_at: "2026-07-14T00:00:00.000Z",
    ...overrides,
  };
}

function publishContext(
  supabase: PublishProviderContext["supabase"],
  overrides: Partial<PublishProviderContext> = {}
): PublishProviderContext {
  return {
    userId: "user-1",
    businessProfileId: "biz-1",
    supabase,
    input: {
      title: "Hello",
      body: "Body text for GBP",
      contentApprovalId: "approval-1",
      publishingQueueId: "queue-1",
      scheduledFor: null,
      metadata: {},
    },
    ...overrides,
  };
}

function connectedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "conn-1",
    user_id: "user-1",
    business_profile_id: "biz-1",
    google_account_email: "owner@example.com",
    google_account_name: "Owner",
    google_account_id: "google-account-1",
    gbp_account_id: null,
    gbp_location_id: null,
    gbp_location_name: null,
    access_token_encrypted: encryptToken("access-token"),
    refresh_token_encrypted: encryptToken("refresh-token"),
    token_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    scopes: [REQUIRED_GOOGLE_BUSINESS_SCOPE],
    connection_status: "connected",
    last_synced_at: null,
    last_verified_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function locationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "loc-1",
    user_id: "user-1",
    business_profile_id: "biz-1",
    connection_id: "conn-1",
    google_location_id: "locations/loc-google-1",
    google_account_id: "accounts/acct-google-1",
    location_title: "AJN Demo",
    primary_category: null,
    phone: null,
    website_uri: null,
    address_json: {},
    profile_metadata: {},
    average_rating: null,
    review_count: 0,
    verification_status: "VERIFIED",
    is_primary: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

test("GoogleBusinessProvider source has no cookie-bound createClient dependency", () => {
  assert.equal(/from ["']@\/lib\/supabase\/server["']/.test(PROVIDER_SOURCE), false);
  assert.equal(/\bcreateClient\s*\(/.test(PROVIDER_SOURCE), false);
  assert.equal(/\bcookies\s*\(/.test(PROVIDER_SOURCE), false);
  assert.equal(/from ["']next\/headers["']/.test(PROVIDER_SOURCE), false);
  assert.ok(PROVIDER_SOURCE.includes("context.supabase"));
});

test("shared execution path remains claim → getPublishingProvider → provider.publish", () => {
  assert.ok(ENGINE_SOURCE.includes("claimPublishingJobForExecution"));
  assert.ok(ENGINE_SOURCE.includes("getPublishingProvider"));
  assert.ok(ENGINE_SOURCE.includes("provider.publish({"));
  assert.ok(ENGINE_SOURCE.includes("supabase,"));
  // Trigger.dev must not invent a second provider path.
  assert.ok(TRIGGER_SOURCE.includes("executePublishingJobById"));
  assert.equal(TRIGGER_SOURCE.includes("GoogleBusinessProvider"), false);
  assert.equal(TRIGGER_SOURCE.includes("createGoogleBusinessLocalPost"), false);
  assert.equal(TRIGGER_SOURCE.includes("getPublishingProvider"), false);
  // Single router entry for GBP.
  assert.equal(
    (ROUTER_SOURCE.match(/new GoogleBusinessProvider/g) ?? []).length,
    1
  );
});

test("GoogleBusinessProvider uses the injected client (no cookies) and fails safely when GBP is missing", async () => {
  await withEnv(GOOGLE_OAUTH_ENV, async () => {
    const { client, calls } = createFakeSupabaseClient({
      google_business_profile_connections: { data: null, error: null },
    });
    const provider = new GoogleBusinessProvider();

    await assert.rejects(
      () => provider.publish(publishContext(client)),
      /Connect Google Business Profile before publishing/
    );

    assert.ok(calls.some((c) => c.table === "google_business_profile_connections"));
    assert.deepEqual(userIdsQueried(calls), ["user-1"]);
  });
});

test("request-scoped-shaped injected client still works the same publish path", async () => {
  await withEnv(GOOGLE_OAUTH_ENV, async () => {
    const { client, calls } = createFakeSupabaseClient({
      google_business_profile_connections: { data: null, error: null },
    });
    // Same provider instance used by getPublishingProvider — request vs service-role
    // differ only by which client is threaded through PublishProviderContext.
    const provider = getPublishingProvider("google_business_profile");

    await assert.rejects(
      () => provider.publish(publishContext(client, { userId: "request-user" })),
      /Connect Google Business Profile/
    );
    assert.deepEqual(userIdsQueried(calls), ["request-user"]);
  });
});

test("tenant mismatch (connection business_profile_id) fails without calling Google", async () => {
  await withEnv(GOOGLE_OAUTH_ENV, async () => {
    const { client, calls } = createFakeSupabaseClient({
      google_business_profile_connections: {
        data: connectedRow({ business_profile_id: "other-biz" }),
        error: null,
      },
    });

    await assert.rejects(
      () =>
        createGoogleBusinessLocalPost(client, {
          userId: "user-1",
          businessProfileId: "biz-1",
          summary: "Post body",
        }),
      /does not match this business/
    );

    assert.equal(
      calls.some((c) => c.table === "google_business_locations"),
      false,
      "must not look up locations after tenant mismatch"
    );
  });
});

test("tenant mismatch (location business_profile_id) fails safely", async () => {
  await withEnv(GOOGLE_OAUTH_ENV, async () => {
    // Connection matches, but location lookup is scoped by business_profile_id —
    // a mismatched location fixture with only user_id would be filtered out by the query.
    // Simulate "no matching location for this business" → sync error (fail closed).
    const { client } = createFakeSupabaseClient({
      google_business_profile_connections: { data: connectedRow(), error: null },
      google_business_locations: { data: null, error: null },
    });

    await assert.rejects(
      () =>
        createGoogleBusinessLocalPost(client, {
          userId: "user-1",
          businessProfileId: "biz-1",
          summary: "Post body",
        }),
      /Sync Google Business Profile locations/
    );
  });
});

test("missing GBP connection fails safely", async () => {
  await withEnv(GOOGLE_OAUTH_ENV, async () => {
    const { client } = createFakeSupabaseClient({
      google_business_profile_connections: { data: null, error: null },
    });

    await assert.rejects(
      () =>
        createGoogleBusinessLocalPost(client, {
          userId: "user-1",
          businessProfileId: "biz-1",
          summary: "Post body",
        }),
      /Connect Google Business Profile before publishing/
    );
  });
});

test("revoked GBP connection fails safely", async () => {
  await withEnv(GOOGLE_OAUTH_ENV, async () => {
    const { client } = createFakeSupabaseClient({
      google_business_profile_connections: {
        data: connectedRow({ connection_status: "revoked" }),
        error: null,
      },
    });

    await assert.rejects(
      () =>
        createGoogleBusinessLocalPost(client, {
          userId: "user-1",
          businessProfileId: "biz-1",
          summary: "Post body",
        }),
      /Connect Google Business Profile before publishing/
    );
  });
});

test("expired GBP connection (no refresh token) fails safely", async () => {
  await withEnv(GOOGLE_OAUTH_ENV, async () => {
    const { client } = createFakeSupabaseClient({
      google_business_profile_connections: {
        data: connectedRow({
          token_expires_at: new Date(Date.now() - 60_000).toISOString(),
          refresh_token_encrypted: null,
        }),
        error: null,
      },
    });

    await assert.rejects(
      () =>
        createGoogleBusinessLocalPost(client, {
          userId: "user-1",
          businessProfileId: "biz-1",
          summary: "Post body",
        }),
      /Google connection expired/
    );
  });
});

test("insufficient GBP scopes fails safely", async () => {
  await withEnv(GOOGLE_OAUTH_ENV, async () => {
    const { client } = createFakeSupabaseClient({
      google_business_profile_connections: {
        data: connectedRow({ scopes: ["https://www.googleapis.com/auth/userinfo.email"] }),
        error: null,
      },
    });

    await assert.rejects(
      () =>
        createGoogleBusinessLocalPost(client, {
          userId: "user-1",
          businessProfileId: "biz-1",
          summary: "Post body",
        }),
      /missing required permissions/
    );
  });
});

test("location lookup is scoped by userId and businessProfileId", async () => {
  await withEnv(GOOGLE_OAUTH_ENV, async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error("fetch must not be called in this tenant-scope unit test");
    }) as typeof fetch;

    try {
      const { client, calls } = createFakeSupabaseClient({
        google_business_profile_connections: { data: connectedRow(), error: null },
        // Matching location so we pass tenant checks; then fail before network via fetch stub
        // is not reached if we stop after asserting filters — use null location instead.
        google_business_locations: { data: null, error: null },
      });

      await assert.rejects(
        () =>
          createGoogleBusinessLocalPost(client, {
            userId: "user-1",
            businessProfileId: "biz-1",
            summary: "Post body",
          }),
        /Sync Google Business Profile locations/
      );

      assert.ok(
        calls.some(
          (c) => c.op === "eq" && c.args[0] === "user_id" && c.args[1] === "user-1"
        )
      );
      assert.ok(
        calls.some(
          (c) =>
            c.table === "google_business_locations" &&
            c.op === "eq" &&
            c.args[0] === "business_profile_id" &&
            c.args[1] === "biz-1"
        ),
        "location query must filter by business_profile_id"
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test("losing atomic claim never reaches provider.publish (no GBP connection queries)", async () => {
  const queued = baseJob({ status: PublishingJobStatuses.QUEUED });
  const alreadyPublishing = baseJob({ status: PublishingJobStatuses.PUBLISHING });
  let publishingJobsMaybeSingle = 0;

  const { client, calls } = createFakeSupabaseClient({
    publishing_jobs: (op) => {
      if (op === "maybeSingle") {
        publishingJobsMaybeSingle += 1;
        // 1) getPublishingJobById → claimable queued job
        // 2) claimPublishingJobForExecution → lost (0 rows)
        // 3) getPublishingJobById after loss → already publishing
        if (publishingJobsMaybeSingle === 1) return { data: queued, error: null };
        if (publishingJobsMaybeSingle === 2) return { data: null, error: null };
        return { data: alreadyPublishing, error: null };
      }
      return { data: queued, error: null };
    },
    google_business_profile_connections: {
      data: connectedRow(),
      error: null,
    },
    publishing_queue: { data: { id: "queue-1", content: "x" }, error: null },
  });

  const result = await executePublishingJobById("job-1", "user-1", client);

  assert.match(result.error ?? "", /already being executed/i);
  assert.equal(
    calls.some((c) => c.table === "google_business_profile_connections"),
    false,
    "provider must not run after a lost claim"
  );
  assert.equal(
    calls.some((c) => c.table === "publishing_queue"),
    false,
    "queue load happens only after a successful claim"
  );
});

test("concurrent claim harness: exactly one of two racers wins", async () => {
  const harness = createConcurrentPublishingClaimHarness(
    baseJob({ status: PublishingJobStatuses.SCHEDULED })
  );

  const attempts = await harness.raceClaims(
    ["manual", "trigger"],
    PublishingJobStatuses.SCHEDULED
  );

  const winners = attempts.filter((a) => a.won);
  const losers = attempts.filter((a) => !a.won);

  assert.equal(winners.length, 1);
  assert.equal(losers.length, 1);
  assert.equal(harness.getJob().status, "publishing");
  assert.equal(winners[0]!.claimed?.status, "publishing");
  assert.equal(losers[0]!.claimed, null);
});

test("concurrent claim harness works with claimPublishingJobForExecution", async () => {
  const harness = createConcurrentPublishingClaimHarness(
    baseJob({ status: PublishingJobStatuses.QUEUED })
  );

  const [first, second] = await Promise.all([
    claimPublishingJobForExecution(
      harness.client,
      "user-1",
      "job-1",
      PublishingJobStatuses.QUEUED
    ),
    claimPublishingJobForExecution(
      harness.client,
      "user-1",
      "job-1",
      PublishingJobStatuses.QUEUED
    ),
  ]);

  const wins = [first, second].filter(Boolean);
  assert.equal(wins.length, 1);
  assert.equal(harness.getJob().status, "publishing");
});

test("defense-in-depth location ownership check rejects mismatched row if returned", async () => {
  await withEnv(GOOGLE_OAUTH_ENV, async () => {
    const { client } = createFakeSupabaseClient({
      google_business_profile_connections: { data: connectedRow(), error: null },
      // Fake client ignores filters — return a row that belongs to another tenant.
      google_business_locations: {
        data: locationRow({ user_id: "other-user", business_profile_id: "other-biz" }),
        error: null,
      },
    });

    await assert.rejects(
      () =>
        createGoogleBusinessLocalPost(client, {
          userId: "user-1",
          businessProfileId: "biz-1",
          summary: "Post body",
        }),
      /location does not match this business/
    );
  });
});

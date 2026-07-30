import test from "node:test";
import assert from "node:assert/strict";
import {
  findMissingRequiredSearchConsoleScopes,
  hasRequiredSearchConsoleScopes,
  parseSearchConsoleOAuthScopes,
  REQUIRED_GOOGLE_SEARCH_CONSOLE_SCOPE,
} from "../lib/google-search-console/oauth.ts";
import {
  classifySearchConsoleConnectionFailure,
  deleteGoogleSearchConsoleConnection,
  formatSearchConsoleConnectionStatus,
  formatSearchConsoleSyncDate,
  getGoogleSearchConsoleConnectionForUser,
  resolveEffectiveSearchConsoleConnectionStatus,
  selectGoogleSearchConsoleProperty,
  upsertGoogleSearchConsoleConnection,
} from "../lib/google-search-console/persistence.ts";
import {
  buildSearchConsoleSignals,
  findDecliningQueries,
  findEmergingQueries,
  findOpportunities,
  findRisingQueries,
  findVisibilityChanges,
} from "../lib/google-search-console/normalize.ts";
import { getGoogleSearchConsoleConnectionStatusForUser } from "../lib/google-search-console/service.ts";
import { createSearchConsoleProvider } from "../lib/external-intelligence/providers/designed.ts";
import { GoogleApiError } from "../lib/google-business/googleApiError.ts";
import { createFakeSupabaseClient, userIdsQueried } from "./support/fake-supabase-client.ts";

const TOKEN_ENV = { TOKEN_ENCRYPTION_KEY: "1".repeat(64) };

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

// ---------------------------------------------------------------------------
// OAuth scopes
// ---------------------------------------------------------------------------

test("hasRequiredSearchConsoleScopes requires webmasters.readonly only", () => {
  assert.equal(hasRequiredSearchConsoleScopes([REQUIRED_GOOGLE_SEARCH_CONSOLE_SCOPE]), true);
  assert.equal(hasRequiredSearchConsoleScopes(["https://www.googleapis.com/auth/userinfo.email"]), false);
  assert.deepEqual(findMissingRequiredSearchConsoleScopes(null), [REQUIRED_GOOGLE_SEARCH_CONSOLE_SCOPE]);
});

test("parseSearchConsoleOAuthScopes dedupes and falls back to defaults when empty", () => {
  assert.deepEqual(parseSearchConsoleOAuthScopes("a a b"), ["a", "b"]);
  assert.ok(parseSearchConsoleOAuthScopes(undefined).includes(REQUIRED_GOOGLE_SEARCH_CONSOLE_SCOPE));
});

// ---------------------------------------------------------------------------
// Persistence + tenant isolation
// ---------------------------------------------------------------------------

test("classifySearchConsoleConnectionFailure maps auth failures to revoked/error", () => {
  assert.equal(classifySearchConsoleConnectionFailure(new Error("invalid_grant: token revoked")), "revoked");
  assert.equal(classifySearchConsoleConnectionFailure(new GoogleApiError("nope", 401)), "revoked");
  assert.equal(classifySearchConsoleConnectionFailure(new GoogleApiError("nope", 403)), "error");
  assert.equal(classifySearchConsoleConnectionFailure(new Error("network blip")), null);
});

test("formatSearchConsoleConnectionStatus / formatSearchConsoleSyncDate are customer-safe labels", () => {
  assert.equal(formatSearchConsoleConnectionStatus("connected"), "Connected");
  assert.equal(formatSearchConsoleConnectionStatus(null), "Unknown");
  assert.equal(formatSearchConsoleSyncDate(null), "Not synced yet");
  assert.match(formatSearchConsoleSyncDate("2026-07-29T12:00:00.000Z"), /2026/);
});

test("resolveEffectiveSearchConsoleConnectionStatus demotes an expired token", () => {
  assert.equal(resolveEffectiveSearchConsoleConnectionStatus(null), "not_connected");
  assert.equal(
    resolveEffectiveSearchConsoleConnectionStatus({
      connection_status: "connected",
      token_expires_at: new Date(Date.now() - 60_000).toISOString(),
    } as never),
    "expired",
  );
});

test("upsertGoogleSearchConsoleConnection never returns encrypted tokens; scoped to user_id", async () => {
  const { client, calls } = createFakeSupabaseClient({
    google_search_console_connections: {
      data: {
        id: "conn-1",
        user_id: "user-1",
        business_profile_id: "biz-1",
        google_account_email: "owner@example.com",
        google_account_name: "Owner",
        google_account_id: "g-1",
        selected_site_url: null,
        site_permission_level: null,
        access_token_encrypted: "enc:v2:should-not-leak",
        refresh_token_encrypted: "enc:v2:should-not-leak",
        token_expires_at: new Date().toISOString(),
        scopes: [REQUIRED_GOOGLE_SEARCH_CONSOLE_SCOPE],
        connection_status: "connected",
        last_synced_at: null,
        last_verified_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      error: null,
    },
  });

  const connection = await upsertGoogleSearchConsoleConnection(client, {
    userId: "user-1",
    businessProfileId: "biz-1",
    googleAccountEmail: "owner@example.com",
    googleAccountName: "Owner",
    googleAccountId: "g-1",
    accessTokenEncrypted: "enc:v2:token",
    refreshTokenEncrypted: "enc:v2:refresh",
    tokenExpiresAt: new Date().toISOString(),
    scopes: [REQUIRED_GOOGLE_SEARCH_CONSOLE_SCOPE],
  });

  assert.ok(connection);
  assert.equal((connection as unknown as { access_token_encrypted?: string }).access_token_encrypted, undefined);
  assert.equal((connection as unknown as { refresh_token_encrypted?: string }).refresh_token_encrypted, undefined);
  assert.deepEqual(userIdsQueried(calls), []); // upsert scopes by onConflict, not .eq("user_id")
  assert.ok(calls.some((c) => c.op === "upsert"));
});

test("getGoogleSearchConsoleConnectionForUser scopes the read to the given userId", async () => {
  const { client, calls } = createFakeSupabaseClient({
    google_search_console_connections: { data: null, error: null },
  });

  await getGoogleSearchConsoleConnectionForUser(client, "user-42");
  assert.deepEqual(userIdsQueried(calls), ["user-42"]);
});

test("deleteGoogleSearchConsoleConnection (real disconnect) scopes delete to the given userId", async () => {
  const { client, calls } = createFakeSupabaseClient({
    google_search_console_connections: { data: null, error: null },
  });

  const removed = await deleteGoogleSearchConsoleConnection(client, "user-7");
  assert.equal(removed, true);
  assert.ok(calls.some((c) => c.table === "google_search_console_connections" && c.op === "delete"));
  assert.deepEqual(userIdsQueried(calls), ["user-7"]);
});

test("selectGoogleSearchConsoleProperty scopes the update to the given userId", async () => {
  const { client, calls } = createFakeSupabaseClient({
    google_search_console_connections: {
      data: { id: "conn-1", user_id: "user-9", selected_site_url: "https://example.com/" },
      error: null,
    },
  });

  const updated = await selectGoogleSearchConsoleProperty(client, "user-9", {
    siteUrl: "https://example.com/",
    permissionLevel: "siteOwner",
  });

  assert.ok(updated);
  assert.deepEqual(userIdsQueried(calls), ["user-9"]);
});

test("getGoogleSearchConsoleConnectionStatusForUser short-circuits (no Google call) when never connected", async () => {
  await withEnv(TOKEN_ENV, async () => {
    const { client } = createFakeSupabaseClient({
      google_search_console_connections: { data: null, error: null },
    });

    const status = await getGoogleSearchConsoleConnectionStatusForUser("user-1", client);
    assert.equal(status.connected, false);
    assert.equal(status.propertySelected, false);
  });
});

test("getGoogleSearchConsoleConnectionStatusForUser reports setupRequired when TOKEN_ENCRYPTION_KEY is missing", async () => {
  await withEnv({ TOKEN_ENCRYPTION_KEY: undefined }, async () => {
    const { client } = createFakeSupabaseClient({
      google_search_console_connections: { data: null, error: null },
    });

    const status = await getGoogleSearchConsoleConnectionStatusForUser("user-1", client);
    assert.equal(status.setupRequired, true);
  });
});

// ---------------------------------------------------------------------------
// Normalization — the six insight kinds, computed only from stored comparisons.
// ---------------------------------------------------------------------------

test("findRisingQueries requires a real minimum and a meaningful ratio increase", () => {
  const rising = findRisingQueries(
    [{ value: "emergency plumber", clicks: 30, impressions: 200, ctr: 0.15, position: 4 }],
    [{ value: "emergency plumber", clicks: 10, impressions: 150, ctr: 0.07, position: 6 }],
  );
  assert.equal(rising.length, 1);
  assert.match(rising[0]!.title, /Rising query/);
  assert.match(rising[0]!.summary, /grew from 10 to 30/);

  const belowThreshold = findRisingQueries(
    [{ value: "small query", clicks: 2, impressions: 10, ctr: 0.2, position: 5 }],
    [{ value: "small query", clicks: 1, impressions: 5, ctr: 0.2, position: 5 }],
  );
  assert.equal(belowThreshold.length, 0);
});

test("findDecliningQueries flags a real drop, not noise", () => {
  const declining = findDecliningQueries(
    [{ value: "old service", clicks: 2, impressions: 50, ctr: 0.04, position: 8 }],
    [{ value: "old service", clicks: 20, impressions: 200, ctr: 0.1, position: 5 }],
  );
  assert.equal(declining.length, 1);
  assert.match(declining[0]!.summary, /fell from 20 to 2/);
});

test("findEmergingQueries hedges seasonal/trend language rather than asserting a cause", () => {
  const emerging = findEmergingQueries(
    [{ value: "holiday lights install", clicks: 12, impressions: 90, ctr: 0.13, position: 3 }],
    [{ value: "holiday lights install", clicks: 0, impressions: 0, ctr: 0, position: null }],
  );
  assert.equal(emerging.length, 1);
  assert.match(emerging[0]!.summary, /may reflect a seasonal pattern or an emerging trend/);
});

test("findVisibilityChanges distinguishes pages gaining vs losing visibility", () => {
  const { gaining, losing } = findVisibilityChanges(
    [
      { value: "/services/emergency", clicks: 5, impressions: 300, ctr: 0.02, position: 4 },
      { value: "/services/legacy", clicks: 1, impressions: 20, ctr: 0.05, position: 12 },
    ],
    [
      { value: "/services/emergency", clicks: 3, impressions: 100, ctr: 0.03, position: 6 },
      { value: "/services/legacy", clicks: 5, impressions: 100, ctr: 0.05, position: 5 },
    ],
  );

  assert.equal(gaining.length, 1);
  assert.match(gaining[0]!.title, /gaining visibility/i);
  assert.equal(losing.length, 1);
  assert.match(losing[0]!.title, /losing visibility/i);
});

test("findOpportunities surfaces high-impression, low-CTR queries", () => {
  const opportunities = findOpportunities([
    { value: "24 hour plumber", clicks: 2, impressions: 400, ctr: 0.005, position: 9 },
    { value: "well-performing query", clicks: 50, impressions: 200, ctr: 0.25, position: 2 },
  ]);
  assert.equal(opportunities.length, 1);
  assert.match(opportunities[0]!.summary, /24 hour plumber/);
});

test("buildSearchConsoleSignals returns [] for identical current/previous periods (no fabricated trend)", () => {
  const rows = [{ value: "steady query", clicks: 10, impressions: 100, ctr: 0.1, position: 5 }];
  const signals = buildSearchConsoleSignals({
    currentQueries: rows,
    previousQueries: rows,
    currentPages: [],
    previousPages: [],
  });
  assert.deepEqual(signals, []);
});

// ---------------------------------------------------------------------------
// External Intelligence provider — fails closed, never throws, never fabricates.
// ---------------------------------------------------------------------------

test("createSearchConsoleProvider().fetchSignals never throws, even without a request context", async () => {
  const provider = createSearchConsoleProvider();
  assert.equal(provider.id, "search_console");

  const result = await provider.fetchSignals({ userId: "user-1", businessProfileId: "biz-1" });
  assert.deepEqual(result.signals, []);
  assert.ok(result.notes && result.notes.length > 0);
});

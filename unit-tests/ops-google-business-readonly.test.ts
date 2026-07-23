import assert from "node:assert/strict";
import test from "node:test";
import { classifyGoogleBusinessConnectionReadOnly } from "../lib/ops-dashboard/googleBusinessReadOnly.ts";
import type { GoogleBusinessProfileConnectionPublic } from "../lib/google-business-profile/types.ts";

/**
 * Regression coverage for the PR #65 review fix: tenant health must never call the
 * live-verifying getGoogleBusinessProfileConnectionStatusForUser (which can trigger a
 * real Google token-refresh network call) for a bulk admin dashboard view. This
 * module composes the same pure primitives without that network call.
 */

function connection(
  overrides: Partial<GoogleBusinessProfileConnectionPublic> = {}
): GoogleBusinessProfileConnectionPublic {
  return {
    id: "conn-1",
    user_id: "user-1",
    business_profile_id: "biz-1",
    google_account_email: "owner@example.com",
    google_account_name: "Owner",
    google_account_id: "g-1",
    gbp_account_id: "acct-1",
    gbp_location_id: "loc-1",
    gbp_location_name: "Main location",
    token_expires_at: new Date(Date.now() + 3600_000).toISOString(),
    scopes: ["https://www.googleapis.com/auth/business.manage"],
    connection_status: "connected",
    last_synced_at: null,
    last_verified_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  } as GoogleBusinessProfileConnectionPublic;
}

const CONFIGURED = { oauthConfigured: true, connectionStorageConfigured: true };

test("globally unavailable config reports setupRequired, distinct from a customer simply not connecting", () => {
  const result = classifyGoogleBusinessConnectionReadOnly(null, {
    oauthConfigured: false,
    connectionStorageConfigured: true,
  });
  assert.equal(result.setupRequired, true);
  assert.equal(result.connected, false);
});

test("no connection row is not connected, not setupRequired", () => {
  const result = classifyGoogleBusinessConnectionReadOnly(null, CONFIGURED);
  assert.equal(result.setupRequired, false);
  assert.equal(result.connected, false);
  assert.equal(result.connection, null);
});

test("stored connected status with unexpired token is reported connected without any network call", () => {
  const result = classifyGoogleBusinessConnectionReadOnly(connection(), CONFIGURED);
  assert.equal(result.connected, true);
  assert.equal(result.scopesValid, true);
});

test("stored expiry already passed is reclassified as expired via pure timestamp comparison, not connected", () => {
  const result = classifyGoogleBusinessConnectionReadOnly(
    connection({ token_expires_at: new Date(Date.now() - 3600_000).toISOString() }),
    CONFIGURED
  );
  assert.equal(result.connected, false);
  assert.equal(result.connection?.connection_status, "expired");
});

test("revoked connection is reported disconnected", () => {
  const result = classifyGoogleBusinessConnectionReadOnly(
    connection({ connection_status: "revoked" }),
    CONFIGURED
  );
  assert.equal(result.connected, false);
});

test("missing required scopes is reported as scopesValid=false, distinct from disconnected", () => {
  const result = classifyGoogleBusinessConnectionReadOnly(
    connection({ scopes: ["https://www.googleapis.com/auth/plus.business.manage"] }),
    CONFIGURED
  );
  assert.equal(result.connected, false);
  assert.equal(result.scopesValid, false);
  assert.ok(result.missingScopes.length > 0);
});

/**
 * [Fix, PR #65 review] Read-only Google Business connection classification for bulk
 * tenant-health views.
 *
 * The authoritative `getGoogleBusinessProfileConnectionStatusForUser` (reused
 * correctly for single-tenant, customer-facing pages) will attempt a *live* Google
 * token refresh call when a connection is marked "connected" in the database but its
 * last live verification has gone stale (see lib/google-business-profile/service.ts).
 * That is appropriate for a customer loading their own GBP page once. It is not
 * appropriate for an admin loading a health dashboard page of up to 50 tenants at
 * once — that would fire up to 50 real Google API calls (and possibly write
 * connection-record updates) as a side effect of merely *viewing* operational health.
 *
 * This module reuses the same pure, already-exported building blocks the
 * authoritative function uses (resolveEffectiveConnectionStatus,
 * findMissingRequiredGoogleScopes) — it is not a second connection-state model, only
 * a second *composition* of the same primitives that stops short of the live
 * network call and trusts the last-known stored state instead.
 */

import type { GoogleBusinessProfileConnectionPublic } from "@/lib/google-business-profile/types";
import type { GoogleBusinessProfileConnectionStatus } from "@/lib/google-business-profile/types";
import { resolveEffectiveConnectionStatus } from "@/lib/google-business-profile/persistence";
import { findMissingRequiredGoogleScopes } from "@/lib/google-business-profile/oauth";

export function classifyGoogleBusinessConnectionReadOnly(
  connection: GoogleBusinessProfileConnectionPublic | null,
  config: { oauthConfigured: boolean; connectionStorageConfigured: boolean }
): GoogleBusinessProfileConnectionStatus {
  if (!config.oauthConfigured || !config.connectionStorageConfigured) {
    return {
      setupRequired: true,
      connected: false,
      connection: null,
      scopesValid: true,
      missingScopes: [],
    };
  }

  const effectiveStatus = resolveEffectiveConnectionStatus(connection);

  if (!connection || effectiveStatus === "revoked" || effectiveStatus === "not_connected") {
    return {
      setupRequired: false,
      connected: false,
      connection: connection ? { ...connection, connection_status: effectiveStatus } : null,
      scopesValid: connection ? findMissingRequiredGoogleScopes(connection.scopes).length === 0 : true,
      missingScopes: connection ? findMissingRequiredGoogleScopes(connection.scopes) : [],
    };
  }

  const missingScopes = findMissingRequiredGoogleScopes(connection.scopes);
  if (missingScopes.length > 0) {
    return {
      setupRequired: false,
      connected: false,
      connection: { ...connection, connection_status: effectiveStatus },
      scopesValid: false,
      missingScopes,
    };
  }

  // No live refresh attempt: trust the last-known stored state. "expired" is still
  // detected here because resolveEffectiveConnectionStatus's expiry check is a pure
  // timestamp comparison, not a network call.
  return {
    setupRequired: false,
    connected: effectiveStatus === "connected",
    connection: { ...connection, connection_status: effectiveStatus },
    scopesValid: true,
    missingScopes: [],
  };
}

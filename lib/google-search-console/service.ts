import "server-only";

import { getBusinessProfileForUser } from "@/lib/business-profile-server";
import {
  computeGoogleTokenExpiry,
  exchangeGoogleOAuthCode,
  fetchGoogleOAuthUserInfo,
  findMissingRequiredSearchConsoleScopes,
  getGoogleSearchConsoleOAuthSetupMessage,
  isGoogleSearchConsoleOAuthConfigured,
  parseSearchConsoleOAuthScopes,
} from "@/lib/google-search-console/oauth";
import {
  deleteGoogleSearchConsoleConnection,
  getGoogleSearchConsoleConnectionForUser,
  getGoogleSearchConsolePropertiesForUser,
  markSearchConsoleConnectionStatus,
  markSearchConsoleConnectionVerified,
  recordSearchConsoleConnectionFailureIfUnrecoverable,
  replaceGoogleSearchConsoleProperties,
  resolveEffectiveSearchConsoleConnectionStatus,
  selectGoogleSearchConsoleProperty,
  upsertGoogleSearchConsoleConnection,
} from "@/lib/google-search-console/persistence";
import type {
  GoogleSearchConsoleConnectionStatusResult,
  GoogleSearchConsoleProperty,
} from "@/lib/google-search-console/types";
import { isVerificationStale, verifyGoogleAccessTokenLive } from "@/lib/google-business-profile/verification";
import { getGoogleSearchConsoleAccessContextForUser } from "@/lib/google-search-console/auth";
import { listSearchConsoleSites } from "@/lib/google-search-console/api";
import { AuditActions, logAuditEvent } from "@/lib/audit-log-server";
import { encryptToken, isTokenEncryptionConfigured, TokenEncryptionError } from "@/lib/security/token-encryption";
import { sanitizeUserErrorMessage } from "@/lib/security/safe-error-message";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

export const SEARCH_CONSOLE_OAUTH_STATE_COOKIE = "gsc_oauth_state";

export function createSearchConsoleOAuthState(userId: string): string {
  return `${userId}:${randomUUID()}`;
}

export function parseSearchConsoleOAuthState(state: string): string | null {
  const [userId] = state.split(":");
  return userId?.trim() || null;
}

export function getSearchConsoleConnectionStorageSetupMessage(): string {
  return "Google connection storage is not configured. Set TOKEN_ENCRYPTION_KEY in your server environment.";
}

export function isSearchConsoleConnectionStorageConfigured(): boolean {
  return isTokenEncryptionConfigured();
}

function checkSearchConsoleSetup(): GoogleSearchConsoleConnectionStatusResult | null {
  if (!isGoogleSearchConsoleOAuthConfigured()) {
    return {
      setupRequired: true,
      setupMessage: getGoogleSearchConsoleOAuthSetupMessage(),
      connected: false,
      connection: null,
      scopesValid: true,
      missingScopes: [],
      propertySelected: false,
    };
  }

  if (!isSearchConsoleConnectionStorageConfigured()) {
    return {
      setupRequired: true,
      setupMessage: getSearchConsoleConnectionStorageSetupMessage(),
      connected: false,
      connection: null,
      scopesValid: true,
      missingScopes: [],
      propertySelected: false,
    };
  }

  return null;
}

/**
 * Explicit userId + injected-client variant — safe to call from privileged/scheduled
 * execution (e.g. the External Intelligence provider) for any userId. Mirrors
 * lib/google-business-profile/service.ts::getGoogleBusinessProfileConnectionStatusForUser.
 */
export async function getGoogleSearchConsoleConnectionStatusForUser(
  userId: string,
  supabase: SupabaseClient
): Promise<GoogleSearchConsoleConnectionStatusResult> {
  const setupStatus = checkSearchConsoleSetup();
  if (setupStatus) return setupStatus;

  const connection = await getGoogleSearchConsoleConnectionForUser(supabase, userId);
  const effectiveStatus = resolveEffectiveSearchConsoleConnectionStatus(connection);
  const propertySelected = Boolean(connection?.selected_site_url);

  if (!connection || connection.connection_status === "revoked" || connection.connection_status === "not_connected") {
    return {
      setupRequired: false,
      connected: false,
      connection: connection ? { ...connection, connection_status: effectiveStatus } : null,
      scopesValid: connection ? findMissingRequiredSearchConsoleScopes(connection.scopes).length === 0 : true,
      missingScopes: connection ? findMissingRequiredSearchConsoleScopes(connection.scopes) : [],
      propertySelected,
    };
  }

  const staticMissingScopes = findMissingRequiredSearchConsoleScopes(connection.scopes);
  if (staticMissingScopes.length > 0) {
    return {
      setupRequired: false,
      connected: false,
      connection: { ...connection, connection_status: effectiveStatus },
      scopesValid: false,
      missingScopes: staticMissingScopes,
      propertySelected,
    };
  }

  if (effectiveStatus === "connected" && !isVerificationStale(connection.last_verified_at)) {
    return {
      setupRequired: false,
      connected: true,
      connection: { ...connection, connection_status: effectiveStatus },
      scopesValid: true,
      missingScopes: [],
      propertySelected,
    };
  }

  let accessContext;
  try {
    accessContext = await getGoogleSearchConsoleAccessContextForUser(supabase, userId);
  } catch (error) {
    await recordSearchConsoleConnectionFailureIfUnrecoverable(supabase, userId, error);
    const updatedConnection = await getGoogleSearchConsoleConnectionForUser(supabase, userId);
    return {
      setupRequired: false,
      connected: false,
      connection: updatedConnection,
      scopesValid: updatedConnection ? findMissingRequiredSearchConsoleScopes(updatedConnection.scopes).length === 0 : true,
      missingScopes: updatedConnection ? findMissingRequiredSearchConsoleScopes(updatedConnection.scopes) : [],
      propertySelected: Boolean(updatedConnection?.selected_site_url),
    };
  }

  if (!accessContext) {
    return {
      setupRequired: false,
      connected: false,
      connection: null,
      scopesValid: true,
      missingScopes: [],
      propertySelected: false,
    };
  }

  const verification = await verifyGoogleAccessTokenLive(accessContext.accessToken);

  if (verification.outcome === "invalid") {
    await markSearchConsoleConnectionStatus(supabase, userId, "revoked");
    await logAuditEvent(supabase, {
      userId,
      businessProfileId: connection.business_profile_id,
      action: AuditActions.SEARCH_CONSOLE_CONNECTION_VERIFICATION_FAILED,
      entityType: "google_search_console_connection",
      entityId: connection.id,
      status: "failure",
      metadata: { reason: verification.reason, check: "live_token_verification" },
    });
    return {
      setupRequired: false,
      connected: false,
      connection: { ...connection, connection_status: "revoked" },
      scopesValid: true,
      missingScopes: [],
      propertySelected,
    };
  }

  if (verification.outcome === "unknown") {
    return {
      setupRequired: false,
      connected: true,
      connection: { ...connection, connection_status: effectiveStatus },
      scopesValid: true,
      missingScopes: [],
      propertySelected,
    };
  }

  const liveMissingScopes = findMissingRequiredSearchConsoleScopes(verification.scopes);
  await markSearchConsoleConnectionVerified(supabase, userId);

  if (liveMissingScopes.length > 0) {
    return {
      setupRequired: false,
      connected: false,
      connection: { ...connection, connection_status: "connected" },
      scopesValid: false,
      missingScopes: liveMissingScopes,
      propertySelected,
    };
  }

  return {
    setupRequired: false,
    connected: true,
    connection: { ...connection, connection_status: "connected", last_verified_at: new Date().toISOString() },
    scopesValid: true,
    missingScopes: [],
    propertySelected,
  };
}

export async function getGoogleSearchConsoleConnectionStatusForCurrentUser(): Promise<GoogleSearchConsoleConnectionStatusResult> {
  const setupStatus = checkSearchConsoleSetup();
  if (setupStatus) return setupStatus;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      setupRequired: false,
      connected: false,
      connection: null,
      scopesValid: true,
      missingScopes: [],
      propertySelected: false,
    };
  }

  return getGoogleSearchConsoleConnectionStatusForUser(user.id, supabase);
}

export async function completeSearchConsoleOAuthCallback(
  userId: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  if (!isGoogleSearchConsoleOAuthConfigured()) {
    return { success: false, error: getGoogleSearchConsoleOAuthSetupMessage() };
  }

  if (!isSearchConsoleConnectionStorageConfigured()) {
    return { success: false, error: getSearchConsoleConnectionStorageSetupMessage() };
  }

  const profile = await getBusinessProfileForUser();
  if (!profile) {
    return { success: false, error: "Business profile not found" };
  }

  try {
    const tokenResponse = await exchangeGoogleOAuthCode(code);
    const userInfo = await fetchGoogleOAuthUserInfo(tokenResponse.access_token);

    const supabase = await createClient();
    const connection = await upsertGoogleSearchConsoleConnection(supabase, {
      userId,
      businessProfileId: profile.id,
      googleAccountEmail: userInfo.email,
      googleAccountName: userInfo.name,
      googleAccountId: userInfo.id,
      accessTokenEncrypted: encryptToken(tokenResponse.access_token),
      refreshTokenEncrypted: tokenResponse.refresh_token
        ? encryptToken(tokenResponse.refresh_token)
        : null,
      tokenExpiresAt: computeGoogleTokenExpiry(tokenResponse.expires_in),
      scopes: parseSearchConsoleOAuthScopes(tokenResponse.scope),
      connectionStatus: "connected",
    });

    if (!connection) {
      return { success: false, error: "Unable to store Search Console connection" };
    }

    await logAuditEvent(supabase, {
      userId,
      businessProfileId: profile.id,
      action: AuditActions.SEARCH_CONSOLE_OAUTH_CONNECTED,
      entityType: "google_search_console_connection",
      entityId: connection.id,
      status: "success",
      metadata: {
        googleAccountEmail: userInfo.email,
        scopes: parseSearchConsoleOAuthScopes(tokenResponse.scope).length,
      },
    });

    // Discover available properties immediately so the connect page can offer
    // selection without a second round trip; auto-select when there's exactly one.
    try {
      const sites = await listSearchConsoleSites(tokenResponse.access_token);
      await replaceGoogleSearchConsoleProperties(supabase, {
        userId,
        businessProfileId: profile.id,
        connectionId: connection.id,
        properties: sites.map((site) => ({ siteUrl: site.siteUrl, permissionLevel: site.permissionLevel })),
      });

      if (sites.length === 1) {
        await selectGoogleSearchConsoleProperty(supabase, userId, {
          siteUrl: sites[0]!.siteUrl,
          permissionLevel: sites[0]!.permissionLevel,
        });
      }
    } catch {
      // Property discovery failing shouldn't fail the OAuth connection itself — the
      // connect page still offers a manual "refresh properties" action.
    }

    return { success: true };
  } catch (error) {
    const message =
      error instanceof TokenEncryptionError
        ? "Google connection storage is not configured. Contact your workspace administrator."
        : sanitizeUserErrorMessage(
            error instanceof Error ? error.message : "Search Console OAuth callback failed",
            "Google connection failed. Please try again."
          );

    const supabase = await createClient();
    await markSearchConsoleConnectionStatus(supabase, userId, "error");

    return { success: false, error: message };
  }
}

export async function listSearchConsolePropertiesForCurrentUser(): Promise<GoogleSearchConsoleProperty[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  return getGoogleSearchConsolePropertiesForUser(supabase, user.id);
}

export async function refreshSearchConsolePropertiesForCurrentUser(): Promise<{
  success: boolean;
  properties: GoogleSearchConsoleProperty[];
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, properties: [], error: "Unauthorized" };

  let accessContext;
  try {
    accessContext = await getGoogleSearchConsoleAccessContextForUser(supabase, user.id);
  } catch (error) {
    await recordSearchConsoleConnectionFailureIfUnrecoverable(supabase, user.id, error);
    return {
      success: false,
      properties: [],
      error: error instanceof Error ? error.message : "Unable to refresh Search Console properties",
    };
  }

  if (!accessContext) {
    return { success: false, properties: [], error: "Search Console is not connected." };
  }

  const sites = await listSearchConsoleSites(accessContext.accessToken);
  await replaceGoogleSearchConsoleProperties(supabase, {
    userId: user.id,
    businessProfileId: accessContext.connection.business_profile_id,
    connectionId: accessContext.connection.id,
    properties: sites.map((site) => ({ siteUrl: site.siteUrl, permissionLevel: site.permissionLevel })),
  });

  const properties = await getGoogleSearchConsolePropertiesForUser(supabase, user.id);
  return { success: true, properties };
}

export async function selectSearchConsolePropertyForCurrentUser(
  siteUrl: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const properties = await getGoogleSearchConsolePropertiesForUser(supabase, user.id);
  const match = properties.find((property) => property.site_url === siteUrl);
  if (!match) {
    return { success: false, error: "That property was not found among your discovered Search Console sites." };
  }

  const updated = await selectGoogleSearchConsoleProperty(supabase, user.id, {
    siteUrl: match.site_url,
    permissionLevel: match.permission_level,
  });

  if (!updated) {
    return { success: false, error: "Unable to select that property." };
  }

  return { success: true };
}

/** Real disconnect: removes stored tokens and discovered properties (RLS-scoped to caller). */
export async function disconnectSearchConsoleForCurrentUser(): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const connection = await getGoogleSearchConsoleConnectionForUser(supabase, user.id);
  const removed = await deleteGoogleSearchConsoleConnection(supabase, user.id);

  if (!removed) {
    return { success: false, error: "Unable to disconnect Search Console." };
  }

  await logAuditEvent(supabase, {
    userId: user.id,
    businessProfileId: connection?.business_profile_id ?? null,
    action: AuditActions.SEARCH_CONSOLE_DISCONNECTED,
    entityType: "google_search_console_connection",
    entityId: connection?.id ?? null,
    status: "success",
    metadata: {},
  });

  return { success: true };
}

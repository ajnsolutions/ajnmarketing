import "server-only";

import { getBusinessProfileForUser } from "@/lib/business-profile-server";
import {
  computeGoogleTokenExpiry,
  exchangeGoogleOAuthCode,
  fetchGoogleOAuthUserInfo,
  findMissingRequiredGoogleScopes,
  getGoogleBusinessOAuthSetupMessage,
  isGoogleBusinessOAuthConfigured,
  parseGoogleOAuthScopes,
} from "@/lib/google-business-profile/oauth";
import { logGoogleBusinessServerConfig } from "@/lib/google-business-profile/config";
import {
  getGoogleBusinessProfileConnectionForUser,
  markGoogleBusinessProfileConnectionStatus,
  markGoogleBusinessProfileConnectionVerified,
  recordGoogleConnectionFailureIfUnrecoverable,
  resolveEffectiveConnectionStatus,
  upsertGoogleBusinessProfileConnection,
} from "@/lib/google-business-profile/persistence";
import type { GoogleBusinessProfileConnectionStatus } from "@/lib/google-business-profile/types";
import { isVerificationStale, verifyGoogleAccessTokenLive } from "@/lib/google-business-profile/verification";
import { getGoogleAccessContextForUser } from "@/lib/google-business/auth";
import { AuditActions, logAuditEvent } from "@/lib/audit-log-server";
import { encryptToken, isTokenEncryptionConfigured, TokenEncryptionError } from "@/lib/security/token-encryption";
import { sanitizeUserErrorMessage } from "@/lib/security/safe-error-message";
import { createClient } from "@/lib/supabase/server";
import { randomUUID } from "crypto";

export const GBP_OAUTH_STATE_COOKIE = "gbp_oauth_state";

export function createGoogleBusinessOAuthState(userId: string): string {
  return `${userId}:${randomUUID()}`;
}

export function parseGoogleBusinessOAuthState(state: string): string | null {
  const [userId] = state.split(":");
  return userId?.trim() || null;
}

export function getGoogleConnectionStorageSetupMessage(): string {
  return "Google connection storage is not configured. Set TOKEN_ENCRYPTION_KEY in your server environment.";
}

export function isGoogleConnectionStorageConfigured(): boolean {
  return isTokenEncryptionConfigured();
}

export async function getGoogleBusinessProfileConnectionStatusForCurrentUser(): Promise<GoogleBusinessProfileConnectionStatus> {
  if (!isGoogleBusinessOAuthConfigured()) {
    logGoogleBusinessServerConfig("connection_status.oauth_missing");
    return {
      setupRequired: true,
      setupMessage: getGoogleBusinessOAuthSetupMessage(),
      connected: false,
      connection: null,
      scopesValid: true,
      missingScopes: [],
    };
  }

  if (!isGoogleConnectionStorageConfigured()) {
    logGoogleBusinessServerConfig("connection_status.storage_missing");
    return {
      setupRequired: true,
      setupMessage: getGoogleConnectionStorageSetupMessage(),
      connected: false,
      connection: null,
      scopesValid: true,
      missingScopes: [],
    };
  }

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
    };
  }

  const connection = await getGoogleBusinessProfileConnectionForUser(supabase, user.id);
  const effectiveStatus = resolveEffectiveConnectionStatus(connection);

  if (!connection || connection.connection_status === "revoked" || connection.connection_status === "not_connected") {
    // Already confirmed broken (or never connected) — no point spending a Google call on it.
    return {
      setupRequired: false,
      connected: false,
      connection: connection ? { ...connection, connection_status: effectiveStatus } : null,
      scopesValid: connection ? findMissingRequiredGoogleScopes(connection.scopes).length === 0 : true,
      missingScopes: connection ? findMissingRequiredGoogleScopes(connection.scopes) : [],
    };
  }

  // Stored scopes are checked locally first (cheap, no network call) before ever touching Google.
  const staticMissingScopes = findMissingRequiredGoogleScopes(connection.scopes);
  if (staticMissingScopes.length > 0) {
    return {
      setupRequired: false,
      connected: false,
      connection: { ...connection, connection_status: effectiveStatus },
      scopesValid: false,
      missingScopes: staticMissingScopes,
    };
  }

  // Trust a recent live verification only if the token also hasn't crossed its expiry since
  // then — an expired token still needs a refresh attempt regardless of TTL.
  if (effectiveStatus === "connected" && !isVerificationStale(connection.last_verified_at)) {
    return {
      setupRequired: false,
      connected: true,
      connection: { ...connection, connection_status: effectiveStatus },
      scopesValid: true,
      missingScopes: [],
    };
  }

  // Otherwise, actually try to get a usable token. This is the single source of truth for
  // refresh-if-needed / revoked detection — whether the DB row currently says "connected"
  // (expiry not yet reached, but never live-verified or TTL stale) or "expired" (DB expiry
  // math already tripped), attempting this distinguishes "was fine, refreshed fine" from
  // "genuinely revoked" instead of leaving everything expired-per-timestamp lumped together.
  let accessContext;
  try {
    accessContext = await getGoogleAccessContextForUser(supabase, user.id);
  } catch (error) {
    // getGoogleAccessContextForUser already records unrecoverable failures (revoked, etc.)
    // onto the connection record — re-read it so this response reflects that write.
    await recordGoogleConnectionFailureIfUnrecoverable(supabase, user.id, error);
    const updatedConnection = await getGoogleBusinessProfileConnectionForUser(supabase, user.id);
    return {
      setupRequired: false,
      connected: false,
      connection: updatedConnection,
      scopesValid: updatedConnection ? findMissingRequiredGoogleScopes(updatedConnection.scopes).length === 0 : true,
      missingScopes: updatedConnection ? findMissingRequiredGoogleScopes(updatedConnection.scopes) : [],
    };
  }

  if (!accessContext) {
    return {
      setupRequired: false,
      connected: false,
      connection: null,
      scopesValid: true,
      missingScopes: [],
    };
  }

  const verification = await verifyGoogleAccessTokenLive(accessContext.accessToken);

  if (verification.outcome === "invalid") {
    await markGoogleBusinessProfileConnectionStatus(supabase, user.id, "revoked");
    await logAuditEvent(supabase, {
      userId: user.id,
      businessProfileId: connection.business_profile_id,
      action: AuditActions.GOOGLE_BUSINESS_CONNECTION_VERIFICATION_FAILED,
      entityType: "google_business_profile_connection",
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
    };
  }

  if (verification.outcome === "unknown") {
    // Couldn't reach Google to verify — fail open on our own DB/expiry read rather than
    // punishing the user for a transient issue on our side, and don't cache this outcome.
    return {
      setupRequired: false,
      connected: true,
      connection: { ...connection, connection_status: effectiveStatus },
      scopesValid: true,
      missingScopes: [],
    };
  }

  // verification.outcome === "valid" — prefer the live scope grant Google just reported
  // over our locally stored copy, since it reflects the token's actual current permissions.
  const liveMissingScopes = findMissingRequiredGoogleScopes(verification.scopes);
  await markGoogleBusinessProfileConnectionVerified(supabase, user.id);

  if (liveMissingScopes.length > 0) {
    return {
      setupRequired: false,
      connected: false,
      connection: { ...connection, connection_status: "connected" },
      scopesValid: false,
      missingScopes: liveMissingScopes,
    };
  }

  return {
    setupRequired: false,
    connected: true,
    connection: { ...connection, connection_status: "connected", last_verified_at: new Date().toISOString() },
    scopesValid: true,
    missingScopes: [],
  };
}

export async function completeGoogleBusinessOAuthCallback(
  userId: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  if (!isGoogleBusinessOAuthConfigured()) {
    return { success: false, error: getGoogleBusinessOAuthSetupMessage() };
  }

  if (!isGoogleConnectionStorageConfigured()) {
    return { success: false, error: getGoogleConnectionStorageSetupMessage() };
  }

  const profile = await getBusinessProfileForUser();
  if (!profile) {
    return { success: false, error: "Business profile not found" };
  }

  try {
    const tokenResponse = await exchangeGoogleOAuthCode(code);
    const userInfo = await fetchGoogleOAuthUserInfo(tokenResponse.access_token);

    const supabase = await createClient();
    const connection = await upsertGoogleBusinessProfileConnection(supabase, {
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
      scopes: parseGoogleOAuthScopes(tokenResponse.scope),
      connectionStatus: "connected",
    });

    if (!connection) {
      return { success: false, error: "Unable to store Google Business Profile connection" };
    }

    await logAuditEvent(supabase, {
      userId,
      businessProfileId: profile.id,
      action: AuditActions.GOOGLE_OAUTH_CONNECTED,
      entityType: "google_business_profile_connection",
      entityId: connection.id,
      status: "success",
      metadata: {
        googleAccountEmail: userInfo.email,
        scopes: parseGoogleOAuthScopes(tokenResponse.scope).length,
      },
    });

    return { success: true };
  } catch (error) {
    const message =
      error instanceof TokenEncryptionError
        ? "Google connection storage is not configured. Contact your workspace administrator."
        : sanitizeUserErrorMessage(
            error instanceof Error ? error.message : "Google OAuth callback failed",
            "Google connection failed. Please try again."
          );

    const supabase = await createClient();
    await markGoogleBusinessProfileConnectionStatus(supabase, userId, "error");

    return { success: false, error: message };
  }
}

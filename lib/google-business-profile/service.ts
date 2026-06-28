import "server-only";

import { getBusinessProfileForUser } from "@/lib/business-profile-server";
import {
  computeGoogleTokenExpiry,
  exchangeGoogleOAuthCode,
  fetchGoogleOAuthUserInfo,
  getGoogleBusinessOAuthSetupMessage,
  isGoogleBusinessOAuthConfigured,
  parseGoogleOAuthScopes,
} from "@/lib/google-business-profile/oauth";
import {
  getGoogleBusinessProfileConnectionForUser,
  markGoogleBusinessProfileConnectionStatus,
  resolveEffectiveConnectionStatus,
  upsertGoogleBusinessProfileConnection,
} from "@/lib/google-business-profile/persistence";
import type { GoogleBusinessProfileConnectionStatus } from "@/lib/google-business-profile/types";
import { encryptToken } from "@/lib/security/token-encryption";
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

export async function getGoogleBusinessProfileConnectionStatusForCurrentUser(): Promise<GoogleBusinessProfileConnectionStatus> {
  if (!isGoogleBusinessOAuthConfigured()) {
    return {
      setupRequired: true,
      setupMessage: getGoogleBusinessOAuthSetupMessage(),
      connected: false,
      connection: null,
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
    };
  }

  const connection = await getGoogleBusinessProfileConnectionForUser(supabase, user.id);
  const effectiveStatus = resolveEffectiveConnectionStatus(connection);

  if (connection && effectiveStatus === "expired" && connection.connection_status === "connected") {
    await markGoogleBusinessProfileConnectionStatus(supabase, user.id, "expired");
    return {
      setupRequired: false,
      connected: false,
      connection: { ...connection, connection_status: "expired" },
    };
  }

  return {
    setupRequired: false,
    connected: effectiveStatus === "connected",
    connection: connection
      ? { ...connection, connection_status: effectiveStatus }
      : null,
  };
}

export async function completeGoogleBusinessOAuthCallback(
  userId: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  if (!isGoogleBusinessOAuthConfigured()) {
    return { success: false, error: getGoogleBusinessOAuthSetupMessage() };
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

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google OAuth callback failed";

    const supabase = await createClient();
    await markGoogleBusinessProfileConnectionStatus(supabase, userId, "error");

    return { success: false, error: message };
  }
}

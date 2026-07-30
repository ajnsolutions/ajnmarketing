import "server-only";

import {
  computeGoogleTokenExpiry,
  hasRequiredSearchConsoleScopes,
  isGoogleSearchConsoleOAuthConfigured,
} from "@/lib/google-search-console/oauth";
import {
  getGoogleSearchConsoleConnectionWithTokensForUser,
  recordSearchConsoleConnectionFailureIfUnrecoverable,
} from "@/lib/google-search-console/persistence";
import type { GoogleSearchConsoleConnectionRecord } from "@/lib/google-search-console/types";
import { GoogleApiError } from "@/lib/google-business/google-api";
import { decryptToken, encryptToken, TokenEncryptionError } from "@/lib/security/token-encryption";
import type { SupabaseClient } from "@supabase/supabase-js";

const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";

export type SearchConsoleAccessContext = {
  accessToken: string;
  connection: GoogleSearchConsoleConnectionRecord;
};

async function refreshSearchConsoleAccessToken(
  refreshToken: string
): Promise<{ access_token: string; expires_in: number; refresh_token?: string }> {
  if (!isGoogleSearchConsoleOAuthConfigured()) {
    throw new Error("Google OAuth is not configured.");
  }

  const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
      client_secret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  const payload = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
    error?: string;
  };

  if (!response.ok || !payload.access_token || !payload.expires_in) {
    throw new GoogleApiError(
      payload.error ?? "Unable to refresh Google access token",
      response.status
    );
  }

  return {
    access_token: payload.access_token,
    expires_in: payload.expires_in,
    refresh_token: payload.refresh_token,
  };
}

async function persistRefreshedTokens(
  supabase: SupabaseClient,
  connection: GoogleSearchConsoleConnectionRecord,
  accessToken: string,
  expiresIn: number,
  refreshToken?: string
): Promise<void> {
  await supabase
    .from("google_search_console_connections")
    .update({
      access_token_encrypted: encryptToken(accessToken),
      refresh_token_encrypted: refreshToken
        ? encryptToken(refreshToken)
        : connection.refresh_token_encrypted,
      token_expires_at: computeGoogleTokenExpiry(expiresIn),
      connection_status: "connected",
    })
    .eq("id", connection.id);
}

/**
 * Resolves a usable Search Console access token for a user, refreshing it if needed.
 * Mirrors lib/google-business/auth.ts::getGoogleAccessContextForUser but reads/writes
 * google_search_console_connections — a separate, independently connectable OAuth
 * connection from Google Business Profile.
 */
export async function getGoogleSearchConsoleAccessContextForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<SearchConsoleAccessContext | null> {
  const connection = await getGoogleSearchConsoleConnectionWithTokensForUser(supabase, userId);

  if (!connection?.access_token_encrypted || connection.connection_status === "revoked") {
    return null;
  }

  if (!hasRequiredSearchConsoleScopes(connection.scopes)) {
    throw new Error(
      "Search Console connection is missing required permissions. Reconnect Search Console to grant access."
    );
  }

  const expiresAt = connection.token_expires_at
    ? new Date(connection.token_expires_at).getTime()
    : 0;
  const needsRefresh = !expiresAt || expiresAt <= Date.now() + 60_000;

  if (!needsRefresh) {
    try {
      return {
        accessToken: decryptToken(connection.access_token_encrypted),
        connection,
      };
    } catch (error) {
      if (error instanceof TokenEncryptionError) {
        throw new Error("Unable to read stored Google credentials. Reconnect Search Console.");
      }
      throw error;
    }
  }

  if (!connection.refresh_token_encrypted) {
    await supabase
      .from("google_search_console_connections")
      .update({ connection_status: "expired" })
      .eq("id", connection.id);
    throw new Error("Search Console connection expired. Reconnect Search Console.");
  }

  let refreshToken: string;
  try {
    refreshToken = decryptToken(connection.refresh_token_encrypted);
  } catch (error) {
    if (error instanceof TokenEncryptionError) {
      throw new Error("Unable to read stored Google credentials. Reconnect Search Console.");
    }
    throw error;
  }

  let refreshed: Awaited<ReturnType<typeof refreshSearchConsoleAccessToken>>;
  try {
    refreshed = await refreshSearchConsoleAccessToken(refreshToken);
  } catch (error) {
    await recordSearchConsoleConnectionFailureIfUnrecoverable(supabase, userId, error);
    throw error;
  }

  await persistRefreshedTokens(
    supabase,
    connection,
    refreshed.access_token,
    refreshed.expires_in,
    refreshed.refresh_token
  );

  return {
    accessToken: refreshed.access_token,
    connection: {
      ...connection,
      access_token_encrypted: encryptToken(refreshed.access_token),
      token_expires_at: computeGoogleTokenExpiry(refreshed.expires_in),
      connection_status: "connected",
    },
  };
}

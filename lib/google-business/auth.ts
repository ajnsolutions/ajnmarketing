import "server-only";

import {
  computeGoogleTokenExpiry,
  GOOGLE_OAUTH_TOKEN_URL,
  isGoogleBusinessOAuthConfigured,
} from "@/lib/google-business-profile/oauth";
import {
  getGoogleBusinessProfileConnectionWithTokensForUser,
} from "@/lib/google-business-profile/persistence";
import type { GoogleBusinessProfileConnectionRecord } from "@/lib/google-business-profile/types";
import { decryptToken, encryptToken } from "@/lib/security/token-encryption";
import type { SupabaseClient } from "@supabase/supabase-js";

export type GoogleAccessContext = {
  accessToken: string;
  connection: GoogleBusinessProfileConnectionRecord;
};

async function refreshGoogleAccessToken(
  refreshToken: string
): Promise<{ access_token: string; expires_in: number; refresh_token?: string }> {
  if (!isGoogleBusinessOAuthConfigured()) {
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
    throw new Error(payload.error ?? "Unable to refresh Google access token");
  }

  return {
    access_token: payload.access_token,
    expires_in: payload.expires_in,
    refresh_token: payload.refresh_token,
  };
}

async function persistRefreshedTokens(
  supabase: SupabaseClient,
  connection: GoogleBusinessProfileConnectionRecord,
  accessToken: string,
  expiresIn: number,
  refreshToken?: string
): Promise<void> {
  await supabase
    .from("google_business_profile_connections")
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

export async function getGoogleAccessContextForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<GoogleAccessContext | null> {
  const connection = await getGoogleBusinessProfileConnectionWithTokensForUser(supabase, userId);

  if (!connection?.access_token_encrypted || connection.connection_status === "revoked") {
    return null;
  }

  const expiresAt = connection.token_expires_at
    ? new Date(connection.token_expires_at).getTime()
    : 0;
  const needsRefresh = !expiresAt || expiresAt <= Date.now() + 60_000;

  if (!needsRefresh) {
    return {
      accessToken: decryptToken(connection.access_token_encrypted),
      connection,
    };
  }

  if (!connection.refresh_token_encrypted) {
    await supabase
      .from("google_business_profile_connections")
      .update({ connection_status: "expired" })
      .eq("id", connection.id);
    throw new Error("Google connection expired. Reconnect your Google Business Profile.");
  }

  const refreshed = await refreshGoogleAccessToken(
    decryptToken(connection.refresh_token_encrypted)
  );

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

export function parseGoogleResourceIds(resourceName: string): {
  accountId: string | null;
  locationId: string | null;
} {
  const accountMatch = resourceName.match(/accounts\/([^/]+)/);
  const locationMatch = resourceName.match(/locations\/([^/]+)/);

  return {
    accountId: accountMatch?.[1] ?? null,
    locationId: locationMatch?.[1] ?? null,
  };
}

export function extractGoogleAccountId(accountResourceName: string): string | null {
  return parseGoogleResourceIds(accountResourceName).accountId;
}

export function extractGoogleLocationId(locationResourceName: string): string | null {
  return parseGoogleResourceIds(locationResourceName).locationId;
}

export function resolveGoogleLocationIds(location: {
  google_account_id: string;
  google_location_id: string;
}): { accountId: string; locationId: string } {
  const accountId =
    extractGoogleAccountId(location.google_account_id) ??
    location.google_account_id.replace(/^accounts\//, "");
  const locationId =
    extractGoogleLocationId(location.google_location_id) ??
    location.google_location_id.replace(/^locations\//, "");

  if (!accountId || !locationId) {
    throw new Error("Unable to parse Google account and location identifiers.");
  }

  return { accountId, locationId };
}

export function starRatingToNumber(starRating: string | undefined): number {
  switch (starRating) {
    case "ONE":
      return 1;
    case "TWO":
      return 2;
    case "THREE":
      return 3;
    case "FOUR":
      return 4;
    case "FIVE":
      return 5;
    default:
      return 0;
  }
}

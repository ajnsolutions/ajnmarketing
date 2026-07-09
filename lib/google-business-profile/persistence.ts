import type { SupabaseClient } from "@supabase/supabase-js";
import { GoogleApiError } from "@/lib/google-business/googleApiError";
import type {
  GbpConnectionStatus,
  GoogleBusinessProfileConnectionPublic,
  GoogleBusinessProfileConnectionRecord,
} from "@/lib/google-business-profile/types";

const PUBLIC_CONNECTION_COLUMNS =
  "id, user_id, business_profile_id, google_account_email, google_account_name, google_account_id, gbp_account_id, gbp_location_id, gbp_location_name, token_expires_at, scopes, connection_status, last_synced_at, last_verified_at, created_at, updated_at";

/** Messages Google's OAuth token endpoint returns when a refresh token is no longer usable. */
const UNRECOVERABLE_AUTH_MESSAGE_FRAGMENTS = [
  "invalid_grant",
  "unauthorized_client",
  "token has been expired or revoked",
];

/**
 * Decides whether an error from a Google API call or token refresh indicates the
 * connection itself is broken (and the DB status should change) versus a transient
 * failure (rate limiting, a 5xx from Google, a network blip) that shouldn't cause the
 * connection status to flap.
 */
export function classifyGoogleConnectionFailure(error: unknown): GbpConnectionStatus | null {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  if (UNRECOVERABLE_AUTH_MESSAGE_FRAGMENTS.some((fragment) => message.includes(fragment))) {
    return "revoked";
  }

  if (error instanceof GoogleApiError) {
    if (error.status === 401) return "revoked";
    if (error.status === 403) return "error";
  }

  return null;
}

export function formatGbpConnectionStatus(
  status: GbpConnectionStatus | null | undefined
): string {
  switch (status) {
    case "connected":
      return "Connected";
    case "not_connected":
      return "Not Connected";
    case "expired":
      return "Expired";
    case "revoked":
      return "Revoked";
    case "error":
      return "Error";
    default:
      return "Unknown";
  }
}

export function formatGbpSyncDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "Not synced yet";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(isoDate));
}

function toPublicConnection(
  record: GoogleBusinessProfileConnectionRecord | GoogleBusinessProfileConnectionPublic
): GoogleBusinessProfileConnectionPublic {
  const { access_token_encrypted: _access, refresh_token_encrypted: _refresh, ...publicRecord } =
    record as GoogleBusinessProfileConnectionRecord;

  return publicRecord;
}

export async function getGoogleBusinessProfileConnectionForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<GoogleBusinessProfileConnectionPublic | null> {
  const { data, error } = await supabase
    .from("google_business_profile_connections")
    .select(PUBLIC_CONNECTION_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return data as GoogleBusinessProfileConnectionPublic;
}

export async function getGoogleBusinessProfileConnectionWithTokensForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<GoogleBusinessProfileConnectionRecord | null> {
  const { data, error } = await supabase
    .from("google_business_profile_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return data as GoogleBusinessProfileConnectionRecord;
}

export async function upsertGoogleBusinessProfileConnection(
  supabase: SupabaseClient,
  input: {
    userId: string;
    businessProfileId: string;
    googleAccountEmail: string;
    googleAccountName: string;
    googleAccountId: string;
    accessTokenEncrypted: string;
    refreshTokenEncrypted: string | null;
    tokenExpiresAt: string;
    scopes: string[];
    connectionStatus?: GbpConnectionStatus;
  }
): Promise<GoogleBusinessProfileConnectionPublic | null> {
  const { data, error } = await supabase
    .from("google_business_profile_connections")
    .upsert(
      {
        user_id: input.userId,
        business_profile_id: input.businessProfileId,
        google_account_email: input.googleAccountEmail,
        google_account_name: input.googleAccountName,
        google_account_id: input.googleAccountId,
        access_token_encrypted: input.accessTokenEncrypted,
        refresh_token_encrypted: input.refreshTokenEncrypted,
        token_expires_at: input.tokenExpiresAt,
        scopes: input.scopes,
        connection_status: input.connectionStatus ?? "connected",
      },
      { onConflict: "user_id" }
    )
    .select(PUBLIC_CONNECTION_COLUMNS)
    .single();

  if (error || !data) return null;
  return toPublicConnection(data as GoogleBusinessProfileConnectionPublic);
}

export async function markGoogleBusinessProfileConnectionStatus(
  supabase: SupabaseClient,
  userId: string,
  status: GbpConnectionStatus
): Promise<GoogleBusinessProfileConnectionPublic | null> {
  const { data, error } = await supabase
    .from("google_business_profile_connections")
    .update({ connection_status: status })
    .eq("user_id", userId)
    .select(PUBLIC_CONNECTION_COLUMNS)
    .maybeSingle();

  if (error || !data) return null;
  return data as GoogleBusinessProfileConnectionPublic;
}

/**
 * Classifies a Google API/refresh failure and, if it's an unrecoverable auth failure,
 * writes the corresponding status onto the connection record itself — not just a sync log
 * row — so `connection_status` reflects reality instead of staying "connected" forever.
 * Returns the status it wrote, or null if the error wasn't classified as connection-breaking.
 */
export async function recordGoogleConnectionFailureIfUnrecoverable(
  supabase: SupabaseClient,
  userId: string,
  error: unknown
): Promise<GbpConnectionStatus | null> {
  const status = classifyGoogleConnectionFailure(error);
  if (!status) return null;

  await markGoogleBusinessProfileConnectionStatus(supabase, userId, status);
  return status;
}

export async function markGoogleBusinessProfileConnectionVerified(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  await supabase
    .from("google_business_profile_connections")
    .update({ last_verified_at: new Date().toISOString(), connection_status: "connected" })
    .eq("user_id", userId);
}

export function resolveEffectiveConnectionStatus(
  connection: GoogleBusinessProfileConnectionPublic | null
): GbpConnectionStatus {
  if (!connection) return "not_connected";

  if (
    connection.connection_status === "connected" &&
    connection.token_expires_at &&
    new Date(connection.token_expires_at).getTime() <= Date.now()
  ) {
    return "expired";
  }

  return connection.connection_status;
}

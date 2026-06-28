import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  GbpConnectionStatus,
  GoogleBusinessProfileConnectionPublic,
  GoogleBusinessProfileConnectionRecord,
} from "@/lib/google-business-profile/types";

const PUBLIC_CONNECTION_COLUMNS =
  "id, user_id, business_profile_id, google_account_email, google_account_name, google_account_id, gbp_account_id, gbp_location_id, gbp_location_name, token_expires_at, scopes, connection_status, last_synced_at, created_at, updated_at";

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

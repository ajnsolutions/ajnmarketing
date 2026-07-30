import type { SupabaseClient } from "@supabase/supabase-js";
import { GoogleApiError } from "@/lib/google-business/googleApiError";
import type {
  GoogleSearchConsoleConnectionPublic,
  GoogleSearchConsoleConnectionRecord,
  GoogleSearchConsoleProperty,
  SearchConsoleConnectionStatus,
} from "@/lib/google-search-console/types";

export const PUBLIC_CONNECTION_COLUMNS =
  "id, user_id, business_profile_id, google_account_email, google_account_name, google_account_id, selected_site_url, site_permission_level, token_expires_at, scopes, connection_status, last_synced_at, last_verified_at, created_at, updated_at";

/** Messages Google's OAuth token endpoint returns when a refresh token is no longer usable. */
const UNRECOVERABLE_AUTH_MESSAGE_FRAGMENTS = [
  "invalid_grant",
  "unauthorized_client",
  "token has been expired or revoked",
];

/**
 * Decides whether an error from a Google API call or token refresh indicates the
 * connection itself is broken (and the DB status should change) versus a transient
 * failure that shouldn't cause the connection status to flap. Mirrors
 * lib/google-business-profile/persistence.ts::classifyGoogleConnectionFailure.
 */
export function classifySearchConsoleConnectionFailure(
  error: unknown
): SearchConsoleConnectionStatus | null {
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

export function formatSearchConsoleConnectionStatus(
  status: SearchConsoleConnectionStatus | null | undefined
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

export function formatSearchConsoleSyncDate(isoDate: string | null | undefined): string {
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
  record: GoogleSearchConsoleConnectionRecord | GoogleSearchConsoleConnectionPublic
): GoogleSearchConsoleConnectionPublic {
  const full = record as GoogleSearchConsoleConnectionRecord;
  return {
    id: full.id,
    user_id: full.user_id,
    business_profile_id: full.business_profile_id,
    google_account_email: full.google_account_email,
    google_account_name: full.google_account_name,
    google_account_id: full.google_account_id,
    selected_site_url: full.selected_site_url,
    site_permission_level: full.site_permission_level,
    token_expires_at: full.token_expires_at,
    scopes: full.scopes,
    connection_status: full.connection_status,
    last_synced_at: full.last_synced_at,
    last_verified_at: full.last_verified_at,
    created_at: full.created_at,
    updated_at: full.updated_at,
  };
}

export async function getGoogleSearchConsoleConnectionForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<GoogleSearchConsoleConnectionPublic | null> {
  const { data, error } = await supabase
    .from("google_search_console_connections")
    .select(PUBLIC_CONNECTION_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return data as GoogleSearchConsoleConnectionPublic;
}

export async function getGoogleSearchConsoleConnectionWithTokensForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<GoogleSearchConsoleConnectionRecord | null> {
  const { data, error } = await supabase
    .from("google_search_console_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return data as GoogleSearchConsoleConnectionRecord;
}

export async function upsertGoogleSearchConsoleConnection(
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
    connectionStatus?: SearchConsoleConnectionStatus;
  }
): Promise<GoogleSearchConsoleConnectionPublic | null> {
  const { data, error } = await supabase
    .from("google_search_console_connections")
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
  return toPublicConnection(data as GoogleSearchConsoleConnectionPublic);
}

export async function markSearchConsoleConnectionStatus(
  supabase: SupabaseClient,
  userId: string,
  status: SearchConsoleConnectionStatus
): Promise<GoogleSearchConsoleConnectionPublic | null> {
  const { data, error } = await supabase
    .from("google_search_console_connections")
    .update({ connection_status: status })
    .eq("user_id", userId)
    .select(PUBLIC_CONNECTION_COLUMNS)
    .maybeSingle();

  if (error || !data) return null;
  return data as GoogleSearchConsoleConnectionPublic;
}

/**
 * Classifies a Google API/refresh failure and, if it's an unrecoverable auth failure,
 * writes the corresponding status onto the connection record itself — not just a sync
 * log row — so `connection_status` reflects reality instead of staying "connected" forever.
 */
export async function recordSearchConsoleConnectionFailureIfUnrecoverable(
  supabase: SupabaseClient,
  userId: string,
  error: unknown
): Promise<SearchConsoleConnectionStatus | null> {
  const status = classifySearchConsoleConnectionFailure(error);
  if (!status) return null;

  await markSearchConsoleConnectionStatus(supabase, userId, status);
  return status;
}

export async function markSearchConsoleConnectionVerified(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  await supabase
    .from("google_search_console_connections")
    .update({ last_verified_at: new Date().toISOString(), connection_status: "connected" })
    .eq("user_id", userId);
}

export function resolveEffectiveSearchConsoleConnectionStatus(
  connection: GoogleSearchConsoleConnectionPublic | null
): SearchConsoleConnectionStatus {
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

/** Real disconnect — removes stored tokens and discovered properties entirely. */
export async function deleteGoogleSearchConsoleConnection(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { error } = await supabase
    .from("google_search_console_connections")
    .delete()
    .eq("user_id", userId);

  return !error;
}

export async function selectGoogleSearchConsoleProperty(
  supabase: SupabaseClient,
  userId: string,
  input: { siteUrl: string; permissionLevel: string | null }
): Promise<GoogleSearchConsoleConnectionPublic | null> {
  const { data, error } = await supabase
    .from("google_search_console_connections")
    .update({ selected_site_url: input.siteUrl, site_permission_level: input.permissionLevel })
    .eq("user_id", userId)
    .select(PUBLIC_CONNECTION_COLUMNS)
    .maybeSingle();

  if (error || !data) return null;
  return data as GoogleSearchConsoleConnectionPublic;
}

export async function replaceGoogleSearchConsoleProperties(
  supabase: SupabaseClient,
  input: {
    userId: string;
    businessProfileId: string;
    connectionId: string;
    properties: Array<{ siteUrl: string; permissionLevel: string | null }>;
  }
): Promise<void> {
  await supabase.from("google_search_console_properties").delete().eq("user_id", input.userId);

  if (input.properties.length === 0) return;

  await supabase.from("google_search_console_properties").insert(
    input.properties.map((property) => ({
      user_id: input.userId,
      business_profile_id: input.businessProfileId,
      connection_id: input.connectionId,
      site_url: property.siteUrl,
      permission_level: property.permissionLevel,
    }))
  );
}

export async function getGoogleSearchConsolePropertiesForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<GoogleSearchConsoleProperty[]> {
  const { data, error } = await supabase
    .from("google_search_console_properties")
    .select("*")
    .eq("user_id", userId)
    .order("site_url", { ascending: true });

  if (error || !data) return [];
  return data as GoogleSearchConsoleProperty[];
}

export async function updateSearchConsoleConnectionAfterSync(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  await supabase
    .from("google_search_console_connections")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("user_id", userId);
}

export async function createSearchConsoleSyncLog(
  supabase: SupabaseClient,
  input: { userId: string; businessProfileId: string; connectionId: string }
) {
  const { data, error } = await supabase
    .from("google_search_console_sync_log")
    .insert({
      user_id: input.userId,
      business_profile_id: input.businessProfileId,
      connection_id: input.connectionId,
      sync_status: "running",
    })
    .select("*")
    .single();

  if (error || !data) return null;
  return data;
}

export async function completeSearchConsoleSyncLog(
  supabase: SupabaseClient,
  syncLogId: string,
  input: {
    syncStatus: "success" | "partial" | "failed";
    queriesSynced: number;
    pagesSynced: number;
    errorMessage: string | null;
  }
) {
  const { data, error } = await supabase
    .from("google_search_console_sync_log")
    .update({
      sync_status: input.syncStatus,
      queries_synced: input.queriesSynced,
      pages_synced: input.pagesSynced,
      error_message: input.errorMessage,
      completed_at: new Date().toISOString(),
    })
    .eq("id", syncLogId)
    .select("*")
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

export async function replaceCurrentSearchConsoleMetrics(
  supabase: SupabaseClient,
  input: {
    userId: string;
    businessProfileId: string;
    connectionId: string;
    periodLabel: "current" | "previous";
    dimension: "query" | "page";
    periodStart: string;
    periodEnd: string;
    rows: Array<{ value: string; clicks: number; impressions: number; ctr: number; position: number }>;
  }
): Promise<void> {
  await supabase
    .from("google_search_console_metrics")
    .delete()
    .eq("business_profile_id", input.businessProfileId)
    .eq("dimension", input.dimension)
    .eq("period_label", input.periodLabel);

  if (input.rows.length === 0) return;

  await supabase.from("google_search_console_metrics").insert(
    input.rows.map((row) => ({
      user_id: input.userId,
      business_profile_id: input.businessProfileId,
      connection_id: input.connectionId,
      dimension: input.dimension,
      dimension_value: row.value,
      period_label: input.periodLabel,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
    }))
  );
}

export async function getSearchConsoleMetricsForBusiness(
  supabase: SupabaseClient,
  businessProfileId: string,
  dimension: "query" | "page"
): Promise<{
  current: Array<{ value: string; clicks: number; impressions: number; ctr: number; position: number | null }>;
  previous: Array<{ value: string; clicks: number; impressions: number; ctr: number; position: number | null }>;
}> {
  const { data, error } = await supabase
    .from("google_search_console_metrics")
    .select("dimension_value, period_label, clicks, impressions, ctr, position")
    .eq("business_profile_id", businessProfileId)
    .eq("dimension", dimension);

  if (error || !data) return { current: [], previous: [] };

  const rows = data as Array<{
    dimension_value: string;
    period_label: "current" | "previous";
    clicks: number;
    impressions: number;
    ctr: number;
    position: number | null;
  }>;

  return {
    current: rows
      .filter((row) => row.period_label === "current")
      .map((row) => ({ value: row.dimension_value, clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position })),
    previous: rows
      .filter((row) => row.period_label === "previous")
      .map((row) => ({ value: row.dimension_value, clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position })),
  };
}

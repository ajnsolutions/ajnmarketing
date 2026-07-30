export type SearchConsoleConnectionStatus =
  | "not_connected"
  | "connected"
  | "expired"
  | "revoked"
  | "error";

export type GoogleSearchConsoleConnectionRecord = {
  id: string;
  user_id: string;
  business_profile_id: string;
  google_account_email: string | null;
  google_account_name: string | null;
  google_account_id: string | null;
  selected_site_url: string | null;
  site_permission_level: string | null;
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  token_expires_at: string | null;
  scopes: string[] | null;
  connection_status: SearchConsoleConnectionStatus;
  last_synced_at: string | null;
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;
};

export type GoogleSearchConsoleConnectionPublic = Omit<
  GoogleSearchConsoleConnectionRecord,
  "access_token_encrypted" | "refresh_token_encrypted"
>;

export type GoogleSearchConsoleConnectionStatusResult = {
  setupRequired: boolean;
  setupMessage?: string;
  connected: boolean;
  connection: GoogleSearchConsoleConnectionPublic | null;
  /** False when stored scopes no longer cover webmasters.readonly. */
  scopesValid: boolean;
  missingScopes: string[];
  /** True once a site is selected — connected-without-a-property still can't sync. */
  propertySelected: boolean;
};

export type GoogleSearchConsoleProperty = {
  id: string;
  user_id: string;
  business_profile_id: string;
  connection_id: string;
  site_url: string;
  permission_level: string | null;
  created_at: string;
  updated_at: string;
};

export type SearchConsoleMetricDimension = "query" | "page";
export type SearchConsolePeriodLabel = "current" | "previous";

export type GoogleSearchConsoleMetricRecord = {
  id: string;
  user_id: string;
  business_profile_id: string;
  connection_id: string;
  dimension: SearchConsoleMetricDimension;
  dimension_value: string;
  period_label: SearchConsolePeriodLabel;
  period_start: string;
  period_end: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number | null;
  synced_at: string;
  created_at: string;
};

export type GoogleSearchConsoleSyncLog = {
  id: string;
  user_id: string;
  business_profile_id: string;
  connection_id: string | null;
  sync_status: "running" | "success" | "partial" | "failed";
  queries_synced: number;
  pages_synced: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
};

export type GoogleSearchConsoleSyncResult = {
  success: boolean;
  syncLog: GoogleSearchConsoleSyncLog | null;
  error?: string;
};

/** One row Google's Search Analytics API returns for a query/page dimension. */
export type SearchAnalyticsApiRow = {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

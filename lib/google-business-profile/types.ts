export type GbpConnectionStatus =
  | "not_connected"
  | "connected"
  | "expired"
  | "revoked"
  | "error";

export type GoogleBusinessProfileConnectionRecord = {
  id: string;
  user_id: string;
  business_profile_id: string;
  google_account_email: string | null;
  google_account_name: string | null;
  google_account_id: string | null;
  gbp_account_id: string | null;
  gbp_location_id: string | null;
  gbp_location_name: string | null;
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  token_expires_at: string | null;
  scopes: string[] | null;
  connection_status: GbpConnectionStatus;
  last_synced_at: string | null;
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;
};

export type GoogleBusinessProfileConnectionPublic = Omit<
  GoogleBusinessProfileConnectionRecord,
  "access_token_encrypted" | "refresh_token_encrypted"
>;

export type GoogleBusinessProfileConnectionStatus = {
  setupRequired: boolean;
  setupMessage?: string;
  connected: boolean;
  connection: GoogleBusinessProfileConnectionPublic | null;
  /** False when the connection's stored scopes no longer cover what AJN needs (e.g. business.manage was revoked). */
  scopesValid: boolean;
  missingScopes: string[];
};

export type GoogleOAuthTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type: string;
};

export type GoogleOAuthUserInfo = {
  id: string;
  email: string;
  name: string;
  picture?: string;
};

export type GoogleOAuthStatePayload = {
  userId: string;
  nonce: string;
};

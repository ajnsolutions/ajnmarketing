import "server-only";

/**
 * Google Search Console OAuth — reuses the same Google OAuth app (client id/secret/
 * redirect URI) and token endpoints as Google Business Profile (lib/google-business-profile/
 * oauth.ts): one Google Cloud OAuth client, multiple scopes. Only the requested scope
 * and the resulting API surface differ.
 */
import {
  GOOGLE_OAUTH_AUTHORIZE_URL,
  computeGoogleTokenExpiry,
  exchangeGoogleOAuthCode,
  fetchGoogleOAuthUserInfo,
} from "@/lib/google-business-profile/oauth";
import {
  inspectGoogleBusinessServerConfig,
  logGoogleBusinessServerConfig,
} from "@/lib/google-business-profile/config";
import type { GoogleOAuthTokenResponse, GoogleOAuthUserInfo } from "@/lib/google-business-profile/types";

export { GOOGLE_OAUTH_AUTHORIZE_URL, computeGoogleTokenExpiry, exchangeGoogleOAuthCode, fetchGoogleOAuthUserInfo };
export type { GoogleOAuthTokenResponse, GoogleOAuthUserInfo };

export const GOOGLE_SEARCH_CONSOLE_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/webmasters.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

/** The only scope that actually gates Search Console API access. */
export const REQUIRED_GOOGLE_SEARCH_CONSOLE_SCOPE =
  "https://www.googleapis.com/auth/webmasters.readonly";

export function findMissingRequiredSearchConsoleScopes(
  scopes: string[] | null | undefined
): string[] {
  const granted = new Set(scopes ?? []);
  return [REQUIRED_GOOGLE_SEARCH_CONSOLE_SCOPE].filter((scope) => !granted.has(scope));
}

export function hasRequiredSearchConsoleScopes(scopes: string[] | null | undefined): boolean {
  return findMissingRequiredSearchConsoleScopes(scopes).length === 0;
}

export function isGoogleSearchConsoleOAuthConfigured(): boolean {
  return inspectGoogleBusinessServerConfig().oauthConfigured;
}

export function getGoogleSearchConsoleOAuthSetupMessage(): string {
  logGoogleBusinessServerConfig("search_console_oauth_setup_check");
  return "Google OAuth is not configured on the server. Contact your workspace administrator.";
}

export function buildGoogleSearchConsoleOAuthUrl(state: string): string {
  if (!isGoogleSearchConsoleOAuthConfigured()) {
    throw new Error(getGoogleSearchConsoleOAuthSetupMessage());
  }

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
    redirect_uri: process.env.GOOGLE_REDIRECT_URI!.trim(),
    response_type: "code",
    scope: GOOGLE_SEARCH_CONSOLE_OAUTH_SCOPES.join(" "),
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state,
  });

  return `${GOOGLE_OAUTH_AUTHORIZE_URL}?${params.toString()}`;
}

export function parseSearchConsoleOAuthScopes(scope: string | undefined): string[] {
  if (!scope?.trim()) return [...GOOGLE_SEARCH_CONSOLE_OAUTH_SCOPES];
  return [...new Set(scope.split(/\s+/).filter(Boolean))];
}

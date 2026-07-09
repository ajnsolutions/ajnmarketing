import "server-only";

import {
  inspectGoogleBusinessServerConfig,
  logGoogleBusinessServerConfig,
} from "@/lib/google-business-profile/config";
import type {
  GoogleOAuthTokenResponse,
  GoogleOAuthUserInfo,
} from "@/lib/google-business-profile/types";

export const GOOGLE_OAUTH_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_OAUTH_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

export const GOOGLE_BUSINESS_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/business.manage",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

/** The only scope that actually gates Business Profile API access; identity scopes are not required for sync/publish. */
export const REQUIRED_GOOGLE_BUSINESS_SCOPE = "https://www.googleapis.com/auth/business.manage";

export function findMissingRequiredGoogleScopes(scopes: string[] | null | undefined): string[] {
  const granted = new Set(scopes ?? []);
  return [REQUIRED_GOOGLE_BUSINESS_SCOPE].filter((scope) => !granted.has(scope));
}

export function hasRequiredGoogleScopes(scopes: string[] | null | undefined): boolean {
  return findMissingRequiredGoogleScopes(scopes).length === 0;
}

export function isGoogleBusinessOAuthConfigured(): boolean {
  return inspectGoogleBusinessServerConfig().oauthConfigured;
}

export function getGoogleBusinessOAuthSetupMessage(): string {
  if (isGoogleBusinessOAuthConfigured()) {
    return "Google OAuth is not configured.";
  }

  const { oauthMissing } = inspectGoogleBusinessServerConfig();
  logGoogleBusinessServerConfig("oauth_setup_check");

  if (oauthMissing.length > 0) {
    return "Google OAuth is not configured on the server. Contact your workspace administrator.";
  }

  return "Google OAuth is not configured on the server. Contact your workspace administrator.";
}

export function buildGoogleBusinessOAuthUrl(state: string): string {
  if (!isGoogleBusinessOAuthConfigured()) {
    throw new Error(getGoogleBusinessOAuthSetupMessage());
  }

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
    redirect_uri: process.env.GOOGLE_REDIRECT_URI!.trim(),
    response_type: "code",
    scope: GOOGLE_BUSINESS_OAUTH_SCOPES.join(" "),
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state,
  });

  return `${GOOGLE_OAUTH_AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeGoogleOAuthCode(
  code: string
): Promise<GoogleOAuthTokenResponse> {
  if (!isGoogleBusinessOAuthConfigured()) {
    throw new Error(getGoogleBusinessOAuthSetupMessage());
  }

  const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
      client_secret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!.trim(),
      grant_type: "authorization_code",
    }),
  });

  const payload = (await response.json()) as GoogleOAuthTokenResponse & { error?: string };

  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error ?? "Unable to exchange Google OAuth code");
  }

  return payload;
}

export async function fetchGoogleOAuthUserInfo(
  accessToken: string
): Promise<GoogleOAuthUserInfo> {
  const response = await fetch(GOOGLE_OAUTH_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const payload = (await response.json()) as GoogleOAuthUserInfo & { error?: { message?: string } };

  if (!response.ok || !payload.id || !payload.email) {
    throw new Error(payload.error?.message ?? "Unable to load Google account profile");
  }

  return payload;
}

export function parseGoogleOAuthScopes(scope: string | undefined): string[] {
  if (!scope?.trim()) return [...GOOGLE_BUSINESS_OAUTH_SCOPES];
  return [...new Set(scope.split(/\s+/).filter(Boolean))];
}

export function computeGoogleTokenExpiry(expiresIn: number): string {
  return new Date(Date.now() + expiresIn * 1000).toISOString();
}

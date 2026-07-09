import "server-only";

/**
 * Lightweight live check of whether a Google access token still works, without touching
 * Business Profile API quota. Used to catch tokens that were revoked on Google's side
 * before their locally-computed expiry, which DB/expiry-math alone cannot detect.
 */
export const GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo";

/** How long a successful live verification is trusted before we check with Google again. */
export const GOOGLE_TOKEN_VERIFICATION_TTL_MS = 5 * 60 * 1000;

export type GoogleTokenVerificationResult =
  | { outcome: "valid"; scopes: string[] }
  | { outcome: "invalid"; reason: string }
  | { outcome: "unknown"; reason: string };

export function isVerificationStale(lastVerifiedAt: string | null | undefined): boolean {
  if (!lastVerifiedAt) return true;
  return Date.now() - new Date(lastVerifiedAt).getTime() > GOOGLE_TOKEN_VERIFICATION_TTL_MS;
}

export async function verifyGoogleAccessTokenLive(
  accessToken: string
): Promise<GoogleTokenVerificationResult> {
  try {
    const response = await fetch(
      `${GOOGLE_TOKENINFO_URL}?access_token=${encodeURIComponent(accessToken)}`
    );
    const payload = (await response.json()) as {
      scope?: string;
      error?: string;
      error_description?: string;
    };

    if (!response.ok) {
      return {
        outcome: "invalid",
        reason: payload.error_description ?? payload.error ?? "Google rejected the access token.",
      };
    }

    return {
      outcome: "valid",
      scopes: (payload.scope ?? "").split(/\s+/).filter(Boolean),
    };
  } catch (error) {
    // A failure to *reach* Google's verification endpoint (network blip, DNS, timeout) is
    // not evidence the token is bad — fail open so a transient issue on our side doesn't
    // wrongly demote a healthy connection.
    return {
      outcome: "unknown",
      reason: error instanceof Error ? error.message : "Unable to verify token with Google.",
    };
  }
}

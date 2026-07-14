/**
 * Shared guard for post-login / OAuth callback `next` redirects.
 * Only same-origin relative paths are allowed.
 */
export function safeInternalNextPath(raw: string | null | undefined, fallback = "/dashboard"): string {
  if (!raw) return fallback;
  if (
    !raw.startsWith("/") ||
    raw.startsWith("//") ||
    raw.includes("://") ||
    raw.includes("\\") ||
    raw.includes("\0") ||
    raw.includes("\t") ||
    raw.includes("\n") ||
    raw.includes("\r") ||
    raw.includes("@")
  ) {
    return fallback;
  }
  return raw;
}

/**
 * Public demo URL safety: block obvious SSRF targets before fetch.
 */

const BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^0\.0\.0\.0$/,
  /^\[::1\]$/,
  /^::1$/,
  /^metadata\.google\.internal$/i,
  /^169\.254\./,
];

export function normalizeDemoWebsiteUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    throw new Error("Website URL is required");
  }
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function assertPublicDemoUrl(rawUrl: string): string {
  const normalized = normalizeDemoWebsiteUrl(rawUrl);
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error("Enter a valid website URL (for example https://yourbusiness.com)");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Website URL must start with http:// or https://");
  }

  const host = parsed.hostname;
  if (BLOCKED_HOST_PATTERNS.some((pattern) => pattern.test(host))) {
    throw new Error("That website address can’t be analyzed in the public demo.");
  }

  return parsed.toString();
}

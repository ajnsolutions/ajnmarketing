import "server-only";

const INTERNAL_DETAIL_PATTERNS = [
  /OPENAI_API_KEY/i,
  /GOOGLE_CLIENT_SECRET/i,
  /TOKEN_ENCRYPTION_KEY/i,
  /SUPABASE_SERVICE/i,
  /service.role/i,
  /ECONNREFUSED/i,
  /ENOTFOUND/i,
];

export function sanitizeUserErrorMessage(message: string, fallback: string): string {
  const trimmed = message.trim();
  if (!trimmed) return fallback;

  if (INTERNAL_DETAIL_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return fallback;
  }

  if (/is not configured/i.test(trimmed) || /requires OPENAI/i.test(trimmed)) {
    return fallback;
  }

  return trimmed;
}

export function toSafeUserErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return sanitizeUserErrorMessage(error.message, fallback);
  }

  if (typeof error === "string") {
    return sanitizeUserErrorMessage(error, fallback);
  }

  return fallback;
}

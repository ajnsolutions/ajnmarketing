import "server-only";

const MAX_METADATA_KEYS = 12;
const MAX_METADATA_JSON_LENGTH = 2000;
const MAX_STRING_VALUE_LENGTH = 500;

/**
 * Strips an arbitrary object down into a small, bounded, JSON-safe structure suitable
 * for marketing_memory_observations.metric_summary. Only primitive values (string,
 * finite number, boolean, null) are kept — nested objects, arrays, and anything else are
 * silently dropped, never stored. This is the single enforcement point that keeps raw
 * provider payloads, OAuth tokens, error stacks, and unbounded customer content out of
 * memory storage: every ingestion path must route metadata through this function before
 * persisting it. Returns {} for non-object input or if the sanitized result is still too
 * large (fail-safe: drop rather than truncate mid-structure).
 */
export function sanitizeMetricSummary(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};

  const result: Record<string, unknown> = {};
  let count = 0;

  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (count >= MAX_METADATA_KEYS) break;

    if (value === null) {
      result[key] = null;
    } else if (typeof value === "number" && Number.isFinite(value)) {
      result[key] = value;
    } else if (typeof value === "boolean") {
      result[key] = value;
    } else if (typeof value === "string") {
      result[key] = value.slice(0, MAX_STRING_VALUE_LENGTH);
    } else {
      continue;
    }

    count += 1;
  }

  if (JSON.stringify(result).length > MAX_METADATA_JSON_LENGTH) {
    return {};
  }

  return result;
}

/**
 * Safe, non-sensitive error classification for logging — never the raw error message or
 * stack, which could contain provider payload fragments or other sensitive detail. Only
 * the error's constructor name (e.g. "TypeError", "SupabaseError") is surfaced.
 */
export function classifyError(error: unknown): string {
  if (error instanceof Error) return error.name || "Error";
  return "UnknownError";
}

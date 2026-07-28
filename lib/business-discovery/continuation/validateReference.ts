/**
 * Snapshot reference format validation — pure, synchronous, no I/O.
 *
 * Every reference lib/business-discovery/public/cache.ts issues is exactly
 * `randomBytes(24).toString("hex")` — 48 lowercase hex characters. Anything
 * else is rejected before ever touching the reference store, both as a fast
 * path and so a malformed/oversized string can never be used to probe the
 * store's behavior.
 */

const REFERENCE_PATTERN = /^[a-f0-9]{48}$/;
const MAX_REFERENCE_INPUT_LENGTH = 256; // generous upper bound before even running the regex

export function isValidSnapshotReferenceFormat(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.length === 0 || value.length > MAX_REFERENCE_INPUT_LENGTH) return false;
  return REFERENCE_PATTERN.test(value);
}

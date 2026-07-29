/**
 * Public snapshot request validation — the input contract from
 * lib/business-discovery/public/types.ts, enforced strictly and honestly.
 *
 * Rejects unsupported fields outright (never silently ignores them — a
 * client sending unexpected fields gets a clear error, not silent data loss,
 * per this milestone's "clear validation errors without leaking internals"
 * requirement) and caps every field length before any of it reaches a
 * network call or an AI prompt.
 */

import {
  PUBLIC_SNAPSHOT_CONTRACT_VERSION,
  PUBLIC_SNAPSHOT_FIELD_LIMITS,
  PUBLIC_SNAPSHOT_REQUEST_KEYS,
  type PublicSnapshotRequestV1,
} from "@/lib/business-discovery/public/types";

export class PublicSnapshotValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublicSnapshotValidationError";
  }
}

function validateOptionalStringField(
  value: unknown,
  field: keyof typeof PUBLIC_SNAPSHOT_FIELD_LIMITS,
  label: string
): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw new PublicSnapshotValidationError(`${label} must be text.`);
  }
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > PUBLIC_SNAPSHOT_FIELD_LIMITS[field]) {
    throw new PublicSnapshotValidationError(`${label} is too long.`);
  }
  return trimmed;
}

/**
 * Validates a raw, already-JSON-parsed request body against the public
 * snapshot contract. Does not touch the network — pure validation only, so
 * it's fully unit-testable.
 */
export function validatePublicSnapshotRequest(body: unknown): PublicSnapshotRequestV1 {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new PublicSnapshotValidationError("Invalid request body.");
  }

  const record = body as Record<string, unknown>;
  const unsupportedKeys = Object.keys(record).filter(
    (key) => !PUBLIC_SNAPSHOT_REQUEST_KEYS.includes(key as (typeof PUBLIC_SNAPSHOT_REQUEST_KEYS)[number])
  );
  if (unsupportedKeys.length > 0) {
    throw new PublicSnapshotValidationError("Request includes unsupported fields.");
  }

  if (
    record.contractVersion !== undefined &&
    record.contractVersion !== PUBLIC_SNAPSHOT_CONTRACT_VERSION
  ) {
    throw new PublicSnapshotValidationError("Unsupported request contract version.");
  }

  if (typeof record.websiteUrl !== "string" || !record.websiteUrl.trim()) {
    throw new PublicSnapshotValidationError("A website URL is required.");
  }
  const websiteUrl = record.websiteUrl.trim();
  if (websiteUrl.length > PUBLIC_SNAPSHOT_FIELD_LIMITS.websiteUrl) {
    throw new PublicSnapshotValidationError("That website URL is too long.");
  }

  const businessName = validateOptionalStringField(record.businessName, "businessName", "Business name");
  const city = validateOptionalStringField(record.city, "city", "City");
  const stateOrRegion = validateOptionalStringField(record.stateOrRegion, "stateOrRegion", "State or region");
  const country = validateOptionalStringField(record.country, "country", "Country");

  return {
    contractVersion: PUBLIC_SNAPSHOT_CONTRACT_VERSION,
    websiteUrl,
    ...(businessName ? { businessName } : {}),
    ...(city ? { city } : {}),
    ...(stateOrRegion ? { stateOrRegion } : {}),
    ...(country ? { country } : {}),
  };
}

import "server-only";

import type { MarketingMemorySourceEntityType } from "@/lib/marketing-memory/types";

/**
 * Deterministic, server-computed idempotency keys — never client-supplied. Mirrors the
 * exact convention already established in lib/recommendation-outcomes/idempotency.ts:
 * the database's unique constraint is the sole source of truth for "has this happened
 * before," so these builders only need to be deterministic, not check for existence.
 */

export function buildObservationIdempotencyKey(
  businessProfileId: string,
  sourceType:
    | "recommendation_outcome_event"
    | "analytics_snapshot"
    | "campaign"
    | "experiment",
  sourceId: string
): string {
  return `obs:${businessProfileId}:${sourceType}:${sourceId}`;
}

export function buildContextSnapshotIdempotencyKey(businessProfileId: string, utcDateKeyValue: string): string {
  return `ctx:${businessProfileId}:${utcDateKeyValue}`;
}

export function buildEvidenceLinkIdempotencyKey(
  observationId: string,
  sourceType: MarketingMemorySourceEntityType,
  sourceId: string
): string {
  return `${observationId}:${sourceType}:${sourceId}`;
}

/** UTC calendar-date key (YYYY-MM-DD) — one context snapshot is reused per business per
 * UTC day, regardless of how many observations occur that day. */
export function utcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

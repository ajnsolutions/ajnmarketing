/**
 * Confirmation decision store — in-memory, TTL-bound, keyed by the
 * snapshot's cache key (same key space as claimStore.ts). Stores the
 * server-derived ConfirmationRecord for each insight key a user has decided
 * on, so a resubmission of the same key is an overwrite (idempotent, last
 * decision wins) rather than an ever-growing history.
 *
 * TTL: 24 hours, matching claimStore.ts — a decision record is meaningless
 * once its claim has expired, so the two lifetimes are intentionally equal.
 * Submitting any decision refreshes the TTL, so an onboarding session that's
 * actively being worked through doesn't expire mid-review.
 */

import type { ConfirmationRecord } from "@/lib/business-discovery/continuation/types";

const CONFIRMATION_TTL_MS = 24 * 60 * 60 * 1000;

type ConfirmationStoreEntry = {
  records: Map<string, ConfirmationRecord>;
  expiresAt: number;
};

const store = new Map<string, ConfirmationStoreEntry>();

export function recordConfirmationDecisions(
  cacheKey: string,
  records: ConfirmationRecord[],
  ttlMs = CONFIRMATION_TTL_MS
): void {
  const now = Date.now();
  let entry = store.get(cacheKey);
  if (!entry || entry.expiresAt < now) {
    entry = { records: new Map(), expiresAt: now + ttlMs };
    store.set(cacheKey, entry);
  } else {
    entry.expiresAt = now + ttlMs;
  }
  for (const record of records) {
    entry.records.set(record.insightKey, record);
  }
}

export function getConfirmationDecisions(cacheKey: string): ConfirmationRecord[] {
  const entry = store.get(cacheKey);
  if (!entry || entry.expiresAt < Date.now()) return [];
  return Array.from(entry.records.values());
}

/** Test/ops helper — clears the store. */
export function resetConfirmationStore(): void {
  store.clear();
}

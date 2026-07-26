/**
 * Public snapshot cache and conversion-handoff reference store.
 *
 * Deliberately mirrors lib/interactive-demo/cache.ts's shape and caveats
 * (single-node / warm-instance in-memory cache — not a distributed cache;
 * acceptable for this foundation, revisit if/when this runs across many
 * serverless instances). Kept as its own module rather than importing the
 * demo cache directly so authenticated, demo, and public-snapshot data never
 * share a Map — a coding mistake in one can't leak into another.
 *
 * TTL: 15 minutes, matching the existing interactive-demo cache default. A
 * marketing website's content and an AI read of it are not time-sensitive
 * enough to need a shorter window, and 15 minutes comfortably covers a
 * visitor re-checking the Snapshot page or a flaky first request retrying.
 *
 * Cache key: sha256(normalized website URL) — the same low-sensitivity,
 * one-way hash the existing demo cache already uses. Keying by URL alone
 * (not URL + visitor-supplied businessName/city/etc.) is an intentional,
 * documented trade-off: within the 15-minute window, a second visitor
 * scanning the *same* URL with different optional hints gets the first
 * visitor's cached result. The website itself, not the visitor's hints, is
 * the primary signal, so this is judged an acceptable simplicity/cost
 * trade-off for this foundation — see docs/BUSINESS_DISCOVERY_PUBLIC_SNAPSHOT.md.
 *
 * Snapshot reference: a *separate*, randomly generated, unguessable token —
 * never derived from the URL — so a reference can't be predicted for a
 * well-known public URL and used to "claim" someone else's in-flight
 * snapshot during a future signup handoff. It is opaque and carries no
 * database identifier of any kind, because none is created for an anonymous
 * scan (see the Privacy and retention section of the same doc).
 */

import { createHash, randomBytes } from "node:crypto";
import type { PublicBusinessDiscoveryResultV1 } from "@/lib/business-discovery/public/types";

const CACHE_TTL_MS = 15 * 60 * 1000;
const REFERENCE_TTL_MS = 30 * 60 * 1000; // slightly longer than the cache TTL so a reference can report "expired" distinctly from a plain cache miss

type CacheEntry = {
  expiresAt: number;
  value: PublicBusinessDiscoveryResultV1;
};

type ReferenceEntry = {
  expiresAt: number;
  cacheKey: string;
};

const resultCache = new Map<string, CacheEntry>();
const referenceStore = new Map<string, ReferenceEntry>();

export function publicSnapshotCacheKey(normalizedWebsiteUrl: string): string {
  return createHash("sha256").update(normalizedWebsiteUrl.trim().toLowerCase()).digest("hex");
}

export function getCachedPublicSnapshot(normalizedWebsiteUrl: string): PublicBusinessDiscoveryResultV1 | null {
  const key = publicSnapshotCacheKey(normalizedWebsiteUrl);
  const entry = resultCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    resultCache.delete(key);
    return null;
  }
  return entry.value;
}

export function setCachedPublicSnapshot(
  normalizedWebsiteUrl: string,
  value: PublicBusinessDiscoveryResultV1,
  ttlMs = CACHE_TTL_MS
): void {
  resultCache.set(publicSnapshotCacheKey(normalizedWebsiteUrl), { expiresAt: Date.now() + ttlMs, value });
}

/** Issues a fresh, unguessable, time-limited reference for the future conversion handoff. Never derived from the URL. */
export function issuePublicSnapshotReference(
  normalizedWebsiteUrl: string,
  ttlMs = REFERENCE_TTL_MS
): string {
  const reference = randomBytes(24).toString("hex");
  referenceStore.set(reference, {
    expiresAt: Date.now() + ttlMs,
    cacheKey: publicSnapshotCacheKey(normalizedWebsiteUrl),
  });
  return reference;
}

/** Resolves a reference back to its cache key, or null if unknown/expired. Fails safe — never throws. */
export function resolvePublicSnapshotReference(reference: string): string | null {
  const entry = referenceStore.get(reference);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    referenceStore.delete(reference);
    return null;
  }
  return entry.cacheKey;
}

/** Test/ops helper — clears both stores. */
export function resetPublicSnapshotCache(): void {
  resultCache.clear();
  referenceStore.clear();
}

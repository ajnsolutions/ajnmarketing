/**
 * Snapshot claim store — in-memory, TTL-bound, keyed by the snapshot's cache
 * key (never the raw reference, never a raw database identifier — see
 * lib/business-discovery/public/cache.ts's ReferenceResolution).
 *
 * Same instance-local-only caveat as the rest of this feature (see
 * lib/business-discovery/public/cache.ts's header comment and Part 8 of
 * docs/BUSINESS_DISCOVERY_CONTINUATION.md's Shared-store readiness section).
 *
 * Claim TTL: 24 hours — deliberately longer than the reference TTL (30
 * minutes) or the snapshot cache TTL (15 minutes), because a claim's purpose
 * outlives the underlying anonymous cache entry: once claimed, the visitor is
 * now an authenticated user who may take a while to work through onboarding
 * and the insight-confirmation review before finishing. The claim itself
 * carries no page content and no AI output — only "user X claimed this
 * snapshot at time Y" — so a longer TTL for it alone is cheap and low-risk.
 */

const CLAIM_TTL_MS = 24 * 60 * 60 * 1000;

type ClaimEntry = {
  userId: string;
  claimedAt: number;
  expiresAt: number;
};

const claims = new Map<string, ClaimEntry>();

export type ClaimAttemptResult =
  | { status: "claimed"; claimedAt: string }
  | { status: "already_claimed_by_you"; claimedAt: string }
  | { status: "claimed_by_another_user" };

/**
 * Idempotent claim: the same user retrying always succeeds (returning the
 * original claim time); a different user is rejected with a conflict. Never
 * throws.
 */
export function claimSnapshotCacheKey(cacheKey: string, userId: string, ttlMs = CLAIM_TTL_MS): ClaimAttemptResult {
  const now = Date.now();
  const existing = claims.get(cacheKey);

  if (existing && existing.expiresAt > now) {
    if (existing.userId === userId) {
      return { status: "already_claimed_by_you", claimedAt: new Date(existing.claimedAt).toISOString() };
    }
    return { status: "claimed_by_another_user" };
  }

  claims.set(cacheKey, { userId, claimedAt: now, expiresAt: now + ttlMs });
  return { status: "claimed", claimedAt: new Date(now).toISOString() };
}

/** Returns the claiming userId, or null if never claimed or the claim has expired. Never throws. */
export function getSnapshotClaimOwner(cacheKey: string): string | null {
  const existing = claims.get(cacheKey);
  if (!existing) return null;
  if (existing.expiresAt < Date.now()) {
    claims.delete(cacheKey);
    return null;
  }
  return existing.userId;
}

/** Test/ops helper — clears the store. */
export function resetSnapshotClaimStore(): void {
  claims.clear();
}

import "server-only";

/**
 * Snapshot continuation — orchestration service. The secure bridge between
 * the anonymous Free Marketing Snapshot (PR #74) and authenticated Guided
 * Onboarding.
 *
 * Every function here takes an explicit `userId` (already authenticated by
 * the caller — the API routes in app/api/business-discovery/continuation/)
 * rather than resolving its own session, mirroring the established
 * `*ForUserId` convention (lib/business-profile-server.ts). This keeps
 * authentication itself entirely at the route boundary — nothing in here
 * can accidentally run unauthenticated.
 *
 * Nothing in this file ever accepts a URL, a raw cache key, or a database
 * identifier from a caller — only the opaque snapshotReference the visitor
 * already holds. See lib/business-discovery/continuation/types.ts for the
 * full contract.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { updateBusinessProfileFieldsForUserId } from "@/lib/business-profile-server";
import { getCachedPublicSnapshotByKey, resolvePublicSnapshotReferenceDetailed } from "@/lib/business-discovery/public/cache";
import { isValidSnapshotReferenceFormat } from "@/lib/business-discovery/continuation/validateReference";
import { claimSnapshotCacheKey, getSnapshotClaimOwner } from "@/lib/business-discovery/continuation/claimStore";
import { applyConfirmationDecisions, buildBusinessProfileFieldsFromConfirmations } from "@/lib/business-discovery/continuation/applyConfirmations";
import { getConfirmationDecisions, recordConfirmationDecisions } from "@/lib/business-discovery/continuation/confirmationStore";
import { hashReferenceForLogging, trackContinuationEvent } from "@/lib/business-discovery/continuation/observability";
import { INSIGHT_KEY_ALLOWLIST, type ConfirmationDecisionInput, type OnboardingSnapshotPrefill, type SnapshotClaimResult, type SnapshotResolutionResult, type SubmitConfirmationsResult } from "@/lib/business-discovery/continuation/types";

const MAX_DECISIONS_PER_SUBMISSION = INSIGHT_KEY_ALLOWLIST.size;

/**
 * Resolves a snapshotReference into its public-safe content, for the
 * currently authenticated user. Read-only — does not bind ownership (see
 * claimSnapshotForUser for that). Safe to call repeatedly.
 */
export function resolveSnapshotForUser(userId: string, rawReference: unknown): SnapshotResolutionResult {
  trackContinuationEvent("continuation_requested", { userId });

  if (!isValidSnapshotReferenceFormat(rawReference)) {
    trackContinuationEvent("invalid_reference", { userId });
    return { status: "invalid" };
  }

  const referenceHash = hashReferenceForLogging(rawReference);
  const resolution = resolvePublicSnapshotReferenceDetailed(rawReference);

  if (resolution.status === "unknown") {
    trackContinuationEvent("invalid_reference", { userId, referenceHash });
    return { status: "not_found" };
  }
  if (resolution.status === "expired") {
    trackContinuationEvent("expired_reference", { userId, referenceHash });
    return { status: "expired" };
  }

  const snapshot = getCachedPublicSnapshotByKey(resolution.cacheKey);
  if (!snapshot) {
    // The reference was valid but the underlying cached result already
    // expired/evicted independently — an honest "expired" from the caller's
    // point of view, not a bug.
    trackContinuationEvent("expired_reference", { userId, referenceHash });
    return { status: "expired" };
  }

  trackContinuationEvent("reference_resolved", { userId, referenceHash });
  return { status: "resolved", snapshot };
}

/**
 * Binds a valid snapshotReference to the authenticated user. Idempotent for
 * the same user; rejected as a conflict for a different user. Does not
 * create any account, tenant, or business row — it only records
 * "userId claimed this reference at time T" in memory.
 */
export function claimSnapshotForUser(userId: string, rawReference: unknown): SnapshotClaimResult {
  if (!isValidSnapshotReferenceFormat(rawReference)) return { status: "invalid" };

  const referenceHash = hashReferenceForLogging(rawReference);
  const resolution = resolvePublicSnapshotReferenceDetailed(rawReference);

  if (resolution.status === "unknown") return { status: "not_found" };
  if (resolution.status === "expired") return { status: "expired" };

  const snapshot = getCachedPublicSnapshotByKey(resolution.cacheKey);
  if (!snapshot) return { status: "expired" };

  const result = claimSnapshotCacheKey(resolution.cacheKey, userId);
  if (result.status === "claimed_by_another_user") {
    trackContinuationEvent("claim_conflict", { userId, referenceHash });
  } else {
    trackContinuationEvent("claim_succeeded", { userId, referenceHash });
  }
  return result;
}

/**
 * Submits confirm/correct/reject/review_later decisions for a batch of
 * insights. Requires the reference to already be claimed by this exact user
 * (call claimSnapshotForUser first). Applies the one insight that has a
 * durable existing home (primaryServices -> business_profiles) and returns
 * every decision's resulting record regardless.
 */
export async function submitConfirmationsForUser(
  supabase: SupabaseClient,
  userId: string,
  rawReference: unknown,
  decisions: ConfirmationDecisionInput[]
): Promise<SubmitConfirmationsResult> {
  if (!isValidSnapshotReferenceFormat(rawReference)) return { status: "invalid" };
  if (!Array.isArray(decisions) || decisions.length === 0 || decisions.length > MAX_DECISIONS_PER_SUBMISSION) {
    return { status: "invalid_decisions", errors: ["Submit between 1 and " + MAX_DECISIONS_PER_SUBMISSION + " decisions."] };
  }

  const referenceHash = hashReferenceForLogging(rawReference);
  const resolution = resolvePublicSnapshotReferenceDetailed(rawReference);
  if (resolution.status === "unknown") return { status: "not_found" };
  if (resolution.status === "expired") return { status: "expired" };

  const snapshot = getCachedPublicSnapshotByKey(resolution.cacheKey);
  if (!snapshot) return { status: "expired" };

  const claimOwner = getSnapshotClaimOwner(resolution.cacheKey);
  if (!claimOwner) return { status: "not_claimed" };
  if (claimOwner !== userId) return { status: "claimed_by_another_user" };

  const { records, errors } = applyConfirmationDecisions(snapshot, decisions, userId, new Date().toISOString());
  if (records.length === 0 && errors.length > 0) {
    return { status: "invalid_decisions", errors };
  }

  recordConfirmationDecisions(resolution.cacheKey, records);

  const businessProfileFields = buildBusinessProfileFieldsFromConfirmations(records);
  if (Object.keys(businessProfileFields).length > 0) {
    await updateBusinessProfileFieldsForUserId(supabase, userId, businessProfileFields);
  }

  trackContinuationEvent("confirmation_submitted", { userId, referenceHash });
  return { status: "applied", records };
}

/** Every decision previously recorded for this user's claimed reference — lets a future UI re-render "what did I already decide" without resubmitting. */
export function getConfirmationsForUser(userId: string, rawReference: unknown) {
  if (!isValidSnapshotReferenceFormat(rawReference)) return [];
  const resolution = resolvePublicSnapshotReferenceDetailed(rawReference);
  if (resolution.status !== "valid") return [];
  if (getSnapshotClaimOwner(resolution.cacheKey) !== userId) return [];
  return getConfirmationDecisions(resolution.cacheKey);
}

/**
 * Maps a resolved public snapshot onto the *subset* of OnboardingData the
 * wizard already asks about, for prefill only — never a substitute for the
 * explicit per-insight confirmation flow above. See
 * lib/business-discovery/continuation/onboardingPrefill.ts's header for the
 * full reasoning on why this stays deliberately narrow.
 */
export { buildOnboardingPrefillFromSnapshot } from "@/lib/business-discovery/continuation/onboardingPrefill";
export type { OnboardingSnapshotPrefill };

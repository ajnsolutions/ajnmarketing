/**
 * Deterministic input fingerprint for decision snapshots. Two snapshot attempts with
 * identical decision-relevant inputs always produce the same fingerprint (idempotent —
 * the unique constraint on (business_profile_id, input_fingerprint) then makes the
 * second attempt a safe no-op); any real change to the inputs always changes it.
 *
 * Node's built-in crypto — no new dependency.
 */

import { createHash } from "node:crypto";
import type { MarketingDirectorDecision } from "@/lib/marketing-director/types";

export function computeDecisionInputFingerprint(decision: MarketingDirectorDecision): string {
  // Only the fields that determine what a snapshot records — never a raw prompt, never
  // chain-of-thought, never an unrestricted object dump.
  const basis = {
    decisionType: decision.decisionType,
    title: decision.title,
    summary: decision.summary,
    requiresCustomerAction: decision.requiresCustomerAction,
    primaryActionKind: decision.primaryAction.kind,
    sourceRecommendationId: decision.sourceRecommendationId,
    presentationPriority: decision.presentationPriority,
    deferred: decision.deferred.map((entry) => `${entry.sourceId}:${entry.reason}`).sort(),
    appliedPreferenceIds: [...(decision.memoryContext?.appliedPreferenceIds ?? [])].sort(),
    consideredLearningIds: [...(decision.memoryContext?.consideredLearningIds ?? [])].sort(),
    ignoredLearningIds: [...(decision.memoryContext?.ignoredLearnings ?? [])]
      .map((entry) => entry.id)
      .sort(),
    ignoredPreferenceIds: [...(decision.memoryContext?.ignoredPreferences ?? [])]
      .map((entry) => entry.id)
      .sort(),
    wasColdStart: decision.memoryContext ? false : true,
  };

  return createHash("sha256").update(JSON.stringify(basis)).digest("hex");
}

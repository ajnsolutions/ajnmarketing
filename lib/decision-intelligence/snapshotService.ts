/**
 * Records a durable snapshot of an already-computed Marketing Director decision.
 *
 * Called inline as a byproduct of the tenant's own Head of Marketing page load (session-
 * scoped client, same as marketing_memory_observations elsewhere) — never redecides
 * anything. Best-effort: a failure here must never break the HoM page render, matching
 * the established Marketing Memory observation-write pattern.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { computeDecisionInputFingerprint } from "@/lib/decision-intelligence/fingerprint";
import {
  getLatestActiveDecisionSnapshot,
  recordDecisionSnapshot,
  supersedeDecisionSnapshot,
  type DecisionSnapshotDraft,
} from "@/lib/decision-intelligence/persistence";
import type { IgnoredEvidenceEntry, MarketingDirectorDecisionSnapshot } from "@/lib/decision-intelligence/types";

const MAX_IGNORED_EVIDENCE_ENTRIES = 10;

function boundedIgnoredEvidence(decision: MarketingDirectorDecision): IgnoredEvidenceEntry[] {
  const ctx = decision.memoryContext;
  if (!ctx) return [];
  const learnings: IgnoredEvidenceEntry[] = ctx.ignoredLearnings.map((entry) => ({
    id: entry.id,
    evidenceType: "learning",
    reason: entry.reason,
  }));
  const preferences: IgnoredEvidenceEntry[] = ctx.ignoredPreferences.map((entry) => ({
    id: entry.id,
    evidenceType: "preference",
    reason: entry.reason,
  }));
  return [...learnings, ...preferences].slice(0, MAX_IGNORED_EVIDENCE_ENTRIES);
}
import type { MarketingDirectorDecision } from "@/lib/marketing-director/types";
import type { HeadOfMarketingPrimaryActionKind } from "@/lib/head-of-marketing/types";

export type RecordDecisionSnapshotResult = {
  recorded: boolean;
  snapshot: MarketingDirectorDecisionSnapshot | null;
};

/**
 * Bounded to customer-safe, normalized decision facts only — see
 * fingerprint.ts's basis object for the exact same field set kept in sync.
 */
function draftFromDecision(
  decision: MarketingDirectorDecision,
  supersedesDecisionId: string | null,
): DecisionSnapshotDraft {
  return {
    decision_type: decision.decisionType,
    title: decision.title,
    customer_summary: decision.summary,
    priority_rank: decision.presentationPriority,
    action_type: decision.primaryAction.kind as HeadOfMarketingPrimaryActionKind,
    source_recommendation_id: decision.sourceRecommendationId,
    source_campaign_id: null,
    consulted_learning_ids: decision.memoryContext?.consideredLearningIds ?? [],
    consulted_preference_ids: decision.memoryContext?.appliedPreferenceIds ?? [],
    ignored_evidence: boundedIgnoredEvidence(decision),
    was_cold_start: decision.memoryContext === null,
    input_fingerprint: computeDecisionInputFingerprint(decision),
    evaluated_at: decision.evaluatedAt,
    supersedes_decision_id: supersedesDecisionId,
  };
}

export async function recordDecisionSnapshotForCurrentUser(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
  decision: MarketingDirectorDecision,
): Promise<RecordDecisionSnapshotResult> {
  try {
    const previousActive = await getLatestActiveDecisionSnapshot(supabase, userId, businessProfileId);
    const draft = draftFromDecision(decision, previousActive?.id ?? null);

    if (previousActive && previousActive.input_fingerprint === draft.input_fingerprint) {
      // Identical decision run — idempotent no-op, matches the existing active snapshot.
      return { recorded: false, snapshot: previousActive };
    }

    const { snapshot, error } = await recordDecisionSnapshot(supabase, userId, businessProfileId, draft);
    if (!snapshot) {
      console.warn("[DecisionIntelligence] snapshot insert failed", {
        businessProfileId,
        error: error?.message,
      });
      return { recorded: false, snapshot: null };
    }

    if (previousActive && previousActive.id !== snapshot.id) {
      await supersedeDecisionSnapshot(supabase, userId, previousActive.id);
    }

    return { recorded: true, snapshot };
  } catch (err) {
    console.warn("[DecisionIntelligence] snapshot recording threw", {
      businessProfileId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { recorded: false, snapshot: null };
  }
}

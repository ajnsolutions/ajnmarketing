import "server-only";

/**
 * Opportunity Detection Engine — single entrypoint other subsystems call.
 *
 * Reconciliation is on-demand (called from a request path, e.g. the
 * dashboard page), never a scheduled cron — matching this repo's existing
 * rule that ATTACH_DECLARATIVE_PRODUCTION_CRONS stays false. Safe to call on
 * every page load: detection is deterministic, and reconciliation only ever
 * creates/updates/retires rows that genuinely changed this run.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { detectOpportunityCandidates, type OpportunityDetectionInput } from "@/lib/opportunity-engine/detect";
import { mergeOpportunityCandidates, evidenceContributingProviders } from "@/lib/opportunity-engine/dedupe";
import { scoreOpportunity } from "@/lib/opportunity-engine/score";
import { planOpportunityReconciliation, type ScoredCandidate } from "@/lib/opportunity-engine/reconcile";
import {
  getActiveOpportunitiesForUser,
  getRetiredOpportunitiesForUser,
  insertOpportunity,
  refreshOpportunity,
  retireOpportunity,
} from "@/lib/opportunity-engine/persistence";
import type { BusinessPattern } from "@/lib/business-learning-engine/types";
import type { DetectedOpportunity } from "@/lib/opportunity-engine/types";
import { OpportunityStatuses } from "@/lib/opportunity-engine/types";

export type OpportunityEngineInput = OpportunityDetectionInput & {
  userId: string;
  businessProfileId: string;
  now?: Date;
};

export type OpportunityReconciliationResult = {
  /** All currently active opportunities, highest score first. */
  opportunities: DetectedOpportunity[];
  /** Opportunities created this run — new evidence the engine hadn't seen before. */
  newlyDetected: DetectedOpportunity[];
  /** Opportunities retired this run because the Learning Engine observed real success. */
  justCompleted: DetectedOpportunity[];
  /** Opportunities retired this run because their evidence didn't recur. */
  justExpired: DetectedOpportunity[];
};

export async function reconcileAndGetOpportunities(
  supabase: SupabaseClient,
  input: OpportunityEngineInput,
): Promise<OpportunityReconciliationResult> {
  const now = input.now ?? new Date();
  const learningPatterns: BusinessPattern[] = input.learningPatterns ?? [];

  const existingActive = await getActiveOpportunitiesForUser(supabase, input.userId, input.businessProfileId);

  const candidates = detectOpportunityCandidates(input);
  const merged = mergeOpportunityCandidates(candidates);
  const scoredCandidates: ScoredCandidate[] = merged.map((candidate) => ({
    merged: candidate,
    score: scoreOpportunity({
      evidence: candidate.evidence,
      businessImpact: candidate.businessImpact,
      urgency: candidate.urgency,
      confidence: candidate.confidence,
      relatedActionType: candidate.relatedActionType,
      patterns: learningPatterns,
      now,
    }),
  }));

  const plan = planOpportunityReconciliation({ existingActive, scoredCandidates, learningPatterns, now });

  const nowIso = now.toISOString();

  const created = await Promise.all(
    plan.toCreate.map((scored) =>
      insertOpportunity(supabase, input.userId, input.businessProfileId, {
        type: scored.merged.type,
        topic: scored.merged.topic,
        statement: scored.merged.statement,
        whyNow: scored.merged.whyNow,
        expectedOutcome: scored.merged.expectedOutcome,
        evidence: scored.merged.evidence,
        contributingProviders: evidenceContributingProviders(scored.merged.evidence),
        confidence: scored.merged.confidence,
        score: scored.score,
        status: OpportunityStatuses.ACTIVE,
        relatedActionType: scored.merged.relatedActionType,
        firstDetectedAt: nowIso,
        lastSeenAt: nowIso,
        retiredAt: null,
        retiredReason: null,
      }),
    ),
  );

  await Promise.all(
    plan.toUpdate.map(({ existing, scored }) =>
      refreshOpportunity(supabase, existing.id, {
        ...existing,
        statement: scored.merged.statement,
        whyNow: scored.merged.whyNow,
        expectedOutcome: scored.merged.expectedOutcome,
        evidence: scored.merged.evidence,
        contributingProviders: evidenceContributingProviders(scored.merged.evidence),
        confidence: scored.merged.confidence,
        score: scored.score,
        lastSeenAt: nowIso,
      }),
    ),
  );

  await Promise.all([
    ...plan.toComplete.map((opportunity) => retireOpportunity(supabase, opportunity.id, "completed", now)),
    ...plan.toExpire.map((opportunity) => retireOpportunity(supabase, opportunity.id, "expired", now)),
  ]);

  const hasChanges =
    plan.toCreate.length > 0 || plan.toUpdate.length > 0 || plan.toComplete.length > 0 || plan.toExpire.length > 0;

  const opportunities = hasChanges
    ? await getActiveOpportunitiesForUser(supabase, input.userId, input.businessProfileId)
    : plan.unchanged;

  return {
    opportunities,
    newlyDetected: created.filter((row): row is DetectedOpportunity => row !== null),
    justCompleted: plan.toComplete.map((opportunity) => ({
      ...opportunity,
      status: OpportunityStatuses.COMPLETED,
      retiredAt: nowIso,
      retiredReason: "completed",
    })),
    justExpired: plan.toExpire.map((opportunity) => ({
      ...opportunity,
      status: OpportunityStatuses.EXPIRED,
      retiredAt: nowIso,
      retiredReason: "expired",
    })),
  };
}

export { getRetiredOpportunitiesForUser };
export type { DetectedOpportunity } from "@/lib/opportunity-engine/types";

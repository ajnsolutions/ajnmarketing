/**
 * Lifecycle reconciliation (Part 4) — pure logic deciding, for a batch of
 * freshly detected/scored/deduplicated candidates against the opportunities
 * already persisted for a business, what to create, update, complete, or
 * expire. No I/O; the caller (service.ts) writes the result. Mirrors the
 * Business Learning Engine's planReinforcement (reinforce.ts) — same
 * create-vs-reinforce shape, applied to opportunities instead of patterns.
 */

import { topicOverlap, TOPIC_MERGE_THRESHOLD } from "@/lib/business-knowledge-graph/topicMatch";
import { findPatternForActionType } from "@/lib/business-learning-engine/service";
import type { BusinessPattern } from "@/lib/business-learning-engine/types";
import type { MergedOpportunityCandidate } from "@/lib/opportunity-engine/dedupe";
import type { OpportunityScore } from "@/lib/opportunity-engine/types";
import type { DetectedOpportunity } from "@/lib/opportunity-engine/types";

/** An active opportunity not re-detected for this many days is considered no
 * longer relevant and retired — long enough to survive a single evidence
 * lull, short enough that stale opportunities don't linger indefinitely. */
export const EXPIRE_AFTER_DAYS = 14;

export type ScoredCandidate = {
  merged: MergedOpportunityCandidate;
  score: OpportunityScore;
};

export type OpportunityReconciliationPlan = {
  toCreate: ScoredCandidate[];
  toUpdate: Array<{ existing: DetectedOpportunity; scored: ScoredCandidate }>;
  toComplete: DetectedOpportunity[];
  toExpire: DetectedOpportunity[];
  /** Still active, still undetected this run, but within the grace window —
   * left untouched. */
  unchanged: DetectedOpportunity[];
};

function matches(existing: DetectedOpportunity, candidate: MergedOpportunityCandidate): boolean {
  return existing.type === candidate.type && topicOverlap(existing.topic, candidate.topic) >= TOPIC_MERGE_THRESHOLD;
}

function daysSince(iso: string, now: Date): number {
  return Math.max(0, (now.getTime() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

/** An opportunity is "completed" when the Learning Engine has independently
 * observed real, reinforced success for its related action type — reusing
 * that signal rather than inventing a second definition of "done." */
function hasCompletedViaLearning(opportunity: DetectedOpportunity, patterns: BusinessPattern[]): boolean {
  if (!opportunity.relatedActionType) return false;
  const pattern = findPatternForActionType(patterns, opportunity.relatedActionType);
  return Boolean(pattern && pattern.direction === "positive" && pattern.reinforcementCount >= 2);
}

export function planOpportunityReconciliation(input: {
  existingActive: DetectedOpportunity[];
  scoredCandidates: ScoredCandidate[];
  learningPatterns: BusinessPattern[];
  now?: Date;
}): OpportunityReconciliationPlan {
  const now = input.now ?? new Date();
  const matchedExistingIds = new Set<string>();

  const toCreate: ScoredCandidate[] = [];
  const toUpdate: OpportunityReconciliationPlan["toUpdate"] = [];

  for (const scored of input.scoredCandidates) {
    const existing = input.existingActive.find((opportunity) => matches(opportunity, scored.merged));
    if (existing) {
      matchedExistingIds.add(existing.id);
      toUpdate.push({ existing, scored });
    } else {
      toCreate.push(scored);
    }
  }

  const unmatched = input.existingActive.filter((opportunity) => !matchedExistingIds.has(opportunity.id));

  const toComplete: DetectedOpportunity[] = [];
  const toExpire: DetectedOpportunity[] = [];
  const unchanged: DetectedOpportunity[] = [];

  for (const opportunity of unmatched) {
    if (hasCompletedViaLearning(opportunity, input.learningPatterns)) {
      toComplete.push(opportunity);
    } else if (daysSince(opportunity.lastSeenAt, now) > EXPIRE_AFTER_DAYS) {
      toExpire.push(opportunity);
    } else {
      unchanged.push(opportunity);
    }
  }

  return { toCreate, toUpdate, toComplete, toExpire, unchanged };
}

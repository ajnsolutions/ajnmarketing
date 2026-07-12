import type { MarketingOpportunity } from "@/lib/marketing-opportunities/types";
import type { MarketingRecommendationDraft, RecommendedActionType } from "@/lib/marketing-decisions/types";
import {
  ACTION_TYPE_EFFORT,
  ACTION_TYPE_IMPACT,
  CATEGORY_TO_ACTION_TYPE,
} from "@/lib/marketing-decisions/actionTypeMapping";
import {
  aggregateConfidence,
  aggregatePriorityScore,
  scoreOpportunity,
  urgencyFromPriorityScore,
} from "@/lib/marketing-decisions/scoring";

/**
 * Pure engine core: no database access, no I/O. Takes ACTIVE opportunities (the caller
 * — lib/marketing-decisions/service.ts — is responsible for excluding dismissed/
 * resolved/expired ones before calling this) and produces a deterministically-ordered
 * list of recommendation drafts, ready for the persistence layer's idempotent upsert.
 */

export type RankedOpportunity = { opportunity: MarketingOpportunity; score: number };

/**
 * Standalone opportunity ranking, exposed directly (not just as an internal step of
 * grouping) so "rank opportunities" is independently visible and testable — highest
 * score first, tie-broken by opportunity id for full determinism.
 */
export function rankOpportunities(
  opportunities: MarketingOpportunity[],
  now: Date = new Date()
): RankedOpportunity[] {
  return opportunities
    .map((opportunity) => ({ opportunity, score: scoreOpportunity(opportunity, now) }))
    .sort((a, b) => b.score - a.score || a.opportunity.id.localeCompare(b.opportunity.id));
}

// "|" rather than "," -- dedupe_key values must never be ambiguous when later used
// inside a comma-delimited filter list (e.g. Postgrest's `.in()`), and UUIDs never
// contain a pipe.
function buildDedupeKey(opportunityIds: string[]): string {
  return [...opportunityIds].sort().join("|");
}

function buildReasoning(opportunities: MarketingOpportunity[]): string {
  if (opportunities.length === 1) {
    return opportunities[0].description || opportunities[0].title;
  }

  const titles = opportunities.map((o) => o.title).join("; ");
  return `${opportunities.length} related opportunities point to the same action: ${titles}.`;
}

/**
 * Groups active opportunities by their mapped recommended_action_type (the merge rule
 * — see actionTypeMapping.ts's CATEGORY_TO_ACTION_TYPE doc comment), scores and ranks
 * each opportunity, aggregates a priority/confidence per group, and returns
 * deterministically-ordered drafts: highest priority_score first, tie-broken by action
 * type then by the group's own dedupe key, so identical input always produces identical
 * output order.
 */
export function buildMarketingRecommendationDrafts(
  activeOpportunities: MarketingOpportunity[],
  now: Date = new Date()
): MarketingRecommendationDraft[] {
  const groups = new Map<RecommendedActionType, MarketingOpportunity[]>();

  for (const opportunity of activeOpportunities) {
    const actionType = CATEGORY_TO_ACTION_TYPE[opportunity.category];
    const group = groups.get(actionType);
    if (group) {
      group.push(opportunity);
    } else {
      groups.set(actionType, [opportunity]);
    }
  }

  const drafts: MarketingRecommendationDraft[] = [];

  for (const [actionType, opportunities] of groups) {
    const scores = opportunities.map((opportunity) => scoreOpportunity(opportunity, now));
    const priorityScore = aggregatePriorityScore(scores);
    const relatedOpportunityIds = opportunities.map((o) => o.id).sort();

    drafts.push({
      recommendedActionType: actionType,
      priorityScore,
      urgency: urgencyFromPriorityScore(priorityScore),
      businessImpact: ACTION_TYPE_IMPACT[actionType],
      estimatedEffort: ACTION_TYPE_EFFORT[actionType],
      confidence: aggregateConfidence(opportunities.map((o) => o.confidence)),
      reasoning: buildReasoning(opportunities),
      relatedOpportunityIds,
      dedupeKey: buildDedupeKey(relatedOpportunityIds),
    });
  }

  drafts.sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
    if (a.recommendedActionType !== b.recommendedActionType) {
      return a.recommendedActionType.localeCompare(b.recommendedActionType);
    }
    return a.dedupeKey.localeCompare(b.dedupeKey);
  });

  return drafts;
}

/**
 * Business Learning Engine — single entrypoint other subsystems call.
 *
 * Reconciliation is on-demand (called from a request path, e.g. the
 * dashboard page), never a scheduled cron — matching this repo's existing
 * rule that ATTACH_DECLARATIVE_PRODUCTION_CRONS stays false and
 * lib/recommendation-outcomes' own reconciliation is admin/manual-only.
 * Reconciliation is idempotent: replaying the same signals never
 * double-reinforces a pattern (see reinforce.ts's evidence-dedupe check).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { getLearningsForBusiness } from "@/lib/marketing-memory/learningPersistence";
import { getRecommendationsForBusiness } from "@/lib/recommendation-outcomes/persistence";
import type { BusinessReasoningResult } from "@/lib/business-knowledge-graph/reasoning";
import { marketingMemoryLearningsToLearningSignals } from "@/lib/business-learning-engine/adapters/marketingMemory";
import { actionTypeBreakdownToLearningSignals } from "@/lib/business-learning-engine/adapters/recommendationOutcomes";
import { feedbackBreakdownToLearningSignals } from "@/lib/business-learning-engine/adapters/feedback";
import { businessReasoningToLearningSignals } from "@/lib/business-learning-engine/adapters/businessKnowledgeGraph";
import { planReinforcement, buildNewPattern, reinforceExistingPattern } from "@/lib/business-learning-engine/reinforce";
import {
  computeActionTypeFeedbackBreakdown,
  computeActionTypeOutcomeBreakdown,
  getBusinessLearningPatterns,
  getRecommendationFeedbackEventsForBusiness,
  insertBusinessLearningPattern,
  insertRecommendationFeedbackEvent,
  updateBusinessLearningPattern,
} from "@/lib/business-learning-engine/persistence";
import type { ActionTypeOutcomeBreakdown } from "@/lib/business-learning-engine/adapters/recommendationOutcomes";
import type { ActionTypeFeedbackBreakdown } from "@/lib/business-learning-engine/adapters/feedback";
import type { BusinessPattern, RecommendationFeedbackValue } from "@/lib/business-learning-engine/types";

export type BusinessLearningEngineInput = {
  userId: string;
  businessProfileId: string;
  businessReasoning?: BusinessReasoningResult | null;
  now?: Date;
};

export type BusinessLearningReconciliationResult = {
  patterns: BusinessPattern[];
  /** Reused by Learning Maturity (Part 7) so it never re-fetches. */
  outcomeBreakdown: ActionTypeOutcomeBreakdown[];
  feedbackBreakdown: ActionTypeFeedbackBreakdown[];
  totalRecommendations: number;
  feedbackEventCount: number;
};

/**
 * Fetches every persisted pattern, gathers fresh signals from every
 * provider, reconciles (create/reinforce), persists the changes, and
 * returns the up-to-date pattern list plus the raw breakdowns Learning
 * Maturity needs. Safe to call on every page load — reconciliation is
 * cheap and idempotent.
 */
export async function reconcileAndGetBusinessLearningPatterns(
  supabase: SupabaseClient,
  input: BusinessLearningEngineInput,
): Promise<BusinessLearningReconciliationResult> {
  const now = input.now ?? new Date();

  const [existingPatterns, learnings, outcomeBreakdown, feedbackBreakdown, feedbackEvents, recommendations] =
    await Promise.all([
      getBusinessLearningPatterns(supabase, input.userId, input.businessProfileId, now),
      getLearningsForBusiness(supabase, input.userId, input.businessProfileId),
      computeActionTypeOutcomeBreakdown(supabase, input.userId, input.businessProfileId),
      computeActionTypeFeedbackBreakdown(supabase, input.userId, input.businessProfileId),
      getRecommendationFeedbackEventsForBusiness(supabase, input.userId, input.businessProfileId),
      getRecommendationsForBusiness(supabase, input.userId, input.businessProfileId),
    ]);

  const signals = [
    ...marketingMemoryLearningsToLearningSignals(learnings),
    ...actionTypeBreakdownToLearningSignals(outcomeBreakdown),
    ...feedbackBreakdownToLearningSignals(feedbackBreakdown),
    ...businessReasoningToLearningSignals(input.businessReasoning),
  ];

  const plan = planReinforcement(existingPatterns, signals);

  await Promise.all([
    ...plan.toCreate.map(async (signal) => {
      const created = buildNewPattern(signal, now);
      await insertBusinessLearningPattern(supabase, input.userId, input.businessProfileId, created);
    }),
    ...plan.toReinforce.map(async ({ pattern, signal }) => {
      const reinforced = reinforceExistingPattern(pattern, signal, now);
      await updateBusinessLearningPattern(supabase, pattern.id, reinforced);
    }),
  ]);

  const patterns =
    plan.toCreate.length === 0 && plan.toReinforce.length === 0
      ? plan.unchanged
      : // Re-read so callers always see the persisted, canonical state (ids,
        // decay recomputed against `now`) rather than assembling it by hand.
        await getBusinessLearningPatterns(supabase, input.userId, input.businessProfileId, now);

  return {
    patterns,
    outcomeBreakdown,
    feedbackBreakdown,
    totalRecommendations: recommendations.length,
    feedbackEventCount: feedbackEvents.length,
  };
}

export async function recordRecommendationFeedback(
  supabase: SupabaseClient,
  input: {
    userId: string;
    businessProfileId: string;
    recommendationId: string;
    feedback: RecommendationFeedbackValue;
    comment?: string | null;
  },
) {
  return insertRecommendationFeedbackEvent(supabase, input);
}

/** The pattern (if any) relevant to a specific recommended action type —
 * the natural lookup Growth Advisor and the Weekly Growth Plan need to
 * annotate "we've seen this kind of recommendation before." */
export function findPatternForActionType(
  patterns: BusinessPattern[],
  actionType: string,
): BusinessPattern | null {
  return (
    patterns.find((p) => p.patternKey === `recommendation_action_outcome:${actionType}`) ?? null
  );
}

export type { BusinessPattern } from "@/lib/business-learning-engine/types";

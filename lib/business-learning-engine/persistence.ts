import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getRecommendationsForBusiness,
  getOutcomeEventsForBusiness,
} from "@/lib/recommendation-outcomes/persistence";
import { summarizeRecommendationOutcomeForUser } from "@/lib/recommendation-outcomes/service";
import { computeDecayState, applyDecay } from "@/lib/business-learning-engine/confidence";
import type { ActionTypeOutcomeBreakdown } from "@/lib/business-learning-engine/adapters/recommendationOutcomes";
import type { ActionTypeFeedbackBreakdown } from "@/lib/business-learning-engine/adapters/feedback";
import { groupFeedbackEventsByActionType } from "@/lib/business-learning-engine/adapters/feedback";
import type {
  BusinessPattern,
  PatternEvidence,
  RecommendationFeedbackEvent,
  RecommendationFeedbackValue,
} from "@/lib/business-learning-engine/types";

function mapPatternRow(row: Record<string, unknown>, now: Date): BusinessPattern {
  const confidenceLevel = row.confidence_level as BusinessPattern["confidenceLevel"];
  const lastReinforced = String(row.last_reinforced_at);
  const decayState = computeDecayState(lastReinforced, now);

  return {
    id: String(row.id),
    patternKey: String(row.pattern_key),
    statement: String(row.statement),
    direction: row.direction as BusinessPattern["direction"],
    confidenceLevel,
    contributingProviders: (row.contributing_providers as string[]) ?? [],
    evidence: (row.evidence as PatternEvidence[]) ?? [],
    firstObserved: String(row.first_observed_at),
    lastReinforced,
    reinforcementCount: Number(row.reinforcement_count),
    decayState,
    effectiveConfidence: applyDecay(confidenceLevel, decayState),
  };
}

export async function getBusinessLearningPatterns(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
  now: Date = new Date(),
): Promise<BusinessPattern[]> {
  const { data, error } = await supabase
    .from("business_learning_patterns")
    .select("*")
    .eq("user_id", userId)
    .eq("business_profile_id", businessProfileId)
    .eq("status", "active");

  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map((row) => mapPatternRow(row, now));
}

export async function insertBusinessLearningPattern(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
  pattern: Omit<BusinessPattern, "id">,
): Promise<void> {
  await supabase.from("business_learning_patterns").insert({
    user_id: userId,
    business_profile_id: businessProfileId,
    pattern_key: pattern.patternKey,
    statement: pattern.statement,
    direction: pattern.direction,
    confidence_level: pattern.confidenceLevel,
    contributing_providers: pattern.contributingProviders,
    evidence: pattern.evidence,
    first_observed_at: pattern.firstObserved,
    last_reinforced_at: pattern.lastReinforced,
    reinforcement_count: pattern.reinforcementCount,
    decay_state: pattern.decayState,
  });
}

export async function updateBusinessLearningPattern(
  supabase: SupabaseClient,
  patternId: string,
  pattern: BusinessPattern,
): Promise<void> {
  await supabase
    .from("business_learning_patterns")
    .update({
      statement: pattern.statement,
      direction: pattern.direction,
      confidence_level: pattern.confidenceLevel,
      contributing_providers: pattern.contributingProviders,
      evidence: pattern.evidence,
      last_reinforced_at: pattern.lastReinforced,
      reinforcement_count: pattern.reinforcementCount,
      decay_state: pattern.decayState,
    })
    .eq("id", patternId);
}

/** Real, already-computed per-recommendation outcomes, grouped by the
 * recommendation's own action type — no new event log, just aggregation
 * over lib/recommendation-outcomes' existing authoritative summaries. */
export async function computeActionTypeOutcomeBreakdown(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
): Promise<ActionTypeOutcomeBreakdown[]> {
  const recommendations = await getRecommendationsForBusiness(supabase, userId, businessProfileId);
  const byActionType = new Map<string, ActionTypeOutcomeBreakdown>();

  for (const rec of recommendations) {
    const actionType = String(rec.recommended_action_type);
    const recommendationId = String(rec.id);
    const summary = await summarizeRecommendationOutcomeForUser(userId, recommendationId, supabase);
    if (summary.lifecycleStatus === "recommended") continue;

    const existing = byActionType.get(actionType) ?? {
      actionType,
      sampleSize: 0,
      approvedCount: 0,
      rejectedCount: 0,
      publishedCount: 0,
      dominantRejectionReason: null as string | null,
      lastActivityAt: null as string | null,
    };

    existing.sampleSize += 1;
    if (summary.approvedAt) existing.approvedCount += 1;
    if (summary.rejectedAt) {
      existing.rejectedCount += 1;
      if (summary.rejectionReasonCode) existing.dominantRejectionReason = summary.rejectionReasonCode;
    }
    if (summary.lifecycleStatus === "published" || summary.lifecycleStatus === "measured") {
      existing.publishedCount += 1;
    }
    if (summary.lastEventAt && (!existing.lastActivityAt || summary.lastEventAt > existing.lastActivityAt)) {
      existing.lastActivityAt = summary.lastEventAt;
    }

    byActionType.set(actionType, existing);
  }

  return [...byActionType.values()];
}

export async function getRecommendationFeedbackEventsForBusiness(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
): Promise<RecommendationFeedbackEvent[]> {
  const { data, error } = await supabase
    .from("recommendation_feedback_events")
    .select("*")
    .eq("user_id", userId)
    .eq("business_profile_id", businessProfileId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    recommendationId: String(row.recommendation_id),
    feedback: row.feedback as RecommendationFeedbackValue,
    comment: (row.comment as string | null) ?? null,
    createdAt: String(row.created_at),
  }));
}

/** Explicit feedback, grouped by the recommendation's own action type — the
 * join lib/recommendation-outcomes doesn't need to know about. */
export async function computeActionTypeFeedbackBreakdown(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
): Promise<ActionTypeFeedbackBreakdown[]> {
  const [events, recommendations] = await Promise.all([
    getRecommendationFeedbackEventsForBusiness(supabase, userId, businessProfileId),
    getRecommendationsForBusiness(supabase, userId, businessProfileId),
  ]);
  if (events.length === 0) return [];

  const actionTypeById = new Map(recommendations.map((rec) => [String(rec.id), String(rec.recommended_action_type)]));

  const joined = events
    .map((event) => ({ event, actionType: actionTypeById.get(event.recommendationId) }))
    .filter((item): item is { event: RecommendationFeedbackEvent; actionType: string } => Boolean(item.actionType));

  return groupFeedbackEventsByActionType(joined);
}

export async function insertRecommendationFeedbackEvent(
  supabase: SupabaseClient,
  input: {
    userId: string;
    businessProfileId: string;
    recommendationId: string;
    feedback: RecommendationFeedbackValue;
    comment?: string | null;
  },
): Promise<RecommendationFeedbackEvent | null> {
  const { data, error } = await supabase
    .from("recommendation_feedback_events")
    .insert({
      user_id: input.userId,
      business_profile_id: input.businessProfileId,
      recommendation_id: input.recommendationId,
      feedback: input.feedback,
      comment: input.comment ?? null,
    })
    .select("*")
    .single();

  if (error || !data) return null;
  const row = data as Record<string, unknown>;
  return {
    id: String(row.id),
    recommendationId: String(row.recommendation_id),
    feedback: row.feedback as RecommendationFeedbackValue,
    comment: (row.comment as string | null) ?? null,
    createdAt: String(row.created_at),
  };
}

export { getOutcomeEventsForBusiness };

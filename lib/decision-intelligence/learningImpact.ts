/**
 * Learning / preference / override impact summaries (Phases G, H, I).
 *
 * "Did this learning influence a decision?" is answered only from an explicit recorded
 * relationship — a decision snapshot's consulted_learning_ids/consulted_preference_ids
 * arrays (Phase B) — never inferred from close timestamps. "Did an experiment contribute
 * evidence?" is answered via an explicit two-hop join (learning -> supporting
 * observation -> observation.source_experiment_id), never by matching titles.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { confidenceForLearning } from "@/lib/decision-intelligence/evidenceTrace";
import {
  DecisionEvidenceConfidenceStates,
  type LearningImpactSummary,
} from "@/lib/decision-intelligence/types";

function originForLearningFamily(family: string, timeDimension: string | null, subjectKey: string): string {
  if (family === "timing_performance") {
    return `Timing pattern: ${timeDimension ?? "period"} — ${subjectKey}`;
  }
  return `Recommendation outcome pattern: ${subjectKey.replaceAll("_", " ")}`;
}

async function relatedCampaignAndExperimentIds(
  supabase: SupabaseClient,
  businessProfileId: string,
  learningId: string,
): Promise<{ campaignIds: string[]; experimentIds: string[]; supportingCount: number }> {
  const { data: links } = await supabase
    .from("marketing_memory_evidence_links")
    .select("source_id, contribution")
    .eq("business_profile_id", businessProfileId)
    .eq("learning_id", learningId)
    .eq("source_type", "observation");

  const observationIds = ((links as { source_id: string; contribution: string | null }[] | null) ?? []).map(
    (link) => link.source_id,
  );
  const supportingCount = ((links as { contribution: string | null }[] | null) ?? []).filter(
    (link) => link.contribution === "supporting",
  ).length;

  if (observationIds.length === 0) {
    return { campaignIds: [], experimentIds: [], supportingCount: 0 };
  }

  const { data: observations } = await supabase
    .from("marketing_memory_observations")
    .select("source_campaign_id, source_experiment_id")
    .in("id", observationIds)
    .eq("business_profile_id", businessProfileId);

  const rows = (observations as { source_campaign_id: string | null; source_experiment_id: string | null }[] | null) ?? [];
  const campaignIds = [...new Set(rows.map((r) => r.source_campaign_id).filter((v): v is string => Boolean(v)))];
  const experimentIds = [...new Set(rows.map((r) => r.source_experiment_id).filter((v): v is string => Boolean(v)))];

  return { campaignIds, experimentIds, supportingCount };
}

export type LearningImpactDeps = {
  learnings: { id: string; learning_family: string; time_dimension: string | null; subject_key: string; status: string; confidence_level: string; first_observed_at: string; last_observed_at: string }[];
  preferences: { id: string; preference_type: string; instruction_text: string; is_active: boolean; source: string; created_at: string; promoted_from_override_id: string | null }[];
  overrides: { id: string; override_type: string; is_permanent: boolean; promoted_to_preference_id: string | null; created_at: string; notes: string | null }[];
  /** All consulted_learning_ids / consulted_preference_ids ever recorded across this
   * business's decision history — the sole basis for "influenced a later decision". */
  everConsultedLearningIds: Set<string>;
  everConsultedPreferenceIds: Set<string>;
  /** id -> reason, from any snapshot's ignored_evidence — used to flag "was ignored" state. */
  everIgnoredLearningReasons: Map<string, string>;
  everIgnoredPreferenceReasons: Map<string, string>;
};

export async function buildLearningImpactSummaries(
  supabase: SupabaseClient,
  businessProfileId: string,
  deps: LearningImpactDeps,
): Promise<LearningImpactSummary[]> {
  const summaries: LearningImpactSummary[] = [];

  const learningResults = await Promise.all(
    deps.learnings.map((learning) => relatedCampaignAndExperimentIds(supabase, businessProfileId, learning.id)),
  );

  deps.learnings.forEach((learning, index) => {
    const { campaignIds, experimentIds, supportingCount } = learningResults[index]!;
    const influenced = deps.everConsultedLearningIds.has(learning.id);
    const ignoredReason = deps.everIgnoredLearningReasons.get(learning.id) ?? null;
    summaries.push({
      id: learning.id,
      kind: "learning",
      label: originForLearningFamily(learning.learning_family, learning.time_dimension, learning.subject_key),
      origin: learning.learning_family,
      supportingObservationCount: supportingCount,
      relatedCampaignIds: campaignIds,
      relatedExperimentIds: experimentIds,
      relatedRecommendationOutcomeCount: 0,
      firstObservedAt: learning.first_observed_at,
      mostRecentSupportingAt: learning.last_observed_at,
      confidenceState: confidenceForLearning(learning.confidence_level),
      activeState: learning.status === "superseded" || learning.status === "archived" ? "superseded" : "active",
      influencedLaterDecision: influenced,
      influenceUnavailableReason: influenced
        ? null
        : "No decision snapshot has explicitly consulted this learning yet.",
      overriddenByCustomer: false,
      ignoredDueToPrecedence: ignoredReason,
      insufficientEvidence:
        learning.status === "inconclusive" || learning.confidence_level === "early_signal",
    });
  });

  for (const preference of deps.preferences) {
    const influenced = deps.everConsultedPreferenceIds.has(preference.id);
    const ignoredReason = deps.everIgnoredPreferenceReasons.get(preference.id) ?? null;
    summaries.push({
      id: preference.id,
      kind: "preference",
      label: preference.instruction_text,
      origin: preference.source === "promoted_override" ? "Promoted from a customer override" : "Explicit customer statement",
      supportingObservationCount: 0,
      relatedCampaignIds: [],
      relatedExperimentIds: [],
      relatedRecommendationOutcomeCount: 0,
      firstObservedAt: preference.created_at,
      mostRecentSupportingAt: preference.created_at,
      confidenceState: DecisionEvidenceConfidenceStates.NOT_APPLICABLE,
      activeState: preference.is_active ? "active" : "inactive",
      influencedLaterDecision: influenced,
      influenceUnavailableReason: influenced
        ? null
        : "No decision snapshot has explicitly consulted this preference yet.",
      overriddenByCustomer: false,
      ignoredDueToPrecedence: ignoredReason,
      insufficientEvidence: false,
    });
  }

  for (const override of deps.overrides) {
    summaries.push({
      id: override.id,
      kind: "override",
      label: override.notes ?? override.override_type.replaceAll("_", " "),
      origin: override.is_permanent ? "Permanent customer override" : "Temporary customer override",
      supportingObservationCount: 0,
      relatedCampaignIds: [],
      relatedExperimentIds: [],
      relatedRecommendationOutcomeCount: 0,
      firstObservedAt: override.created_at,
      mostRecentSupportingAt: override.created_at,
      confidenceState: DecisionEvidenceConfidenceStates.NOT_APPLICABLE,
      activeState: override.promoted_to_preference_id ? "superseded" : "active",
      influencedLaterDecision: Boolean(override.promoted_to_preference_id),
      influenceUnavailableReason: override.promoted_to_preference_id
        ? null
        : "This override has not been promoted into a permanent preference, so it affected only the plan at the time it was recorded.",
      overriddenByCustomer: true,
      ignoredDueToPrecedence: null,
      insufficientEvidence: false,
    });
  }

  return summaries;
}

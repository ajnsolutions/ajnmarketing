/**
 * Evidence-trace builder (Phase C/D). Computed at read time from the explicit IDs
 * already persisted on a decision snapshot — never a separate persisted table, and
 * never fuzzy title matching. If a snapshot has no explicit ID for something, this
 * module says so ("no explicit evidence link is available") rather than inferring one.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DecisionEvidenceConfidenceStates,
  DecisionEvidenceInfluenceStates,
  DecisionEvidenceRecencyStates,
  DecisionEvidenceRelationshipTypes,
  DecisionEvidenceTypes,
  type DecisionEvidenceTrace,
  type MarketingDirectorDecisionSnapshot,
} from "@/lib/decision-intelligence/types";
import { sourceTargetFor } from "@/lib/decision-intelligence/relationships";

const RECENT_WINDOW_DAYS = 30;
const STALE_WINDOW_DAYS = 90;

function recencyFor(dateIso: string | null, now: Date): (typeof DecisionEvidenceRecencyStates)[keyof typeof DecisionEvidenceRecencyStates] {
  if (!dateIso) return DecisionEvidenceRecencyStates.UNKNOWN;
  const ageDays = (now.getTime() - new Date(dateIso).getTime()) / (1000 * 60 * 60 * 24);
  if (ageDays <= RECENT_WINDOW_DAYS) return DecisionEvidenceRecencyStates.CURRENT;
  if (ageDays <= STALE_WINDOW_DAYS) return DecisionEvidenceRecencyStates.RECENT;
  return DecisionEvidenceRecencyStates.STALE;
}

export function confidenceForLearning(level: string): (typeof DecisionEvidenceConfidenceStates)[keyof typeof DecisionEvidenceConfidenceStates] {
  switch (level) {
    case "strong_pattern":
      return DecisionEvidenceConfidenceStates.STRONG;
    case "developing_pattern":
      return DecisionEvidenceConfidenceStates.DEVELOPING;
    case "early_signal":
      return DecisionEvidenceConfidenceStates.EARLY;
    default:
      return DecisionEvidenceConfidenceStates.NOT_APPLICABLE;
  }
}

export type EvidenceTraceDeps = {
  now?: Date;
};

/**
 * Batched lookups scoped to one business — never a per-item N+1 query. Every table read
 * filters by business_profile_id in addition to matching IDs.
 */
export async function buildEvidenceTraceForSnapshot(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
  snapshot: MarketingDirectorDecisionSnapshot,
  deps: EvidenceTraceDeps = {},
): Promise<DecisionEvidenceTrace[]> {
  const now = deps.now ?? new Date();
  const traces: DecisionEvidenceTrace[] = [];
  let seq = 0;
  const nextId = () => `${snapshot.id}:trace:${seq++}`;

  const [recommendation, campaign, learnings, preferences] = await Promise.all([
    snapshot.source_recommendation_id
      ? supabase
          .from("marketing_recommendations")
          .select("id, status, recommended_action_type, updated_at")
          .eq("id", snapshot.source_recommendation_id)
          .eq("user_id", userId)
          .eq("business_profile_id", businessProfileId)
          .maybeSingle()
          .then((r) => r.data as Record<string, unknown> | null)
      : Promise.resolve(null),
    snapshot.source_campaign_id
      ? supabase
          .from("marketing_campaigns")
          .select("id, status, campaign_type, updated_at")
          .eq("id", snapshot.source_campaign_id)
          .eq("user_id", userId)
          .eq("business_profile_id", businessProfileId)
          .maybeSingle()
          .then((r) => r.data as Record<string, unknown> | null)
      : Promise.resolve(null),
    snapshot.consulted_learning_ids.length > 0
      ? supabase
          .from("marketing_memory_learnings")
          .select("id, status, confidence_level, summary, last_observed_at")
          .in("id", snapshot.consulted_learning_ids)
          .eq("business_profile_id", businessProfileId)
          .then((r) => (r.data as Record<string, unknown>[] | null) ?? [])
      : Promise.resolve([]),
    snapshot.consulted_preference_ids.length > 0
      ? supabase
          .from("marketing_memory_preferences")
          .select("id, is_active, instruction_text, preference_type, created_at, active_until")
          .in("id", snapshot.consulted_preference_ids)
          .eq("business_profile_id", businessProfileId)
          .then((r) => (r.data as Record<string, unknown>[] | null) ?? [])
      : Promise.resolve([]),
  ]);

  if (recommendation) {
    traces.push({
      id: nextId(),
      decisionId: snapshot.id,
      businessProfileId,
      evidenceType: DecisionEvidenceTypes.RECOMMENDATION,
      evidenceId: String(recommendation.id),
      relationshipType: DecisionEvidenceRelationshipTypes.BASED_ON,
      influenceState: DecisionEvidenceInfluenceStates.APPLIED,
      customerExplanation: `This priority is based on an existing recommendation (${String(recommendation.recommended_action_type ?? "").replaceAll("_", " ")}).`,
      confidenceState: DecisionEvidenceConfidenceStates.NOT_APPLICABLE,
      recencyState: recencyFor(recommendation.updated_at as string | null, now),
      authoritative: false,
      overridden: false,
      superseded: recommendation.status === "superseded",
      excluded: false,
      exclusionReason: null,
      observedAt: (recommendation.updated_at as string | null) ?? null,
      effectiveFrom: null,
      effectiveTo: null,
      sourceTarget: sourceTargetFor(DecisionEvidenceTypes.RECOMMENDATION, String(recommendation.id)),
    });
  } else if (snapshot.source_recommendation_id) {
    traces.push(unavailableTrace(nextId(), snapshot, DecisionEvidenceTypes.RECOMMENDATION, snapshot.source_recommendation_id));
  }

  if (campaign) {
    const completed = campaign.status === "completed" || campaign.status === "measured";
    traces.push({
      id: nextId(),
      decisionId: snapshot.id,
      businessProfileId,
      evidenceType: completed ? DecisionEvidenceTypes.CAMPAIGN_COMPLETION : DecisionEvidenceTypes.CAMPAIGN,
      evidenceId: String(campaign.id),
      relationshipType: DecisionEvidenceRelationshipTypes.LINKED_TO_CAMPAIGN,
      influenceState: DecisionEvidenceInfluenceStates.APPLIED,
      customerExplanation: completed
        ? "This priority reflects a campaign that has already completed."
        : "This priority is linked to an active campaign.",
      confidenceState: DecisionEvidenceConfidenceStates.NOT_APPLICABLE,
      recencyState: recencyFor(campaign.updated_at as string | null, now),
      authoritative: false,
      overridden: false,
      superseded: false,
      excluded: false,
      exclusionReason: null,
      observedAt: (campaign.updated_at as string | null) ?? null,
      effectiveFrom: null,
      effectiveTo: null,
      sourceTarget: sourceTargetFor(DecisionEvidenceTypes.CAMPAIGN, String(campaign.id)),
    });
  } else if (snapshot.source_campaign_id) {
    traces.push(unavailableTrace(nextId(), snapshot, DecisionEvidenceTypes.CAMPAIGN, snapshot.source_campaign_id));
  }

  for (const learning of learnings) {
    const confidenceLevel = String(learning.confidence_level ?? "");
    traces.push({
      id: nextId(),
      decisionId: snapshot.id,
      businessProfileId,
      evidenceType: DecisionEvidenceTypes.MARKETING_MEMORY_LEARNING,
      evidenceId: String(learning.id),
      relationshipType: DecisionEvidenceRelationshipTypes.INFORMED_BY,
      influenceState: DecisionEvidenceInfluenceStates.CONSIDERED,
      customerExplanation: String(learning.summary ?? "A developing pattern was considered."),
      confidenceState: confidenceForLearning(confidenceLevel),
      recencyState: recencyFor(learning.last_observed_at as string | null, now),
      authoritative: false,
      superseded: learning.status === "superseded",
      overridden: false,
      excluded: false,
      exclusionReason: null,
      observedAt: (learning.last_observed_at as string | null) ?? null,
      effectiveFrom: null,
      effectiveTo: null,
      sourceTarget: sourceTargetFor(DecisionEvidenceTypes.MARKETING_MEMORY_LEARNING, String(learning.id)),
    });
  }

  for (const preference of preferences) {
    const active = Boolean(preference.is_active);
    traces.push({
      id: nextId(),
      decisionId: snapshot.id,
      businessProfileId,
      evidenceType: DecisionEvidenceTypes.MARKETING_MEMORY_PREFERENCE,
      evidenceId: String(preference.id),
      relationshipType: DecisionEvidenceRelationshipTypes.CONSTRAINED_BY,
      influenceState: DecisionEvidenceInfluenceStates.APPLIED,
      customerExplanation: String(preference.instruction_text ?? "A customer preference constrained this decision."),
      confidenceState: DecisionEvidenceConfidenceStates.NOT_APPLICABLE,
      recencyState: recencyFor(preference.created_at as string | null, now),
      authoritative: true,
      superseded: !active,
      overridden: false,
      excluded: false,
      exclusionReason: null,
      observedAt: (preference.created_at as string | null) ?? null,
      effectiveFrom: (preference.created_at as string | null) ?? null,
      effectiveTo: (preference.active_until as string | null) ?? null,
      sourceTarget: sourceTargetFor(DecisionEvidenceTypes.MARKETING_MEMORY_PREFERENCE, String(preference.id)),
    });
  }

  for (const ignored of snapshot.ignored_evidence) {
    const evidenceType =
      ignored.evidenceType === "learning"
        ? DecisionEvidenceTypes.MARKETING_MEMORY_LEARNING
        : DecisionEvidenceTypes.MARKETING_MEMORY_PREFERENCE;
    traces.push({
      id: nextId(),
      decisionId: snapshot.id,
      businessProfileId,
      evidenceType,
      evidenceId: ignored.id,
      relationshipType: exclusionRelationshipFor(ignored.reason),
      influenceState: DecisionEvidenceInfluenceStates.EXCLUDED,
      customerExplanation: `This evidence was not used: ${ignored.reason}.`,
      confidenceState: DecisionEvidenceConfidenceStates.NOT_APPLICABLE,
      recencyState: DecisionEvidenceRecencyStates.UNKNOWN,
      authoritative: false,
      superseded: false,
      overridden: false,
      excluded: true,
      exclusionReason: ignored.reason,
      observedAt: null,
      effectiveFrom: null,
      effectiveTo: null,
      sourceTarget: sourceTargetFor(evidenceType, ignored.id),
    });
  }

  return traces;
}

function unavailableTrace(
  id: string,
  snapshot: MarketingDirectorDecisionSnapshot,
  evidenceType: (typeof DecisionEvidenceTypes)[keyof typeof DecisionEvidenceTypes],
  evidenceId: string,
): DecisionEvidenceTrace {
  return {
    id,
    decisionId: snapshot.id,
    businessProfileId: snapshot.business_profile_id,
    evidenceType,
    evidenceId,
    relationshipType: DecisionEvidenceRelationshipTypes.BASED_ON,
    influenceState: DecisionEvidenceInfluenceStates.UNAVAILABLE,
    customerExplanation: "No explicit evidence link is available for this historical decision.",
    confidenceState: DecisionEvidenceConfidenceStates.NOT_APPLICABLE,
    recencyState: DecisionEvidenceRecencyStates.UNKNOWN,
    authoritative: false,
    superseded: false,
    overridden: false,
    excluded: false,
    exclusionReason: null,
    observedAt: null,
    effectiveFrom: null,
    effectiveTo: null,
    sourceTarget: null,
  };
}

function exclusionRelationshipFor(reason: string): (typeof DecisionEvidenceRelationshipTypes)[keyof typeof DecisionEvidenceRelationshipTypes] {
  const normalized = reason.toLowerCase();
  if (normalized.includes("prohibit")) return DecisionEvidenceRelationshipTypes.EXCLUDED_PROHIBITION;
  if (normalized.includes("stale") || normalized.includes("expired")) return DecisionEvidenceRelationshipTypes.EXCLUDED_STALE;
  if (normalized.includes("override")) return DecisionEvidenceRelationshipTypes.EXCLUDED_CUSTOMER_OVERRIDE;
  if (normalized.includes("confidence") || normalized.includes("weak") || normalized.includes("early")) {
    return DecisionEvidenceRelationshipTypes.EXCLUDED_LOW_CONFIDENCE;
  }
  return DecisionEvidenceRelationshipTypes.EXCLUDED_INSUFFICIENT_ATTRIBUTION;
}

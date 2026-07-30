import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  ConfidenceLevel,
  DetectedOpportunity,
  OpportunityEvidence,
  OpportunityScore,
  OpportunityStatus,
} from "@/lib/opportunity-engine/types";

function mapRow(row: Record<string, unknown>): DetectedOpportunity {
  const score: OpportunityScore = {
    total: Number(row.score_total),
    evidenceStrength: Number(row.score_evidence_strength),
    businessImpact: Number(row.score_business_impact),
    urgency: Number(row.score_urgency),
    confidence: Number(row.score_confidence),
    historicalSuccess: Number(row.score_historical_success),
  };

  return {
    id: String(row.id),
    type: row.opportunity_type as DetectedOpportunity["type"],
    topic: String(row.topic),
    statement: String(row.statement),
    whyNow: String(row.why_now),
    expectedOutcome: String(row.expected_outcome),
    evidence: (row.evidence as OpportunityEvidence[]) ?? [],
    contributingProviders: (row.contributing_providers as string[]) ?? [],
    confidence: row.confidence as ConfidenceLevel,
    score,
    status: row.status as OpportunityStatus,
    relatedActionType: (row.related_action_type as string | null) ?? null,
    firstDetectedAt: String(row.first_detected_at),
    lastSeenAt: String(row.last_seen_at),
    retiredAt: (row.retired_at as string | null) ?? null,
    retiredReason: (row.retired_reason as DetectedOpportunity["retiredReason"]) ?? null,
  };
}

export async function getActiveOpportunitiesForUser(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
): Promise<DetectedOpportunity[]> {
  const { data, error } = await supabase
    .from("detected_opportunities")
    .select("*")
    .eq("user_id", userId)
    .eq("business_profile_id", businessProfileId)
    .eq("status", "active")
    .order("score_total", { ascending: false });

  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(mapRow);
}

/** Business Timeline (Part 7) needs completed/expired opportunities too, not
 * just active ones — a bounded recent window, not the full history. */
export async function getRetiredOpportunitiesForUser(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
  limit = 25,
): Promise<DetectedOpportunity[]> {
  const { data, error } = await supabase
    .from("detected_opportunities")
    .select("*")
    .eq("user_id", userId)
    .eq("business_profile_id", businessProfileId)
    .in("status", ["completed", "expired"])
    .order("retired_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(mapRow);
}

export async function insertOpportunity(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
  opportunity: Omit<DetectedOpportunity, "id">,
): Promise<DetectedOpportunity | null> {
  const { data, error } = await supabase
    .from("detected_opportunities")
    .insert({
      user_id: userId,
      business_profile_id: businessProfileId,
      opportunity_type: opportunity.type,
      topic: opportunity.topic,
      statement: opportunity.statement,
      why_now: opportunity.whyNow,
      expected_outcome: opportunity.expectedOutcome,
      evidence: opportunity.evidence,
      contributing_providers: opportunity.contributingProviders,
      confidence: opportunity.confidence,
      score_total: opportunity.score.total,
      score_evidence_strength: opportunity.score.evidenceStrength,
      score_business_impact: opportunity.score.businessImpact,
      score_urgency: opportunity.score.urgency,
      score_confidence: opportunity.score.confidence,
      score_historical_success: opportunity.score.historicalSuccess,
      status: opportunity.status,
      related_action_type: opportunity.relatedActionType,
      first_detected_at: opportunity.firstDetectedAt,
      last_seen_at: opportunity.lastSeenAt,
    })
    .select("*")
    .single();

  if (error || !data) return null;
  return mapRow(data as Record<string, unknown>);
}

/** Refresh an opportunity still being re-detected — evidence, score, and
 * last_seen_at move forward; identity (first_detected_at) never changes. */
export async function refreshOpportunity(
  supabase: SupabaseClient,
  opportunityId: string,
  opportunity: DetectedOpportunity,
): Promise<void> {
  await supabase
    .from("detected_opportunities")
    .update({
      statement: opportunity.statement,
      why_now: opportunity.whyNow,
      expected_outcome: opportunity.expectedOutcome,
      evidence: opportunity.evidence,
      contributing_providers: opportunity.contributingProviders,
      confidence: opportunity.confidence,
      score_total: opportunity.score.total,
      score_evidence_strength: opportunity.score.evidenceStrength,
      score_business_impact: opportunity.score.businessImpact,
      score_urgency: opportunity.score.urgency,
      score_confidence: opportunity.score.confidence,
      score_historical_success: opportunity.score.historicalSuccess,
      last_seen_at: opportunity.lastSeenAt,
    })
    .eq("id", opportunityId);
}

export async function retireOpportunity(
  supabase: SupabaseClient,
  opportunityId: string,
  reason: "completed" | "expired",
  now: Date,
): Promise<void> {
  await supabase
    .from("detected_opportunities")
    .update({
      status: reason,
      retired_at: now.toISOString(),
      retired_reason: reason,
    })
    .eq("id", opportunityId);
}

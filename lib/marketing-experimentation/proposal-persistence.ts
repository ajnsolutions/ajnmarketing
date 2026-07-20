/**
 * Batched Supabase access for marketing_experiment_proposals.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlannedExperimentProposalDraft } from "@/lib/marketing-experimentation/proposal-types";
import {
  type ExperimentProposalStatus,
  type MarketingExperimentProposal,
} from "@/lib/marketing-experimentation/proposal-types";
import type { ExperimentKpiMetric, ExperimentType, ExperimentVariant } from "@/lib/marketing-experimentation/experiment-types";

function mapProposalRow(row: Record<string, unknown>): MarketingExperimentProposal {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    business_profile_id: String(row.business_profile_id),
    recommendation_id: String(row.recommendation_id),
    campaign_id: row.campaign_id ? String(row.campaign_id) : null,
    experiment_type: row.experiment_type as ExperimentType,
    title: String(row.title),
    hypothesis: String(row.hypothesis),
    control_definition: row.control_definition as ExperimentVariant,
    treatment_definition: row.treatment_definition as ExperimentVariant,
    primary_kpi: row.primary_kpi as ExperimentKpiMetric,
    secondary_kpis: (row.secondary_kpis as ExperimentKpiMetric[]) ?? [],
    measurement_window_days: Number(row.measurement_window_days),
    proposal_status: row.proposal_status as ExperimentProposalStatus,
    decision_reason: String(row.decision_reason),
    marketing_director_decision_key: String(row.marketing_director_decision_key),
    template_id: String(row.template_id),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    approved_at: row.approved_at ? String(row.approved_at) : null,
    approved_by: row.approved_by ? String(row.approved_by) : null,
    converted_experiment_id: row.converted_experiment_id ? String(row.converted_experiment_id) : null,
  };
}

/** Server-side (service-role) insert only — see proposal-service.ts. */
export async function insertMarketingExperimentProposal(
  supabase: SupabaseClient,
  draft: PlannedExperimentProposalDraft,
): Promise<{ proposal: MarketingExperimentProposal | null; error: { message?: string } | null }> {
  const { data, error } = await supabase
    .from("marketing_experiment_proposals")
    .insert({
      user_id: draft.user_id,
      business_profile_id: draft.business_profile_id,
      recommendation_id: draft.recommendation_id,
      campaign_id: draft.campaign_id,
      experiment_type: draft.experiment_type,
      title: draft.title,
      hypothesis: draft.hypothesis,
      control_definition: draft.control_definition,
      treatment_definition: draft.treatment_definition,
      primary_kpi: draft.primary_kpi,
      secondary_kpis: draft.secondary_kpis,
      measurement_window_days: draft.measurement_window_days,
      decision_reason: draft.decision_reason,
      marketing_director_decision_key: draft.marketing_director_decision_key,
      template_id: draft.template_id,
    })
    .select("*")
    .single();

  if (error || !data) {
    return { proposal: null, error: error ?? { message: "No row returned" } };
  }
  return { proposal: mapProposalRow(data as Record<string, unknown>), error: null };
}

export async function getExperimentProposalForUser(
  supabase: SupabaseClient,
  userId: string,
  proposalId: string,
): Promise<MarketingExperimentProposal | null> {
  const { data, error } = await supabase
    .from("marketing_experiment_proposals")
    .select("*")
    .eq("user_id", userId)
    .eq("id", proposalId)
    .maybeSingle();

  if (error || !data) return null;
  return mapProposalRow(data as Record<string, unknown>);
}

export async function listPendingExperimentProposalsForBusiness(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
): Promise<MarketingExperimentProposal[]> {
  const { data, error } = await supabase
    .from("marketing_experiment_proposals")
    .select("*")
    .eq("user_id", userId)
    .eq("business_profile_id", businessProfileId)
    .eq("proposal_status", "pending")
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data.map((row: Record<string, unknown>) => mapProposalRow(row));
}

/** Any pending proposal already covering this recommendation + experiment type (duplicate guard). */
export async function findPendingProposalForRecommendation(
  supabase: SupabaseClient,
  businessProfileId: string,
  recommendationId: string,
  experimentType: ExperimentType,
): Promise<MarketingExperimentProposal | null> {
  const { data, error } = await supabase
    .from("marketing_experiment_proposals")
    .select("*")
    .eq("business_profile_id", businessProfileId)
    .eq("recommendation_id", recommendationId)
    .eq("experiment_type", experimentType)
    .eq("proposal_status", "pending")
    .maybeSingle();

  if (error || !data) return null;
  return mapProposalRow(data as Record<string, unknown>);
}

/**
 * Atomic compare-and-swap: only succeeds if the proposal is currently `pending`. Callers
 * use this to safely resolve concurrent approval requests — see
 * proposal-service.ts's approveExperimentProposalForUser.
 */
export async function markProposalApprovedIfPending(
  supabase: SupabaseClient,
  userId: string,
  proposalId: string,
  approvedBy: string,
): Promise<MarketingExperimentProposal | null> {
  const { data, error } = await supabase
    .from("marketing_experiment_proposals")
    .update({
      proposal_status: "approved",
      approved_at: new Date().toISOString(),
      approved_by: approvedBy,
    })
    .eq("id", proposalId)
    .eq("user_id", userId)
    .eq("proposal_status", "pending")
    .select("*")
    .maybeSingle();

  if (error || !data) return null;
  return mapProposalRow(data as Record<string, unknown>);
}

export async function markProposalExpired(
  supabase: SupabaseClient,
  userId: string,
  proposalId: string,
): Promise<void> {
  await supabase
    .from("marketing_experiment_proposals")
    .update({ proposal_status: "expired" })
    .eq("id", proposalId)
    .eq("user_id", userId)
    .eq("proposal_status", "pending");
}

export async function attachConvertedExperiment(
  supabase: SupabaseClient,
  userId: string,
  proposalId: string,
  experimentId: string,
): Promise<void> {
  await supabase
    .from("marketing_experiment_proposals")
    .update({ converted_experiment_id: experimentId })
    .eq("id", proposalId)
    .eq("user_id", userId);
}

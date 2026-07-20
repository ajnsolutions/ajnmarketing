/**
 * Batched Supabase access for marketing_experiments.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ACTIVE_EXPERIMENT_STATUSES,
  COMPLETED_EXPERIMENT_STATUSES,
} from "@/lib/marketing-experimentation/experiment-state";
import {
  type ExperimentMetrics,
  type ExperimentOutcome,
  type ExperimentStatus,
  type ExperimentType,
  type ExperimentVariant,
  type MarketingExperiment,
} from "@/lib/marketing-experimentation/experiment-types";

/**
 * Experiments may only be created by converting an approved proposal — see
 * proposal-service.ts's resolveConvertedExperiment, the only caller of
 * insertMarketingExperiment. source_proposal_id is required here at the application
 * layer; migration 029's enforce_marketing_experiment_requires_approved_proposal trigger
 * enforces the same requirement (plus tenant/type/recommendation/campaign matching) at
 * the database layer independent of this code.
 */
export type ExperimentInsertDraft = {
  experiment_type: ExperimentType;
  title: string;
  hypothesis: string;
  status: ExperimentStatus;
  variants: ExperimentVariant[];
  outcome: ExperimentOutcome;
  metrics: ExperimentMetrics;
  created_from_recommendation_id: string;
  related_campaign_id: string | null;
  marketing_director_decision_key: string;
  template_id: string;
  source_proposal_id: string;
  started_at: string | null;
  measured_at: string | null;
  completed_at: string | null;
  schema_version: number;
};

function mapExperimentRow(row: Record<string, unknown>): MarketingExperiment {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    business_profile_id: String(row.business_profile_id),
    experiment_type: row.experiment_type as ExperimentType,
    title: String(row.title),
    hypothesis: String(row.hypothesis),
    status: row.status as ExperimentStatus,
    variants: (row.variants as ExperimentVariant[]) ?? [],
    outcome: row.outcome as ExperimentOutcome,
    metrics: row.metrics as ExperimentMetrics,
    created_from_recommendation_id: String(row.created_from_recommendation_id),
    related_campaign_id: row.related_campaign_id
      ? String(row.related_campaign_id)
      : null,
    marketing_director_decision_key: String(row.marketing_director_decision_key),
    template_id: String(row.template_id),
    source_proposal_id: row.source_proposal_id ? String(row.source_proposal_id) : null,
    started_at: row.started_at ? String(row.started_at) : null,
    measured_at: row.measured_at ? String(row.measured_at) : null,
    completed_at: row.completed_at ? String(row.completed_at) : null,
    schema_version: Number(row.schema_version ?? 1),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function insertMarketingExperiment(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
  draft: ExperimentInsertDraft,
): Promise<{ experiment: MarketingExperiment | null; error: { message?: string } | null }> {
  const { data, error } = await supabase
    .from("marketing_experiments")
    .insert({
      user_id: userId,
      business_profile_id: businessProfileId,
      experiment_type: draft.experiment_type,
      title: draft.title,
      hypothesis: draft.hypothesis,
      status: draft.status,
      variants: draft.variants,
      outcome: draft.outcome,
      metrics: draft.metrics,
      created_from_recommendation_id: draft.created_from_recommendation_id,
      related_campaign_id: draft.related_campaign_id,
      marketing_director_decision_key: draft.marketing_director_decision_key,
      template_id: draft.template_id,
      source_proposal_id: draft.source_proposal_id,
      schema_version: draft.schema_version,
    })
    .select("*")
    .single();

  if (error || !data) {
    return { experiment: null, error: error ?? { message: "No row returned" } };
  }
  return { experiment: mapExperimentRow(data as Record<string, unknown>), error: null };
}

export async function getMarketingExperimentForUser(
  supabase: SupabaseClient,
  userId: string,
  experimentId: string,
): Promise<MarketingExperiment | null> {
  const { data, error } = await supabase
    .from("marketing_experiments")
    .select("*")
    .eq("user_id", userId)
    .eq("id", experimentId)
    .maybeSingle();

  if (error || !data) return null;
  return mapExperimentRow(data as Record<string, unknown>);
}

export async function listMarketingExperimentsForBusiness(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
  limit = 50,
): Promise<MarketingExperiment[]> {
  const { data, error } = await supabase
    .from("marketing_experiments")
    .select("*")
    .eq("user_id", userId)
    .eq("business_profile_id", businessProfileId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data.map((row: Record<string, unknown>) => mapExperimentRow(row));
}

export async function listActiveMarketingExperimentsForBusiness(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
): Promise<MarketingExperiment[]> {
  const { data, error } = await supabase
    .from("marketing_experiments")
    .select("*")
    .eq("user_id", userId)
    .eq("business_profile_id", businessProfileId)
    .in("status", [...ACTIVE_EXPERIMENT_STATUSES])
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data.map((row: Record<string, unknown>) => mapExperimentRow(row));
}

export async function listCompletedMarketingExperimentsForBusiness(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
  limit = 20,
): Promise<MarketingExperiment[]> {
  const { data, error } = await supabase
    .from("marketing_experiments")
    .select("*")
    .eq("user_id", userId)
    .eq("business_profile_id", businessProfileId)
    .in("status", [...COMPLETED_EXPERIMENT_STATUSES])
    .order("completed_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data.map((row: Record<string, unknown>) => mapExperimentRow(row));
}

export async function updateMarketingExperimentFields(
  supabase: SupabaseClient,
  userId: string,
  experimentId: string,
  fields: Partial<
    Pick<
      MarketingExperiment,
      | "status"
      | "outcome"
      | "metrics"
      | "started_at"
      | "measured_at"
      | "completed_at"
    >
  >,
): Promise<{ experiment: MarketingExperiment | null; error: { message?: string } | null }> {
  const { data, error } = await supabase
    .from("marketing_experiments")
    .update(fields)
    .eq("user_id", userId)
    .eq("id", experimentId)
    .select("*")
    .single();

  if (error || !data) {
    return { experiment: null, error: error ?? { message: "No row returned" } };
  }
  return { experiment: mapExperimentRow(data as Record<string, unknown>), error: null };
}

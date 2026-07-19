/**
 * Batched Supabase access for marketing_campaigns. No N+1 loops.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlannedCampaignDraft } from "@/lib/campaign-intelligence/campaign-planner";
import { ACTIVE_CAMPAIGN_STATUSES } from "@/lib/campaign-intelligence/campaign-state";
import {
  type CampaignMetrics,
  type CampaignStatus,
  type CampaignTimelineStep,
  type CampaignType,
  type MarketingCampaign,
} from "@/lib/campaign-intelligence/campaign-types";

function mapCampaignRow(row: Record<string, unknown>): MarketingCampaign {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    business_profile_id: String(row.business_profile_id),
    campaign_type: row.campaign_type as CampaignType,
    objective: String(row.objective),
    status: row.status as CampaignStatus,
    start_date: row.start_date ? String(row.start_date) : null,
    target_end_date: row.target_end_date ? String(row.target_end_date) : null,
    current_step_index: Number(row.current_step_index ?? 0),
    timeline: (row.timeline as CampaignTimelineStep[]) ?? [],
    metrics: (row.metrics as CampaignMetrics) ?? {
      completionRate: 0,
      stepsCompleted: 0,
      stepsSkipped: 0,
      stepsTotal: 0,
      engagement: 0,
      publishingConsistency: 0,
      reviewActivity: 0,
      recommendationAcceptance: 0,
      campaignDurationDays: null,
      campaignCompletionTimeDays: null,
    },
    created_from_recommendation_id: row.created_from_recommendation_id
      ? String(row.created_from_recommendation_id)
      : null,
    marketing_director_decision_key: row.marketing_director_decision_key
      ? String(row.marketing_director_decision_key)
      : null,
    template_id: String(row.template_id),
    schema_version: Number(row.schema_version ?? 1),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function insertMarketingCampaign(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
  draft: PlannedCampaignDraft,
): Promise<{ campaign: MarketingCampaign | null; error: { message?: string } | null }> {
  const { data, error } = await supabase
    .from("marketing_campaigns")
    .insert({
      user_id: userId,
      business_profile_id: businessProfileId,
      campaign_type: draft.campaign_type,
      objective: draft.objective,
      status: draft.status,
      start_date: draft.start_date,
      target_end_date: draft.target_end_date,
      current_step_index: draft.current_step_index,
      timeline: draft.timeline,
      metrics: draft.metrics,
      created_from_recommendation_id: draft.created_from_recommendation_id,
      marketing_director_decision_key: draft.marketing_director_decision_key,
      template_id: draft.template_id,
      schema_version: draft.schema_version,
    })
    .select("*")
    .single();

  if (error || !data) {
    return { campaign: null, error: error ?? { message: "No row returned" } };
  }
  return { campaign: mapCampaignRow(data as Record<string, unknown>), error: null };
}

export async function getMarketingCampaignForUser(
  supabase: SupabaseClient,
  userId: string,
  campaignId: string,
): Promise<MarketingCampaign | null> {
  const { data, error } = await supabase
    .from("marketing_campaigns")
    .select("*")
    .eq("user_id", userId)
    .eq("id", campaignId)
    .maybeSingle();

  if (error || !data) return null;
  return mapCampaignRow(data as Record<string, unknown>);
}

/** Single batched list — active campaigns first, then recent completed. */
export async function listMarketingCampaignsForBusiness(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
  limit = 20,
): Promise<MarketingCampaign[]> {
  const { data, error } = await supabase
    .from("marketing_campaigns")
    .select("*")
    .eq("user_id", userId)
    .eq("business_profile_id", businessProfileId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data.map((row: Record<string, unknown>) => mapCampaignRow(row));
}

export async function listActiveMarketingCampaignsForBusiness(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
): Promise<MarketingCampaign[]> {
  const { data, error } = await supabase
    .from("marketing_campaigns")
    .select("*")
    .eq("user_id", userId)
    .eq("business_profile_id", businessProfileId)
    .in("status", [...ACTIVE_CAMPAIGN_STATUSES])
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data.map((row: Record<string, unknown>) => mapCampaignRow(row));
}

export async function updateMarketingCampaignFields(
  supabase: SupabaseClient,
  userId: string,
  campaignId: string,
  fields: Partial<
    Pick<
      MarketingCampaign,
      "status" | "timeline" | "metrics" | "current_step_index" | "start_date" | "target_end_date"
    >
  >,
): Promise<{ campaign: MarketingCampaign | null; error: { message?: string } | null }> {
  const { data, error } = await supabase
    .from("marketing_campaigns")
    .update(fields)
    .eq("user_id", userId)
    .eq("id", campaignId)
    .select("*")
    .single();

  if (error || !data) {
    return { campaign: null, error: error ?? { message: "No row returned" } };
  }
  return { campaign: mapCampaignRow(data as Record<string, unknown>), error: null };
}

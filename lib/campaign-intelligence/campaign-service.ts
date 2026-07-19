/**
 * Campaign Intelligence service entrypoints — DI-friendly, batched reads.
 * Creation is Marketing Director–gated only.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { toCampaignDashboardCards } from "@/lib/campaign-intelligence/campaign-dashboard";
import {
  applyStepCompletion,
  applyStepSkip,
  progressCampaignLifecycle,
  shouldRecordCampaignCompletionObservation,
} from "@/lib/campaign-intelligence/campaign-engine";
import { planCampaignFromDirector } from "@/lib/campaign-intelligence/campaign-planner";
import {
  getMarketingCampaignForUser,
  insertMarketingCampaign,
  listActiveMarketingCampaignsForBusiness,
  listMarketingCampaignsForBusiness,
  updateMarketingCampaignFields,
} from "@/lib/campaign-intelligence/campaign-persistence";
import type {
  CampaignDashboardCard,
  InitiateCampaignInput,
  MarketingCampaign,
} from "@/lib/campaign-intelligence/campaign-types";
import { recordObservationForCampaignCompletion } from "@/lib/marketing-memory/service";
import { createClient } from "@/lib/supabase/server";

export type CampaignServiceDeps = {
  supabaseClient?: SupabaseClient;
  /** Injected for tests — defaults to Marketing Memory observation recorder. */
  recordCompletionObservation?: typeof recordObservationForCampaignCompletion;
};

async function resolveClient(deps?: CampaignServiceDeps): Promise<SupabaseClient> {
  return deps?.supabaseClient ?? (await createClient());
}

export async function initiateCampaignForBusiness(
  userId: string,
  businessProfileId: string,
  input: InitiateCampaignInput,
  deps?: CampaignServiceDeps,
): Promise<
  | { ok: true; campaign: MarketingCampaign }
  | { ok: false; status: number; error: string }
> {
  if (input.initiatedBy !== "marketing_director") {
    return {
      ok: false,
      status: 403,
      error: "Campaigns may only be initiated by Marketing Director.",
    };
  }

  let draft;
  try {
    draft = planCampaignFromDirector(input);
  } catch (err) {
    return {
      ok: false,
      status: 400,
      error: err instanceof Error ? err.message : "Invalid campaign initiation",
    };
  }

  const supabase = await resolveClient(deps);
  const { campaign, error } = await insertMarketingCampaign(
    supabase,
    userId,
    businessProfileId,
    draft,
  );

  if (!campaign) {
    return {
      ok: false,
      status: 500,
      error: error?.message ?? "Failed to create campaign",
    };
  }

  console.info("[CampaignIntelligence]", {
    scope: "campaign-intelligence",
    event: "campaign_initiated",
    businessProfileId,
    campaignId: campaign.id,
    campaignType: campaign.campaign_type,
    marketingDirectorDecisionKey: campaign.marketing_director_decision_key,
  });

  return { ok: true, campaign };
}

export async function getCampaignDashboardForBusiness(
  userId: string,
  businessProfileId: string,
  deps?: CampaignServiceDeps,
): Promise<CampaignDashboardCard[]> {
  const supabase = await resolveClient(deps);
  const campaigns = await listActiveMarketingCampaignsForBusiness(
    supabase,
    userId,
    businessProfileId,
  );
  return toCampaignDashboardCards(campaigns);
}

export async function listCampaignsForBusiness(
  userId: string,
  businessProfileId: string,
  deps?: CampaignServiceDeps,
): Promise<MarketingCampaign[]> {
  const supabase = await resolveClient(deps);
  return listMarketingCampaignsForBusiness(supabase, userId, businessProfileId);
}

export async function advanceCampaignForUser(
  userId: string,
  campaignId: string,
  deps?: CampaignServiceDeps,
): Promise<
  | { ok: true; campaign: MarketingCampaign }
  | { ok: false; status: number; error: string }
> {
  const supabase = await resolveClient(deps);
  const existing = await getMarketingCampaignForUser(supabase, userId, campaignId);
  if (!existing) {
    return { ok: false, status: 404, error: "Campaign not found" };
  }

  const previousStatus = existing.status;
  const next = progressCampaignLifecycle(existing);
  const { campaign, error } = await updateMarketingCampaignFields(
    supabase,
    userId,
    campaignId,
    next,
  );

  if (!campaign) {
    return { ok: false, status: 500, error: error?.message ?? "Update failed" };
  }

  if (shouldRecordCampaignCompletionObservation(previousStatus, campaign.status)) {
    const recorder =
      deps?.recordCompletionObservation ?? recordObservationForCampaignCompletion;
    await recorder(supabase, campaign);
  }

  return { ok: true, campaign };
}

export async function completeCampaignStepForUser(
  userId: string,
  campaignId: string,
  stepKey: string,
  deps?: CampaignServiceDeps,
): Promise<
  | { ok: true; campaign: MarketingCampaign }
  | { ok: false; status: number; error: string }
> {
  const supabase = await resolveClient(deps);
  const existing = await getMarketingCampaignForUser(supabase, userId, campaignId);
  if (!existing) {
    return { ok: false, status: 404, error: "Campaign not found" };
  }

  const previousStatus = existing.status;
  const next = applyStepCompletion(existing, stepKey, new Date().toISOString());
  const { campaign, error } = await updateMarketingCampaignFields(
    supabase,
    userId,
    campaignId,
    next,
  );

  if (!campaign) {
    return { ok: false, status: 500, error: error?.message ?? "Update failed" };
  }

  if (shouldRecordCampaignCompletionObservation(previousStatus, campaign.status)) {
    const recorder =
      deps?.recordCompletionObservation ?? recordObservationForCampaignCompletion;
    await recorder(supabase, campaign);
  }

  return { ok: true, campaign };
}

export async function skipCampaignStepForUser(
  userId: string,
  campaignId: string,
  stepKey: string,
  deps?: CampaignServiceDeps,
): Promise<
  | { ok: true; campaign: MarketingCampaign }
  | { ok: false; status: number; error: string }
> {
  const supabase = await resolveClient(deps);
  const existing = await getMarketingCampaignForUser(supabase, userId, campaignId);
  if (!existing) {
    return { ok: false, status: 404, error: "Campaign not found" };
  }

  const previousStatus = existing.status;
  const next = applyStepSkip(existing, stepKey);
  const { campaign, error } = await updateMarketingCampaignFields(
    supabase,
    userId,
    campaignId,
    next,
  );

  if (!campaign) {
    return { ok: false, status: 500, error: error?.message ?? "Update failed" };
  }

  if (shouldRecordCampaignCompletionObservation(previousStatus, campaign.status)) {
    const recorder =
      deps?.recordCompletionObservation ?? recordObservationForCampaignCompletion;
    await recorder(supabase, campaign);
  }

  return { ok: true, campaign };
}

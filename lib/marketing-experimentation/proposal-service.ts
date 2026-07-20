/**
 * Marketing Experiment Proposal service entrypoints.
 *
 * Two distinct trust boundaries, matching migration 029's RLS design:
 *
 * - `evaluateAndPersistExperimentProposalsForBusiness` INSERTS proposals. It is called
 *   only from app/api/admin/trigger-experiment-proposal-evaluation (admin-gated, uses
 *   the service-role client). It must never be called to answer a normal tenant request
 *   — see lib/supabase/service.ts's trust-boundary doc comment.
 * - `listExperimentProposalsForBusiness` and `approveExperimentProposalForUser` are
 *   normal tenant-facing operations, using the caller's own session-scoped client, same
 *   as every other read/write in this codebase.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getActiveMarketingRecommendationsForUser } from "@/lib/marketing-decisions/persistence";
import { getAnalyticsSnapshotsForUser } from "@/lib/analytics/analyticsPersistence";
import { evaluateExperimentEligibility, experimentTypeForRecommendedActionType } from "@/lib/marketing-director/experimentEligibility";
import { getExperimentTemplate, isSupportedExperimentType } from "@/lib/marketing-experimentation/experiment-templates";
import { emptyExperimentMetrics, emptyExperimentOutcome } from "@/lib/marketing-experimentation/experiment-outcomes";
import { insertMarketingExperiment, listMarketingExperimentsForBusiness } from "@/lib/marketing-experimentation/experiment-persistence";
import { ACTIVE_EXPERIMENT_STATUSES } from "@/lib/marketing-experimentation/experiment-state";
import {
  attachConvertedExperiment,
  findPendingProposalForRecommendation,
  getExperimentProposalForUser,
  insertMarketingExperimentProposal,
  listPendingExperimentProposalsForBusiness,
  markProposalApprovedIfPending,
  markProposalExpired,
} from "@/lib/marketing-experimentation/proposal-persistence";
import { toExperimentProposalCards, toExperimentProposalCard } from "@/lib/marketing-experimentation/proposal-dashboard";
import type { PlannedExperimentProposalDraft } from "@/lib/marketing-experimentation/proposal-types";
import type { ExperimentProposalCard, MarketingExperimentProposal } from "@/lib/marketing-experimentation/proposal-types";
import { ExperimentStatuses, type MarketingExperiment } from "@/lib/marketing-experimentation/experiment-types";

export const MIN_ANALYTICS_HISTORY_FOR_ELIGIBILITY = 3;
const MEASUREMENT_WINDOW_DAYS = 14;

export type ProposalEvaluationSummary = {
  evaluated: number;
  proposed: number;
  skipped: { recommendationId: string; reason: string }[];
};

/**
 * Server-side only. Evaluates every active recommendation for a business against the
 * deterministic eligibility rule and persists a proposal for each newly-eligible one.
 * Idempotent — a recommendation that already has a pending proposal or active experiment
 * of the matching type is skipped (evaluateExperimentEligibility's duplicate checks).
 */
export async function evaluateAndPersistExperimentProposalsForBusiness(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
): Promise<ProposalEvaluationSummary> {
  const recommendations = await getActiveMarketingRecommendationsForUser(supabase, userId);
  const snapshots = await getAnalyticsSnapshotsForUser(supabase, userId, MIN_ANALYTICS_HISTORY_FOR_ELIGIBILITY);
  const existingExperiments = await listMarketingExperimentsForBusiness(supabase, userId, businessProfileId, 200);

  const summary: ProposalEvaluationSummary = { evaluated: 0, proposed: 0, skipped: [] };

  for (const recommendation of recommendations) {
    if (recommendation.business_profile_id !== businessProfileId) continue;
    summary.evaluated += 1;

    const candidateExperimentType = experimentTypeForRecommendedActionType(
      recommendation.recommended_action_type,
    );

    const pending = candidateExperimentType
      ? await findPendingProposalForRecommendation(
          supabase,
          businessProfileId,
          recommendation.id,
          candidateExperimentType,
        )
      : null;

    const hasActiveExperimentForType = existingExperiments.some(
      (experiment) =>
        experiment.created_from_recommendation_id === recommendation.id &&
        experiment.experiment_type === candidateExperimentType &&
        ACTIVE_EXPERIMENT_STATUSES.includes(experiment.status),
    );

    const result = evaluateExperimentEligibility({
      recommendation: {
        id: recommendation.id,
        recommendedActionType: recommendation.recommended_action_type,
        status: recommendation.status,
      },
      analyticsSnapshotCount: snapshots.length,
      hasPendingProposalForType: Boolean(pending),
      hasActiveExperimentForType,
    });

    if (!result.eligible) {
      summary.skipped.push({ recommendationId: recommendation.id, reason: result.reason });
      continue;
    }

    const template = getExperimentTemplate(result.experimentType);
    if (!template || !template.supported) {
      summary.skipped.push({
        recommendationId: recommendation.id,
        reason: `experiment type "${result.experimentType}" has no supported template`,
      });
      continue;
    }

    const decisionKey = [
      "eligibility_rule_v1",
      new Date().toISOString(),
      recommendation.recommended_action_type,
      result.experimentType,
    ].join("|");

    const draft: PlannedExperimentProposalDraft = {
      user_id: userId,
      business_profile_id: businessProfileId,
      recommendation_id: recommendation.id,
      campaign_id: null,
      experiment_type: result.experimentType,
      title: template.title,
      hypothesis: template.defaultHypothesis,
      control_definition: template.variants[0]!,
      treatment_definition: template.variants[1]!,
      primary_kpi: template.primaryMetric,
      secondary_kpis: [],
      measurement_window_days: MEASUREMENT_WINDOW_DAYS,
      decision_reason: result.reason,
      marketing_director_decision_key: decisionKey,
      template_id: template.id,
    };

    const { proposal, error } = await insertMarketingExperimentProposal(supabase, draft);
    if (proposal) {
      summary.proposed += 1;
    } else {
      // Most likely the partial-unique "one pending proposal per rec+type" index — a
      // concurrent evaluation run already proposed this. Not an error worth surfacing.
      summary.skipped.push({
        recommendationId: recommendation.id,
        reason: error?.message ?? "insert failed",
      });
    }
  }

  return summary;
}

export async function listExperimentProposalsForBusiness(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
): Promise<ExperimentProposalCard[]> {
  const proposals = await listPendingExperimentProposalsForBusiness(supabase, userId, businessProfileId);
  return toExperimentProposalCards(proposals);
}

export type ApproveProposalResult =
  | { ok: true; experiment: MarketingExperiment }
  | { ok: false; status: number; error: string };

/**
 * Tenant-facing approval command. The server copies every authoritative field from the
 * persisted proposal — the client supplies only proposalId. Idempotent: a second
 * approval call for an already-converted proposal returns the same experiment rather
 * than erroring or creating a duplicate.
 */
export async function approveExperimentProposalForUser(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
  proposalId: string,
): Promise<ApproveProposalResult> {
  const existing = await getExperimentProposalForUser(supabase, userId, proposalId);
  if (!existing || existing.business_profile_id !== businessProfileId) {
    return { ok: false, status: 404, error: "Proposal not found" };
  }

  if (existing.proposal_status === "approved") {
    return await resolveConvertedExperiment(supabase, userId, existing);
  }

  if (existing.proposal_status !== "pending") {
    return { ok: false, status: 409, error: `Proposal is "${existing.proposal_status}" and can no longer be approved.` };
  }

  const recheck = await recheckProposalStillEligible(supabase, userId, existing);
  if (!recheck.ok) {
    await markProposalExpired(supabase, userId, proposalId);
    return { ok: false, status: 409, error: recheck.error };
  }

  const approved = await markProposalApprovedIfPending(supabase, userId, proposalId, userId);
  if (!approved) {
    // Lost a race with a concurrent approval request. Resolve to whatever the winner produced.
    const refreshed = await getExperimentProposalForUser(supabase, userId, proposalId);
    if (refreshed?.proposal_status === "approved") {
      return await resolveConvertedExperiment(supabase, userId, refreshed);
    }
    return { ok: false, status: 409, error: "Proposal could not be approved (concurrent update)." };
  }

  return await resolveConvertedExperiment(supabase, userId, approved);
}

async function recheckProposalStillEligible(
  supabase: SupabaseClient,
  userId: string,
  proposal: MarketingExperimentProposal,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: recommendation } = await supabase
    .from("marketing_recommendations")
    .select("id, status, business_profile_id, user_id")
    .eq("id", proposal.recommendation_id)
    .eq("user_id", userId)
    .eq("business_profile_id", proposal.business_profile_id)
    .maybeSingle();

  if (!recommendation || recommendation.status !== "open") {
    return { ok: false, error: "The recommendation this proposal was based on is no longer open." };
  }

  if (proposal.campaign_id) {
    const { data: campaign } = await supabase
      .from("marketing_campaigns")
      .select("id")
      .eq("id", proposal.campaign_id)
      .eq("user_id", userId)
      .eq("business_profile_id", proposal.business_profile_id)
      .maybeSingle();
    if (!campaign) {
      return { ok: false, error: "The campaign linked to this proposal is no longer available." };
    }
  }

  if (!isSupportedExperimentType(proposal.experiment_type)) {
    return { ok: false, error: `Experiment type "${proposal.experiment_type}" is no longer supported.` };
  }

  return { ok: true };
}

/** Converts an approved proposal into exactly one experiment, self-healing if a prior
 * attempt inserted the experiment but crashed before recording the link back. */
async function resolveConvertedExperiment(
  supabase: SupabaseClient,
  userId: string,
  proposal: MarketingExperimentProposal,
): Promise<ApproveProposalResult> {
  if (proposal.converted_experiment_id) {
    const { data } = await supabase
      .from("marketing_experiments")
      .select("*")
      .eq("id", proposal.converted_experiment_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (data) {
      return { ok: true, experiment: mapExperimentRowLoose(data) };
    }
  }

  // Self-heal: an experiment may already exist for this proposal (source_proposal_id is
  // unique) even if converted_experiment_id was never recorded, e.g. a crash between the
  // insert and the follow-up link-back update.
  const { data: existingByProposal } = await supabase
    .from("marketing_experiments")
    .select("*")
    .eq("source_proposal_id", proposal.id)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingByProposal) {
    await attachConvertedExperiment(supabase, userId, proposal.id, existingByProposal.id as string);
    return { ok: true, experiment: mapExperimentRowLoose(existingByProposal) };
  }

  const draft = {
    experiment_type: proposal.experiment_type,
    title: proposal.title,
    hypothesis: proposal.hypothesis,
    status: ExperimentStatuses.APPROVED,
    variants: [proposal.control_definition, proposal.treatment_definition],
    outcome: emptyExperimentOutcome(proposal.primary_kpi),
    metrics: emptyExperimentMetrics(proposal.primary_kpi),
    created_from_recommendation_id: proposal.recommendation_id,
    related_campaign_id: proposal.campaign_id,
    marketing_director_decision_key: proposal.marketing_director_decision_key,
    template_id: proposal.template_id,
    source_proposal_id: proposal.id,
    started_at: null,
    measured_at: null,
    completed_at: null,
    schema_version: 1,
  };

  const { experiment, error } = await insertMarketingExperiment(supabase, userId, proposal.business_profile_id, draft);
  if (!experiment) {
    return { ok: false, status: 500, error: error?.message ?? "Failed to create experiment from proposal" };
  }

  await attachConvertedExperiment(supabase, userId, proposal.id, experiment.id);
  return { ok: true, experiment };
}

// Loose row mapper for the ad-hoc selects above (avoids importing the persistence
// module's row mapper twice); shape matches MarketingExperiment exactly.
function mapExperimentRowLoose(row: Record<string, unknown>): MarketingExperiment {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    business_profile_id: String(row.business_profile_id),
    experiment_type: row.experiment_type as MarketingExperiment["experiment_type"],
    title: String(row.title),
    hypothesis: String(row.hypothesis),
    status: row.status as MarketingExperiment["status"],
    variants: (row.variants as MarketingExperiment["variants"]) ?? [],
    outcome: row.outcome as MarketingExperiment["outcome"],
    metrics: row.metrics as MarketingExperiment["metrics"],
    created_from_recommendation_id: String(row.created_from_recommendation_id),
    related_campaign_id: row.related_campaign_id ? String(row.related_campaign_id) : null,
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

export { toExperimentProposalCard };

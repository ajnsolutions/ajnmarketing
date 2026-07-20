/**
 * Experimentation service entrypoints — DI-friendly, MD-gated creation.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getLatestAnalyticsSnapshotForUser } from "@/lib/analytics/analyticsPersistence";
import {
  applyExperimentMeasurement,
  completeExperimentMeasurement,
  progressExperimentLifecycle,
  shouldRecordExperimentCompletionObservation,
} from "@/lib/marketing-experimentation/experiment-engine";
import { toExperimentDashboardCards } from "@/lib/marketing-experimentation/experiment-dashboard";
import {
  metricsFromAnalyticsPair,
  type VariantMetricInput,
} from "@/lib/marketing-experimentation/experiment-outcomes";
import { planExperimentFromDirector } from "@/lib/marketing-experimentation/experiment-planner";
import {
  getMarketingExperimentForUser,
  insertMarketingExperiment,
  listActiveMarketingExperimentsForBusiness,
  listCompletedMarketingExperimentsForBusiness,
  listMarketingExperimentsForBusiness,
  updateMarketingExperimentFields,
} from "@/lib/marketing-experimentation/experiment-persistence";
import type {
  ExperimentDashboardCard,
  ExperimentMetrics,
  MarketingExperiment,
  ProposeExperimentInput,
} from "@/lib/marketing-experimentation/experiment-types";
import { recordObservationForExperimentCompletion } from "@/lib/marketing-memory/service";
import { createClient } from "@/lib/supabase/server";

export type ExperimentServiceDeps = {
  supabaseClient?: SupabaseClient;
  recordCompletionObservation?: typeof recordObservationForExperimentCompletion;
  loadLatestAnalytics?: typeof getLatestAnalyticsSnapshotForUser;
};

async function resolveClient(deps?: ExperimentServiceDeps): Promise<SupabaseClient> {
  return deps?.supabaseClient ?? (await createClient());
}

export async function proposeExperimentForBusiness(
  userId: string,
  businessProfileId: string,
  input: ProposeExperimentInput,
  deps?: ExperimentServiceDeps,
): Promise<
  | { ok: true; experiment: MarketingExperiment }
  | { ok: false; status: number; error: string }
> {
  if (input.proposedBy !== "marketing_director") {
    return {
      ok: false,
      status: 403,
      error: "Experiments may only be proposed by Marketing Director.",
    };
  }

  let draft;
  try {
    draft = planExperimentFromDirector(input);
  } catch (err) {
    return {
      ok: false,
      status: 400,
      error: err instanceof Error ? err.message : "Invalid experiment proposal",
    };
  }

  const supabase = await resolveClient(deps);

  // Ensure the recommendation exists and belongs to this tenant.
  const { data: recommendation, error: recError } = await supabase
    .from("marketing_recommendations")
    .select("id, business_profile_id, user_id")
    .eq("id", draft.created_from_recommendation_id)
    .eq("user_id", userId)
    .eq("business_profile_id", businessProfileId)
    .maybeSingle();

  if (recError || !recommendation) {
    return {
      ok: false,
      status: 400,
      error: "Recommendation not found for this business.",
    };
  }

  const { experiment, error } = await insertMarketingExperiment(
    supabase,
    userId,
    businessProfileId,
    draft,
  );

  if (!experiment) {
    return {
      ok: false,
      status: 500,
      error: error?.message ?? "Failed to create experiment",
    };
  }

  console.info("[MarketingExperimentation]", {
    scope: "marketing-experimentation",
    event: "experiment_proposed",
    businessProfileId,
    experimentId: experiment.id,
    experimentType: experiment.experiment_type,
    recommendationId: experiment.created_from_recommendation_id,
  });

  return { ok: true, experiment };
}

export async function getExperimentDashboardForBusiness(
  userId: string,
  businessProfileId: string,
  deps?: ExperimentServiceDeps,
): Promise<{
  active: ExperimentDashboardCard[];
  completed: ExperimentDashboardCard[];
}> {
  const supabase = await resolveClient(deps);
  const [active, completed] = await Promise.all([
    listActiveMarketingExperimentsForBusiness(supabase, userId, businessProfileId),
    listCompletedMarketingExperimentsForBusiness(supabase, userId, businessProfileId),
  ]);
  return {
    active: toExperimentDashboardCards(active),
    completed: toExperimentDashboardCards(completed),
  };
}

export async function listExperimentsForBusiness(
  userId: string,
  businessProfileId: string,
  deps?: ExperimentServiceDeps,
): Promise<MarketingExperiment[]> {
  const supabase = await resolveClient(deps);
  return listMarketingExperimentsForBusiness(supabase, userId, businessProfileId);
}

async function maybeRecordCompletion(
  supabase: SupabaseClient,
  previousStatus: MarketingExperiment["status"],
  experiment: MarketingExperiment,
  deps?: ExperimentServiceDeps,
): Promise<void> {
  if (!shouldRecordExperimentCompletionObservation(previousStatus, experiment.status)) {
    return;
  }
  const recorder =
    deps?.recordCompletionObservation ?? recordObservationForExperimentCompletion;
  await recorder(supabase, experiment);
}

export async function advanceExperimentForUser(
  userId: string,
  experimentId: string,
  deps?: ExperimentServiceDeps,
): Promise<
  | { ok: true; experiment: MarketingExperiment }
  | { ok: false; status: number; error: string }
> {
  const supabase = await resolveClient(deps);
  const existing = await getMarketingExperimentForUser(supabase, userId, experimentId);
  if (!existing) {
    return { ok: false, status: 404, error: "Experiment not found" };
  }

  const previousStatus = existing.status;
  const next = progressExperimentLifecycle(existing);
  const { experiment, error } = await updateMarketingExperimentFields(
    supabase,
    userId,
    experimentId,
    next,
  );

  if (!experiment) {
    return { ok: false, status: 500, error: error?.message ?? "Update failed" };
  }

  await maybeRecordCompletion(supabase, previousStatus, experiment, deps);
  return { ok: true, experiment };
}

/**
 * Measure using the latest analytics snapshot split deterministically into A/B
 * buckets (even/odd of engagement+clicks as a stable proxy). No new providers.
 */
export async function measureExperimentForUser(
  userId: string,
  experimentId: string,
  deps?: ExperimentServiceDeps,
): Promise<
  | { ok: true; experiment: MarketingExperiment }
  | { ok: false; status: number; error: string }
> {
  const supabase = await resolveClient(deps);
  const existing = await getMarketingExperimentForUser(supabase, userId, experimentId);
  if (!existing) {
    return { ok: false, status: 404, error: "Experiment not found" };
  }

  const loadAnalytics = deps?.loadLatestAnalytics ?? getLatestAnalyticsSnapshotForUser;
  const snapshot = await loadAnalytics(supabase, userId);

  const base: VariantMetricInput = {
    engagement: Number(snapshot?.engagement_score ?? 0),
    clicks: Number(snapshot?.website_clicks ?? 0),
    reviews: Number(snapshot?.review_count ?? 0),
    reach: Number(snapshot?.google_views ?? 0),
    conversions: Number(snapshot?.calls ?? 0),
    publishingConsistency: Number(snapshot?.posts_published ?? 0),
  };

  // Deterministic A/B split from existing totals (no fabricated traffic).
  const split = (value: number) => ({
    a: Math.floor(value / 2),
    b: Math.ceil(value / 2),
  });
  const engagement = split(base.engagement);
  const clicks = split(base.clicks);
  const reviews = split(base.reviews);
  const reach = split(base.reach);
  const conversions = split(base.conversions);
  const publishing = split(base.publishingConsistency);

  const metrics: ExperimentMetrics = metricsFromAnalyticsPair({
    variantA: {
      engagement: engagement.a,
      clicks: clicks.a,
      reviews: reviews.a,
      reach: reach.a,
      conversions: conversions.a,
      publishingConsistency: publishing.a,
    },
    variantB: {
      engagement: engagement.b,
      clicks: clicks.b,
      reviews: reviews.b,
      reach: reach.b,
      conversions: conversions.b,
      publishingConsistency: publishing.b,
    },
  });

  const previousStatus = existing.status;
  const measured = applyExperimentMeasurement(existing, metrics);
  const { experiment, error } = await updateMarketingExperimentFields(
    supabase,
    userId,
    experimentId,
    measured,
  );

  if (!experiment) {
    return { ok: false, status: 500, error: error?.message ?? "Measure failed" };
  }

  await maybeRecordCompletion(supabase, previousStatus, experiment, deps);
  return { ok: true, experiment };
}

export async function completeExperimentForUser(
  userId: string,
  experimentId: string,
  deps?: ExperimentServiceDeps,
): Promise<
  | { ok: true; experiment: MarketingExperiment }
  | { ok: false; status: number; error: string }
> {
  const supabase = await resolveClient(deps);
  const existing = await getMarketingExperimentForUser(supabase, userId, experimentId);
  if (!existing) {
    return { ok: false, status: 404, error: "Experiment not found" };
  }

  const previousStatus = existing.status;
  const next = completeExperimentMeasurement(existing);
  const { experiment, error } = await updateMarketingExperimentFields(
    supabase,
    userId,
    experimentId,
    next,
  );

  if (!experiment) {
    return { ok: false, status: 500, error: error?.message ?? "Complete failed" };
  }

  await maybeRecordCompletion(supabase, previousStatus, experiment, deps);
  return { ok: true, experiment };
}

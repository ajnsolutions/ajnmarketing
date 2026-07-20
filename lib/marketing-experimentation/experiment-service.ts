/**
 * Experimentation service entrypoints.
 *
 * [Claude review, follow-up] Experiment creation no longer lives here. Experiments may
 * only be created by approving a persisted, server-authored proposal — see
 * proposal-service.ts's approveExperimentProposalForUser, the only remaining creation
 * path. The prior client-decision-key creation route (proposeExperimentForBusiness) is
 * removed entirely: it accepted marketingDirectorDecisionKey/experimentType/hypothesis
 * as opaque client-supplied fields with no server-side verification that Marketing
 * Director actually proposed the experiment.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getAnalyticsSnapshotsForUser } from "@/lib/analytics/analyticsPersistence";
import {
  applyExperimentMeasurement,
  completeExperimentMeasurement,
  progressExperimentLifecycle,
  shouldRecordExperimentCompletionObservation,
} from "@/lib/marketing-experimentation/experiment-engine";
import { toExperimentDashboardCards } from "@/lib/marketing-experimentation/experiment-dashboard";
import {
  getMarketingExperimentForUser,
  listActiveMarketingExperimentsForBusiness,
  listCompletedMarketingExperimentsForBusiness,
  listMarketingExperimentsForBusiness,
  updateMarketingExperimentFields,
} from "@/lib/marketing-experimentation/experiment-persistence";
import {
  ExperimentStatuses,
  type ExperimentDashboardCard,
  type MarketingExperiment,
} from "@/lib/marketing-experimentation/experiment-types";
import { recordObservationForExperimentCompletion } from "@/lib/marketing-memory/service";
import { createClient } from "@/lib/supabase/server";

export type ExperimentServiceDeps = {
  supabaseClient?: SupabaseClient;
  recordCompletionObservation?: typeof recordObservationForExperimentCompletion;
  loadAnalyticsHistory?: typeof getAnalyticsSnapshotsForUser;
};

async function resolveClient(deps?: ExperimentServiceDeps): Promise<SupabaseClient> {
  return deps?.supabaseClient ?? (await createClient());
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

const ANALYTICS_FIELD_BY_KPI: Record<string, string> = {
  engagement: "engagement_score",
  clicks: "website_clicks",
  reviews: "review_count",
  reach: "google_views",
  conversions: "calls",
  publishingConsistency: "posts_published",
};

/**
 * Measures the experiment's primary KPI as an honest aggregate over the measurement
 * window — never a per-variant comparison. See experiment-outcomes.ts's
 * aggregateObservedOutcome and docs/MARKETING_EXPERIMENTATION_ENGINE.md "Honest
 * measurement boundary". Sums the primary KPI across every analytics snapshot captured
 * since the experiment started running (or all available history if it has not started
 * — defensive only, the status guard below prevents this in practice).
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

  if (
    existing.status !== ExperimentStatuses.RUNNING &&
    existing.status !== ExperimentStatuses.MEASURING
  ) {
    return {
      ok: false,
      status: 409,
      error: `Cannot measure an experiment in status "${existing.status}". Measuring requires "running" or "measuring".`,
    };
  }

  const loadHistory = deps?.loadAnalyticsHistory ?? getAnalyticsSnapshotsForUser;
  const snapshots = await loadHistory(supabase, userId, 90);

  const field = ANALYTICS_FIELD_BY_KPI[existing.metrics.primaryMetric] ?? "engagement_score";
  const windowStart = existing.started_at ?? existing.created_at;
  const now = new Date().toISOString();
  const inWindow = snapshots.filter((snapshot) => snapshot.snapshot_date >= windowStart.slice(0, 10));

  const aggregateValue =
    inWindow.length === 0
      ? null
      : inWindow.reduce((sum, snapshot) => {
          const value = (snapshot as unknown as Record<string, unknown>)[field];
          return sum + (typeof value === "number" ? value : Number(value ?? 0));
        }, 0);

  const previousStatus = existing.status;
  const measured = applyExperimentMeasurement(existing, {
    aggregateValue,
    measurementStart: windowStart,
    measurementEnd: now,
  });
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

  if (existing.status !== ExperimentStatuses.MEASURING) {
    return {
      ok: false,
      status: 409,
      error: `Cannot complete an experiment in status "${existing.status}". Completing requires "measuring".`,
    };
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

/**
 * Deterministic campaign metrics — counts and rates only, no AI/ML scoring.
 */

import {
  CampaignStepStatuses,
  type CampaignMetrics,
  type CampaignTimelineStep,
} from "@/lib/campaign-intelligence/campaign-types";

function daysBetween(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const a = Date.parse(`${start}T12:00:00.000Z`);
  const b = Date.parse(`${end}T12:00:00.000Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.max(0, Math.round((b - a) / (1000 * 60 * 60 * 24)));
}

export type CampaignMetricsInput = {
  timeline: CampaignTimelineStep[];
  startDate: string | null;
  targetEndDate: string | null;
  completedAtDate?: string | null;
  /** Optional external signals — default 0 when absent. */
  engagement?: number;
  publishingConsistency?: number;
  reviewActivity?: number;
  recommendationAcceptance?: number;
};

export function emptyCampaignMetrics(): CampaignMetrics {
  return {
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
  };
}

export function computeCampaignMetrics(input: CampaignMetricsInput): CampaignMetrics {
  const stepsTotal = input.timeline.length;
  const stepsCompleted = input.timeline.filter(
    (step) => step.status === CampaignStepStatuses.COMPLETED,
  ).length;
  const stepsSkipped = input.timeline.filter(
    (step) => step.status === CampaignStepStatuses.SKIPPED,
  ).length;
  const accounted = stepsCompleted + stepsSkipped;
  const completionRate =
    stepsTotal === 0 ? 0 : Math.round((accounted / stepsTotal) * 1000) / 1000;

  return {
    completionRate,
    stepsCompleted,
    stepsSkipped,
    stepsTotal,
    engagement: input.engagement ?? 0,
    publishingConsistency: input.publishingConsistency ?? 0,
    reviewActivity: input.reviewActivity ?? 0,
    recommendationAcceptance: input.recommendationAcceptance ?? 0,
    campaignDurationDays: daysBetween(input.startDate, input.targetEndDate),
    campaignCompletionTimeDays: daysBetween(
      input.startDate,
      input.completedAtDate ?? null,
    ),
  };
}

/**
 * Campaign Intelligence Engine — pure orchestration of execution plans.
 *
 * Never creates recommendations. Never reprioritizes. Never overrides Marketing Director.
 * Completing a campaign yields metrics + a signal for Marketing Memory observations
 * (evidence only — no Learning writes).
 */

import { computeCampaignMetrics } from "@/lib/campaign-intelligence/campaign-metrics";
import {
  advanceCampaignStatus,
  canTransitionCampaignStatus,
} from "@/lib/campaign-intelligence/campaign-state";
import {
  completeTimelineStep,
  currentStepIndex,
  nextMilestone,
  orderTimeline,
  partitionTimeline,
  skipTimelineStep,
  timelineCompletionPercent,
} from "@/lib/campaign-intelligence/campaign-timeline";
import {
  CampaignStatuses,
  type CampaignMetrics,
  type CampaignStatus,
  type CampaignTimelineStep,
  type MarketingCampaign,
} from "@/lib/campaign-intelligence/campaign-types";

export type CampaignProgressSnapshot = {
  status: CampaignStatus;
  current_step_index: number;
  timeline: CampaignTimelineStep[];
  metrics: CampaignMetrics;
  nextMilestone: string | null;
  completionPercent: number;
  partitions: ReturnType<typeof partitionTimeline>;
};

function withRecomputedMetrics(
  campaign: Pick<MarketingCampaign, "timeline" | "start_date" | "target_end_date" | "status">,
  timeline: CampaignTimelineStep[],
  completedAtDate: string | null = null,
): CampaignMetrics {
  return computeCampaignMetrics({
    timeline,
    startDate: campaign.start_date,
    targetEndDate: campaign.target_end_date,
    completedAtDate:
      completedAtDate ??
      (campaign.status === CampaignStatuses.COMPLETED ||
      campaign.status === CampaignStatuses.MEASURED ||
      campaign.status === CampaignStatuses.ARCHIVED
        ? campaign.target_end_date
        : null),
  });
}

export function snapshotCampaign(
  campaign: Pick<
    MarketingCampaign,
    "status" | "current_step_index" | "timeline" | "metrics" | "start_date" | "target_end_date"
  >,
): CampaignProgressSnapshot {
  const timeline = orderTimeline(campaign.timeline);
  return {
    status: campaign.status,
    current_step_index: campaign.current_step_index,
    timeline,
    metrics: campaign.metrics,
    nextMilestone: nextMilestone(timeline),
    completionPercent: timelineCompletionPercent(timeline),
    partitions: partitionTimeline(timeline),
  };
}

/** Advance one lifecycle status when the transition is allowed. */
export function progressCampaignLifecycle(
  campaign: MarketingCampaign,
): Pick<MarketingCampaign, "status" | "metrics" | "current_step_index" | "timeline"> {
  const next = advanceCampaignStatus(campaign.status);
  if (next === campaign.status) {
    return {
      status: campaign.status,
      metrics: campaign.metrics,
      current_step_index: campaign.current_step_index,
      timeline: orderTimeline(campaign.timeline),
    };
  }

  const timeline = orderTimeline(campaign.timeline);
  const completedAtDate =
    next === CampaignStatuses.COMPLETED ||
    next === CampaignStatuses.MEASURED ||
    next === CampaignStatuses.ARCHIVED
      ? new Date().toISOString().slice(0, 10)
      : null;

  return {
    status: next,
    timeline,
    current_step_index: currentStepIndex(timeline),
    metrics: withRecomputedMetrics(campaign, timeline, completedAtDate),
  };
}

export function applyStepCompletion(
  campaign: MarketingCampaign,
  stepKey: string,
  completedAtIso: string,
): Pick<MarketingCampaign, "timeline" | "metrics" | "current_step_index" | "status"> {
  const timeline = completeTimelineStep(campaign.timeline, stepKey, completedAtIso);
  const allDone = timeline.every(
    (step) => step.status === "completed" || step.status === "skipped",
  );

  let status = campaign.status;
  if (
    allDone &&
    (status === CampaignStatuses.SCHEDULED || status === CampaignStatuses.IN_PROGRESS)
  ) {
    status = CampaignStatuses.COMPLETED;
  } else if (
    status === CampaignStatuses.SCHEDULED &&
    canTransitionCampaignStatus(status, CampaignStatuses.IN_PROGRESS)
  ) {
    status = CampaignStatuses.IN_PROGRESS;
  }

  const completedAtDate = status === CampaignStatuses.COMPLETED ? completedAtIso.slice(0, 10) : null;

  return {
    status,
    timeline,
    current_step_index: currentStepIndex(timeline),
    metrics: withRecomputedMetrics({ ...campaign, status }, timeline, completedAtDate),
  };
}

export function applyStepSkip(
  campaign: MarketingCampaign,
  stepKey: string,
): Pick<MarketingCampaign, "timeline" | "metrics" | "current_step_index" | "status"> {
  const timeline = skipTimelineStep(campaign.timeline, stepKey);
  const allDone = timeline.every(
    (step) => step.status === "completed" || step.status === "skipped",
  );
  let status = campaign.status;
  if (
    allDone &&
    (status === CampaignStatuses.SCHEDULED || status === CampaignStatuses.IN_PROGRESS)
  ) {
    status = CampaignStatuses.COMPLETED;
  }

  return {
    status,
    timeline,
    current_step_index: currentStepIndex(timeline),
    metrics: withRecomputedMetrics({ ...campaign, status }, timeline, null),
  };
}

/** True when campaign completion should emit a Marketing Memory observation. */
export function shouldRecordCampaignCompletionObservation(
  previousStatus: CampaignStatus,
  nextStatus: CampaignStatus,
): boolean {
  return (
    previousStatus !== CampaignStatuses.COMPLETED &&
    nextStatus === CampaignStatuses.COMPLETED
  );
}

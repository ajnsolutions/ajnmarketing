/**
 * Pure timeline helpers — ordering, milestone, progress. No DB.
 */

import {
  CampaignStepStatuses,
  type CampaignTemplate,
  type CampaignTimelineStep,
} from "@/lib/campaign-intelligence/campaign-types";

function addDaysIso(startDate: string, dayOffset: number): string {
  const date = new Date(`${startDate}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + dayOffset);
  return date.toISOString().slice(0, 10);
}

export function buildTimelineFromTemplate(
  template: CampaignTemplate,
  startDate: string | null,
): CampaignTimelineStep[] {
  const ordered = [...template.steps].sort((a, b) => {
    if (a.dayOffset !== b.dayOffset) return a.dayOffset - b.dayOffset;
    return a.key.localeCompare(b.key);
  });

  return ordered.map((step, index) => ({
    key: step.key,
    label: step.label,
    actionType: step.actionType,
    status: index === 0 ? CampaignStepStatuses.SCHEDULED : CampaignStepStatuses.PENDING,
    dayOffset: step.dayOffset,
    scheduledFor: startDate ? addDaysIso(startDate, step.dayOffset) : null,
    completedAt: null,
  }));
}

export function orderTimeline(steps: CampaignTimelineStep[]): CampaignTimelineStep[] {
  return [...steps].sort((a, b) => {
    if (a.dayOffset !== b.dayOffset) return a.dayOffset - b.dayOffset;
    return a.key.localeCompare(b.key);
  });
}

export function timelineCompletionPercent(steps: CampaignTimelineStep[]): number {
  if (steps.length === 0) return 0;
  const done = steps.filter(
    (step) =>
      step.status === CampaignStepStatuses.COMPLETED ||
      step.status === CampaignStepStatuses.SKIPPED,
  ).length;
  return Math.round((done / steps.length) * 100);
}

export function nextMilestone(steps: CampaignTimelineStep[]): string | null {
  const ordered = orderTimeline(steps);
  const next = ordered.find(
    (step) =>
      step.status === CampaignStepStatuses.PENDING ||
      step.status === CampaignStepStatuses.SCHEDULED ||
      step.status === CampaignStepStatuses.IN_PROGRESS ||
      step.status === CampaignStepStatuses.BLOCKED,
  );
  return next?.label ?? null;
}

export function completeTimelineStep(
  steps: CampaignTimelineStep[],
  stepKey: string,
  completedAtIso: string,
): CampaignTimelineStep[] {
  const marked = orderTimeline(steps).map((step) =>
    step.key === stepKey
      ? {
          ...step,
          status: CampaignStepStatuses.COMPLETED,
          completedAt: completedAtIso,
        }
      : step,
  );

  // After completing a step, schedule the next pending step deterministically.
  return marked.map((step, index, list) => {
    if (step.status !== CampaignStepStatuses.PENDING) return step;
    const priorIncomplete = list
      .slice(0, index)
      .some(
        (prior) =>
          prior.status !== CampaignStepStatuses.COMPLETED &&
          prior.status !== CampaignStepStatuses.SKIPPED,
      );
    if (!priorIncomplete) {
      return { ...step, status: CampaignStepStatuses.SCHEDULED };
    }
    return step;
  });
}

export function skipTimelineStep(
  steps: CampaignTimelineStep[],
  stepKey: string,
): CampaignTimelineStep[] {
  return orderTimeline(steps).map((step) =>
    step.key === stepKey
      ? { ...step, status: CampaignStepStatuses.SKIPPED, completedAt: null }
      : step,
  );
}

export function currentStepIndex(steps: CampaignTimelineStep[]): number {
  const ordered = orderTimeline(steps);
  const idx = ordered.findIndex(
    (step) =>
      step.status === CampaignStepStatuses.SCHEDULED ||
      step.status === CampaignStepStatuses.IN_PROGRESS ||
      step.status === CampaignStepStatuses.PENDING,
  );
  return idx === -1 ? Math.max(0, ordered.length - 1) : idx;
}

export function partitionTimeline(steps: CampaignTimelineStep[]) {
  const ordered = orderTimeline(steps);
  return {
    scheduled: ordered.filter((step) => step.status === CampaignStepStatuses.SCHEDULED),
    completed: ordered.filter((step) => step.status === CampaignStepStatuses.COMPLETED),
    pending: ordered.filter((step) => step.status === CampaignStepStatuses.PENDING),
    blocked: ordered.filter((step) => step.status === CampaignStepStatuses.BLOCKED),
    missed: ordered.filter((step) => step.status === CampaignStepStatuses.MISSED),
  };
}

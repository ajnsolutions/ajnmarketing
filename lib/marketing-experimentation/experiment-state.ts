/**
 * Deterministic experiment lifecycle transitions.
 */

import {
  ExperimentStatuses,
  type ExperimentStatus,
} from "@/lib/marketing-experimentation/experiment-types";

const TRANSITIONS: Record<ExperimentStatus, readonly ExperimentStatus[]> = {
  [ExperimentStatuses.DRAFT]: [ExperimentStatuses.PROPOSED],
  [ExperimentStatuses.PROPOSED]: [ExperimentStatuses.APPROVED],
  [ExperimentStatuses.APPROVED]: [ExperimentStatuses.RUNNING],
  [ExperimentStatuses.RUNNING]: [ExperimentStatuses.MEASURING],
  [ExperimentStatuses.MEASURING]: [ExperimentStatuses.COMPLETED],
  [ExperimentStatuses.COMPLETED]: [ExperimentStatuses.ARCHIVED],
  [ExperimentStatuses.ARCHIVED]: [],
};

export function canTransitionExperimentStatus(
  from: ExperimentStatus,
  to: ExperimentStatus,
): boolean {
  return TRANSITIONS[from].includes(to);
}

export function nextExperimentStatus(from: ExperimentStatus): ExperimentStatus | null {
  return TRANSITIONS[from][0] ?? null;
}

export function advanceExperimentStatus(from: ExperimentStatus): ExperimentStatus {
  return nextExperimentStatus(from) ?? from;
}

export const ACTIVE_EXPERIMENT_STATUSES: readonly ExperimentStatus[] = [
  ExperimentStatuses.DRAFT,
  ExperimentStatuses.PROPOSED,
  ExperimentStatuses.APPROVED,
  ExperimentStatuses.RUNNING,
  ExperimentStatuses.MEASURING,
];

export function isActiveExperimentStatus(status: ExperimentStatus): boolean {
  return ACTIVE_EXPERIMENT_STATUSES.includes(status);
}

export const COMPLETED_EXPERIMENT_STATUSES: readonly ExperimentStatus[] = [
  ExperimentStatuses.COMPLETED,
  ExperimentStatuses.ARCHIVED,
];

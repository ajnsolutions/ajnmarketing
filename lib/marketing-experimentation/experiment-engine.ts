/**
 * Pure experiment lifecycle + measurement helpers.
 */

import {
  computeExperimentOutcome,
  emptyExperimentOutcome,
} from "@/lib/marketing-experimentation/experiment-outcomes";
import { getExperimentTemplate } from "@/lib/marketing-experimentation/experiment-templates";
import {
  advanceExperimentStatus,
  canTransitionExperimentStatus,
} from "@/lib/marketing-experimentation/experiment-state";
import {
  ExperimentStatuses,
  type ExperimentMetrics,
  type ExperimentStatus,
  type MarketingExperiment,
} from "@/lib/marketing-experimentation/experiment-types";

export function progressExperimentLifecycle(
  experiment: MarketingExperiment,
): Pick<
  MarketingExperiment,
  "status" | "started_at" | "measured_at" | "completed_at" | "outcome" | "metrics"
> {
  const next = advanceExperimentStatus(experiment.status);
  if (next === experiment.status) {
    return {
      status: experiment.status,
      started_at: experiment.started_at,
      measured_at: experiment.measured_at,
      completed_at: experiment.completed_at,
      outcome: experiment.outcome,
      metrics: experiment.metrics,
    };
  }

  const now = new Date().toISOString();
  return {
    status: next,
    started_at:
      next === ExperimentStatuses.RUNNING ? now : experiment.started_at,
    measured_at:
      next === ExperimentStatuses.MEASURING || next === ExperimentStatuses.COMPLETED
        ? now
        : experiment.measured_at,
    completed_at:
      next === ExperimentStatuses.COMPLETED ? now : experiment.completed_at,
    outcome: experiment.outcome,
    metrics: experiment.metrics,
  };
}

export function applyExperimentMeasurement(
  experiment: MarketingExperiment,
  metrics: ExperimentMetrics,
): Pick<MarketingExperiment, "metrics" | "outcome" | "status" | "measured_at"> {
  const template = getExperimentTemplate(experiment.experiment_type);
  const primaryMetric = template?.primaryMetric ?? "engagement";
  const outcome = computeExperimentOutcome({
    metrics,
    variants: experiment.variants,
    primaryMetric,
  });

  let status = experiment.status;
  if (
    status === ExperimentStatuses.RUNNING &&
    canTransitionExperimentStatus(status, ExperimentStatuses.MEASURING)
  ) {
    status = ExperimentStatuses.MEASURING;
  }

  return {
    metrics,
    outcome,
    status,
    measured_at: new Date().toISOString(),
  };
}

export function completeExperimentMeasurement(
  experiment: MarketingExperiment,
): Pick<MarketingExperiment, "status" | "outcome" | "completed_at"> {
  if (
    experiment.status !== ExperimentStatuses.MEASURING &&
    experiment.status !== ExperimentStatuses.RUNNING
  ) {
    return {
      status: experiment.status,
      outcome: experiment.outcome,
      completed_at: experiment.completed_at,
    };
  }

  const outcome =
    experiment.outcome.summary && experiment.outcome.summary !== emptyExperimentOutcome().summary
      ? experiment.outcome
      : experiment.outcome;

  return {
    status: ExperimentStatuses.COMPLETED,
    outcome,
    completed_at: new Date().toISOString(),
  };
}

export function shouldRecordExperimentCompletionObservation(
  previousStatus: ExperimentStatus,
  nextStatus: ExperimentStatus,
): boolean {
  return (
    previousStatus !== ExperimentStatuses.COMPLETED &&
    nextStatus === ExperimentStatuses.COMPLETED
  );
}

export function explainExperiment(experiment: MarketingExperiment): string {
  const parts = [
    experiment.title,
    `Status: ${experiment.status.replaceAll("_", " ")}.`,
    experiment.hypothesis,
  ];
  if (experiment.outcome.summary) {
    parts.push(experiment.outcome.summary);
  }
  if (experiment.outcome.confidenceLevel !== "insufficient") {
    parts.push(
      `Confidence: ${experiment.outcome.confidenceLevel.replaceAll("_", " ")}.`,
    );
  }
  return parts.join(" ");
}

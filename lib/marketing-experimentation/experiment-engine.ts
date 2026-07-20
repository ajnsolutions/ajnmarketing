/**
 * Pure experiment lifecycle + measurement helpers.
 */

import { aggregateObservedOutcome } from "@/lib/marketing-experimentation/experiment-outcomes";
import {
  advanceExperimentStatus,
  canTransitionExperimentStatus,
} from "@/lib/marketing-experimentation/experiment-state";
import {
  ExperimentStatuses,
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

/**
 * [Claude review] Defensive on its own, matching completeExperimentMeasurement: only
 * "running" or "measuring" experiments may be measured. Without this, a caller could
 * invoke this on a draft/proposed/approved experiment (before it has ever started) and
 * silently populate metrics/outcome while status stayed unchanged, or re-measure a
 * completed/archived experiment and silently overwrite its historical, already-recorded
 * outcome. The service layer (experiment-service.ts) rejects those cases before calling
 * here; this guard means the pure function is safe even if called directly.
 *
 * [Claude review, follow-up] Takes a single aggregate value, never per-variant metrics —
 * existing analytics have no per-variant attribution to give this function. The outcome
 * is always the honest "aggregate observed, attribution unavailable" result; see
 * aggregateObservedOutcome's doc comment.
 */
export function applyExperimentMeasurement(
  experiment: MarketingExperiment,
  measurement: { aggregateValue: number | null; measurementStart: string; measurementEnd: string },
): Pick<MarketingExperiment, "metrics" | "outcome" | "status" | "measured_at"> {
  if (
    experiment.status !== ExperimentStatuses.RUNNING &&
    experiment.status !== ExperimentStatuses.MEASURING
  ) {
    return {
      metrics: experiment.metrics,
      outcome: experiment.outcome,
      status: experiment.status,
      measured_at: experiment.measured_at,
    };
  }

  const primaryMetric = experiment.metrics.primaryMetric;
  const outcome = aggregateObservedOutcome({
    primaryMetric,
    aggregateValue: measurement.aggregateValue,
    measurementStart: measurement.measurementStart,
    measurementEnd: measurement.measurementEnd,
  });

  let status = experiment.status;
  if (
    status === ExperimentStatuses.RUNNING &&
    canTransitionExperimentStatus(status, ExperimentStatuses.MEASURING)
  ) {
    status = ExperimentStatuses.MEASURING;
  }

  return {
    metrics: {
      primaryMetric,
      aggregateValue: measurement.aggregateValue,
      measurementStart: measurement.measurementStart,
      measurementEnd: measurement.measurementEnd,
    },
    outcome,
    status,
    measured_at: new Date().toISOString(),
  };
}

/**
 * [Claude review] Only "measuring" may complete, matching the state matrix in
 * experiment-state.ts (measuring -> completed). A prior version also accepted "running",
 * silently skipping the measuring step and completing an experiment that had never been
 * measured — completed_at would be set while outcome/metrics were still whatever they
 * were before (typically the empty/insufficient defaults). The service layer
 * (experiment-service.ts) now rejects this case before calling here, but this function
 * stays defensive on its own — a pure function should not trust its caller for lifecycle
 * safety.
 */
export function completeExperimentMeasurement(
  experiment: MarketingExperiment,
): Pick<MarketingExperiment, "status" | "outcome" | "completed_at"> {
  if (experiment.status !== ExperimentStatuses.MEASURING) {
    return {
      status: experiment.status,
      outcome: experiment.outcome,
      completed_at: experiment.completed_at,
    };
  }

  return {
    status: ExperimentStatuses.COMPLETED,
    outcome: experiment.outcome,
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

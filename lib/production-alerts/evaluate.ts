import {
  AlertSeverities,
  type OpsAlert,
  type OpsAlertSnapshot,
} from "@/lib/production-alerts/types";
import { ATTACH_DECLARATIVE_PRODUCTION_CRONS } from "@/lib/trigger/scheduleActivation";
import { getFailureInjectionState } from "@/lib/failure-injection/gate";

export type AlertEvaluationInput = {
  now?: Date;
  publishingFailedCount?: number;
  publishingRetryingCount?: number;
  oauthDisconnectedCount?: number;
  recommendationExecutionFailures24h?: number;
  analyticsBacklogCount?: number;
  emailGenerationFailures24h?: number;
  approvalFailures24h?: number;
  highRetryJobCount?: number;
};

function countBySeverity(alerts: OpsAlert[]): OpsAlertSnapshot["counts"] {
  return {
    info: alerts.filter((a) => a.severity === AlertSeverities.INFO).length,
    warning: alerts.filter((a) => a.severity === AlertSeverities.WARNING).length,
    critical: alerts.filter((a) => a.severity === AlertSeverities.CRITICAL).length,
  };
}

/**
 * Pure alert evaluation from aggregated counters. No external notification providers.
 */
export function evaluateOpsAlerts(input: AlertEvaluationInput): OpsAlertSnapshot {
  const now = (input.now ?? new Date()).toISOString();
  const alerts: OpsAlert[] = [];

  if ((input.publishingFailedCount ?? 0) >= 3) {
    alerts.push({
      id: "publishing-repeated-failures",
      category: "publishing",
      severity: AlertSeverities.CRITICAL,
      title: "Repeated publishing failures",
      message: `${input.publishingFailedCount} publishing jobs are currently failed.`,
      detectedAt: now,
    });
  } else if ((input.publishingFailedCount ?? 0) > 0) {
    alerts.push({
      id: "publishing-failures",
      category: "publishing",
      severity: AlertSeverities.WARNING,
      title: "Publishing failures present",
      message: `${input.publishingFailedCount} publishing job(s) failed.`,
      detectedAt: now,
    });
  }

  if ((input.publishingRetryingCount ?? 0) >= 5 || (input.highRetryJobCount ?? 0) > 0) {
    alerts.push({
      id: "publishing-high-retries",
      category: "retries",
      severity: AlertSeverities.WARNING,
      title: "High publishing retry pressure",
      message: `${input.publishingRetryingCount ?? 0} retrying job(s); ${input.highRetryJobCount ?? 0} with elevated retry counts.`,
      detectedAt: now,
    });
  }

  if ((input.oauthDisconnectedCount ?? 0) > 0) {
    alerts.push({
      id: "oauth-disconnected",
      category: "oauth",
      severity: AlertSeverities.CRITICAL,
      title: "OAuth disconnect detected",
      message: `${input.oauthDisconnectedCount} Google Business connection(s) need reconnect.`,
      detectedAt: now,
    });
  }

  if ((input.recommendationExecutionFailures24h ?? 0) >= 3) {
    alerts.push({
      id: "recommendation-execution-failures",
      category: "recommendation_execution",
      severity: AlertSeverities.WARNING,
      title: "Recommendation execution failures",
      message: `${input.recommendationExecutionFailures24h} execution failure audit events in the last 24h.`,
      detectedAt: now,
    });
  }

  if ((input.analyticsBacklogCount ?? 0) >= 10) {
    alerts.push({
      id: "analytics-backlog",
      category: "analytics",
      severity: AlertSeverities.WARNING,
      title: "Analytics backlog",
      message: `${input.analyticsBacklogCount} businesses appear due/backlogged for analytics capture.`,
      detectedAt: now,
    });
  }

  if ((input.emailGenerationFailures24h ?? 0) > 0) {
    alerts.push({
      id: "email-generation-failures",
      category: "email",
      severity: AlertSeverities.WARNING,
      title: "Email / weekly package generation failures",
      message: `${input.emailGenerationFailures24h} related failure event(s) in the last 24h.`,
      detectedAt: now,
    });
  }

  if ((input.approvalFailures24h ?? 0) > 0) {
    alerts.push({
      id: "approval-failures",
      category: "approval",
      severity: AlertSeverities.WARNING,
      title: "Approval action failures",
      message: `${input.approvalFailures24h} approval/email-action failure event(s) in the last 24h.`,
      detectedAt: now,
    });
  }

  if (ATTACH_DECLARATIVE_PRODUCTION_CRONS) {
    alerts.push({
      id: "cron-gate-open",
      category: "schedules",
      severity: AlertSeverities.CRITICAL,
      title: "Production cron gate is open",
      message: "ATTACH_DECLARATIVE_PRODUCTION_CRONS is true. Confirm intentional schedule activation.",
      detectedAt: now,
    });
  }

  const injection = getFailureInjectionState();
  if (injection.enabled) {
    alerts.push({
      id: "failure-injection-enabled",
      category: "health",
      severity: AlertSeverities.CRITICAL,
      title: "Failure injection enabled",
      message: "Controlled failure injection is active. Disable before any production/pilot traffic.",
      detectedAt: now,
    });
  }

  return {
    generatedAt: now,
    alerts,
    counts: countBySeverity(alerts),
  };
}

import {
  LaunchRecommendations,
  type LaunchRecommendation,
  type PilotIssue,
  type PilotMetrics,
  type PilotReadinessDimension,
  type PilotReadinessScore,
} from "@/lib/assisted-pilot/types";
import { ATTACH_DECLARATIVE_PRODUCTION_CRONS } from "@/lib/trigger/scheduleActivation";

/**
 * Deterministic Pilot Readiness Score (never AI).
 *
 * Weights (sum = 100):
 * - workflow reliability 20
 * - publishing reliability 15
 * - analytics reliability 10
 * - recommendation quality 15
 * - approval success 15
 * - security findings 10
 * - operational findings 10
 * - documentation completeness 5
 *
 * Each dimension scores 0–100, then total = weighted average.
 */
export function computePilotReadinessScore(input: {
  metrics: PilotMetrics;
  openIssues: PilotIssue[];
  completionPercentage: number;
  documentationComplete?: boolean;
  scheduleGateOpen?: boolean;
}): PilotReadinessScore {
  const scheduleGateOpen = input.scheduleGateOpen ?? ATTACH_DECLARATIVE_PRODUCTION_CRONS;
  const openCritical = input.openIssues.filter((i) => i.severity === "critical" && i.status === "open");
  const openSecurity = input.openIssues.filter(
    (i) => i.category === "security" && (i.status === "open" || i.status === "in_progress")
  );
  const openOps = input.openIssues.filter(
    (i) =>
      (i.category === "operational" || i.category === "publishing" || i.category === "oauth") &&
      (i.status === "open" || i.status === "in_progress")
  );

  const workflowScore = clamp(
    input.completionPercentage -
      Math.min(40, input.metrics.workflowFailures * 8) -
      (openCritical.length > 0 ? 25 : 0)
  );

  const publishingScore = clamp(
    input.metrics.publishSuccess >= 1
      ? 100 - Math.min(50, Math.round(input.metrics.publishRetryRate * 100))
      : input.completionPercentage >= 70
        ? 40
        : 20
  );

  const analyticsScore = clamp(
    input.metrics.analyticsSuccess >= 1 ? 100 : input.completionPercentage >= 80 ? 50 : 25
  );

  const recommendationQualityScore = clamp(
    (input.metrics.averageRecommendationConfidence ?? 0.5) * 100 -
      Math.min(30, Math.round(input.metrics.rejectionRate * 40))
  );

  const approvalScore = clamp(
    input.metrics.recommendationsCreated === 0
      ? Math.min(40, input.completionPercentage / 2)
      : Math.round(input.metrics.approvalRate * 100) -
          Math.min(25, Math.round(input.metrics.rejectionRate * 50))
  );

  const securityScore = clamp(100 - openSecurity.length * 35 - openCritical.length * 20);
  const operationalScore = clamp(
    100 - openOps.length * 15 - Math.min(40, input.metrics.manualInterventions * 2)
  );
  const documentationScore = input.documentationComplete === false ? 40 : 100;

  // Gate open is a hard penalty — assisted pilot must not claim schedule readiness while open unexpectedly.
  const gatePenalty = scheduleGateOpen ? 30 : 0;

  const dimensions: PilotReadinessDimension[] = [
    {
      key: "workflow_reliability",
      label: "Workflow reliability",
      score: workflowScore,
      weight: 20,
      detail: `${input.completionPercentage}% checklist complete; ${input.metrics.workflowFailures} workflow failures.`,
    },
    {
      key: "publishing_reliability",
      label: "Publishing reliability",
      score: publishingScore,
      weight: 15,
      detail: `${input.metrics.publishSuccess} successful publishes; retry rate ${(
        input.metrics.publishRetryRate * 100
      ).toFixed(0)}%.`,
    },
    {
      key: "analytics_reliability",
      label: "Analytics reliability",
      score: analyticsScore,
      weight: 10,
      detail: `${input.metrics.analyticsSuccess} successful analytics captures.`,
    },
    {
      key: "recommendation_quality",
      label: "Recommendation quality",
      score: recommendationQualityScore,
      weight: 15,
      detail: `Avg confidence ${
        input.metrics.averageRecommendationConfidence == null
          ? "n/a"
          : input.metrics.averageRecommendationConfidence.toFixed(2)
      }; rejection rate ${(input.metrics.rejectionRate * 100).toFixed(0)}%.`,
    },
    {
      key: "approval_success",
      label: "Approval success",
      score: approvalScore,
      weight: 15,
      detail: `Approval rate ${(input.metrics.approvalRate * 100).toFixed(0)}%; edit rate ${(
        input.metrics.editRate * 100
      ).toFixed(0)}%.`,
    },
    {
      key: "security_findings",
      label: "Security findings",
      score: securityScore,
      weight: 10,
      detail: `${openSecurity.length} open security issue(s); ${openCritical.length} critical.`,
    },
    {
      key: "operational_findings",
      label: "Operational findings",
      score: operationalScore,
      weight: 10,
      detail: `${openOps.length} open operational issue(s); ${input.metrics.manualInterventions} manual interventions.`,
    },
    {
      key: "documentation_completeness",
      label: "Documentation completeness",
      score: documentationScore,
      weight: 5,
      detail: input.documentationComplete === false ? "Docs incomplete." : "ASSISTED_PILOT docs present.",
    },
  ];

  const weighted =
    dimensions.reduce((sum, d) => sum + d.score * d.weight, 0) /
    dimensions.reduce((sum, d) => sum + d.weight, 0);
  const total = clamp(Math.round(weighted - gatePenalty));

  return {
    total,
    dimensions,
    launchRecommendation: recommendLaunch(total, openCritical.length, scheduleGateOpen),
  };
}

export function recommendLaunch(
  total: number,
  openCriticalCount: number,
  scheduleGateOpen: boolean
): LaunchRecommendation {
  if (scheduleGateOpen || openCriticalCount > 0 || total < 40) {
    return LaunchRecommendations.NOT_READY;
  }
  if (total < 65) return LaunchRecommendations.PILOT_IN_PROGRESS;
  if (total < 85) return LaunchRecommendations.READY_FOR_LIMITED_PRODUCTION;
  return LaunchRecommendations.READY_FOR_SCHEDULE_ACTIVATION;
}

function clamp(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function emptyMetrics(): PilotMetrics {
  return {
    recommendationsCreated: 0,
    recommendationsApproved: 0,
    approvalRate: 0,
    editRate: 0,
    rejectionRate: 0,
    publishSuccess: 0,
    publishRetryRate: 0,
    analyticsSuccess: 0,
    averageApprovalTimeHours: null,
    averagePublishTimeHours: null,
    averageRecommendationConfidence: null,
    manualInterventions: 0,
    workflowFailures: 0,
  };
}

/** Pure metrics aggregation from counted inputs (unit-testable). */
export function computePilotMetrics(input: {
  recommendationsCreated: number;
  recommendationsApproved: number;
  recommendationsRejected: number;
  recommendationsEdited: number;
  publishSucceeded: number;
  publishRetryingOrFailed: number;
  publishAttempts: number;
  analyticsSuccess: number;
  averageApprovalTimeHours: number | null;
  averagePublishTimeHours: number | null;
  averageRecommendationConfidence: number | null;
  manualInterventions: number;
  workflowFailures: number;
}): PilotMetrics {
  const decided = input.recommendationsApproved + input.recommendationsRejected;
  const approvalRate = decided === 0 ? 0 : input.recommendationsApproved / decided;
  const rejectionRate = decided === 0 ? 0 : input.recommendationsRejected / decided;
  const editRate =
    input.recommendationsCreated === 0
      ? 0
      : input.recommendationsEdited / input.recommendationsCreated;
  const publishRetryRate =
    input.publishAttempts === 0 ? 0 : input.publishRetryingOrFailed / input.publishAttempts;

  return {
    recommendationsCreated: input.recommendationsCreated,
    recommendationsApproved: input.recommendationsApproved,
    approvalRate,
    editRate,
    rejectionRate,
    publishSuccess: input.publishSucceeded,
    publishRetryRate,
    analyticsSuccess: input.analyticsSuccess,
    averageApprovalTimeHours: input.averageApprovalTimeHours,
    averagePublishTimeHours: input.averagePublishTimeHours,
    averageRecommendationConfidence: input.averageRecommendationConfidence,
    manualInterventions: input.manualInterventions,
    workflowFailures: input.workflowFailures,
  };
}

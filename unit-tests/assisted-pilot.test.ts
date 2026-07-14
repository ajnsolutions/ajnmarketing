import test from "node:test";
import assert from "node:assert/strict";
import {
  computeCompletionPercentage,
  countManualActionsRemaining,
  defaultChecklistItems,
  transitionChecklistItem,
} from "../lib/assisted-pilot/checklist.ts";
import {
  computePilotMetrics,
  computePilotReadinessScore,
  recommendLaunch,
} from "../lib/assisted-pilot/readiness.ts";
import { LaunchRecommendations, PilotStageStatuses } from "../lib/assisted-pilot/types.ts";
import { ATTACH_DECLARATIVE_PRODUCTION_CRONS } from "../lib/trigger/scheduleActivation.ts";

test("ATTACH_DECLARATIVE_PRODUCTION_CRONS remains false for assisted pilot", () => {
  assert.equal(ATTACH_DECLARATIVE_PRODUCTION_CRONS, false);
});

test("checklist lifecycle: default stages, transitions, completion, remaining", () => {
  const items = defaultChecklistItems();
  assert.equal(items.length, 11);
  assert.equal(computeCompletionPercentage(items), 0);
  assert.equal(countManualActionsRemaining(items), 11);

  const now = "2026-07-14T12:00:00.000Z";
  const running = transitionChecklistItem(items[0], PilotStageStatuses.RUNNING, now);
  assert.equal(running.status, "running");
  assert.equal(running.startedAt, now);

  const completed = transitionChecklistItem(running, PilotStageStatuses.COMPLETED, "2026-07-14T12:01:00.000Z");
  assert.equal(completed.status, "completed");
  assert.equal(completed.finishedAt, "2026-07-14T12:01:00.000Z");

  const failed = transitionChecklistItem(items[1], PilotStageStatuses.FAILED, now, "boom");
  assert.equal(failed.status, "failed");
  assert.equal(failed.errorMessage, "boom");

  const mixed = items.map((item, index) =>
    index < 5 ? { ...item, status: PilotStageStatuses.COMPLETED } : item
  );
  assert.equal(computeCompletionPercentage(mixed), 45);
  assert.equal(countManualActionsRemaining(mixed), 6);
});

test("metrics aggregation computes rates safely", () => {
  const metrics = computePilotMetrics({
    recommendationsCreated: 10,
    recommendationsApproved: 6,
    recommendationsRejected: 2,
    recommendationsEdited: 3,
    publishSucceeded: 4,
    publishRetryingOrFailed: 1,
    publishAttempts: 5,
    analyticsSuccess: 2,
    averageApprovalTimeHours: 1.5,
    averagePublishTimeHours: 0.5,
    averageRecommendationConfidence: 0.72,
    manualInterventions: 3,
    workflowFailures: 1,
  });
  assert.equal(metrics.approvalRate, 0.75);
  assert.equal(metrics.rejectionRate, 0.25);
  assert.equal(metrics.editRate, 0.3);
  assert.equal(metrics.publishRetryRate, 0.2);

  const empty = computePilotMetrics({
    recommendationsCreated: 0,
    recommendationsApproved: 0,
    recommendationsRejected: 0,
    recommendationsEdited: 0,
    publishSucceeded: 0,
    publishRetryingOrFailed: 0,
    publishAttempts: 0,
    analyticsSuccess: 0,
    averageApprovalTimeHours: null,
    averagePublishTimeHours: null,
    averageRecommendationConfidence: null,
    manualInterventions: 0,
    workflowFailures: 0,
  });
  assert.equal(empty.approvalRate, 0);
  assert.equal(empty.publishRetryRate, 0);
});

test("readiness score is deterministic and advisory launch bands work", () => {
  const low = computePilotReadinessScore({
    metrics: computePilotMetrics({
      recommendationsCreated: 0,
      recommendationsApproved: 0,
      recommendationsRejected: 0,
      recommendationsEdited: 0,
      publishSucceeded: 0,
      publishRetryingOrFailed: 0,
      publishAttempts: 0,
      analyticsSuccess: 0,
      averageApprovalTimeHours: null,
      averagePublishTimeHours: null,
      averageRecommendationConfidence: null,
      manualInterventions: 0,
      workflowFailures: 5,
    }),
    openIssues: [
      {
        id: "1",
        pilotBusinessId: null,
        severity: "critical",
        category: "security",
        workflowStage: null,
        description: "blocker",
        status: "open",
        owner: null,
        resolution: null,
        createdAt: "2026-07-14T00:00:00.000Z",
        updatedAt: "2026-07-14T00:00:00.000Z",
      },
    ],
    completionPercentage: 10,
    documentationComplete: true,
    scheduleGateOpen: false,
  });
  assert.equal(low.launchRecommendation, LaunchRecommendations.NOT_READY);
  assert.ok(low.total < 40);

  const strong = computePilotReadinessScore({
    metrics: computePilotMetrics({
      recommendationsCreated: 20,
      recommendationsApproved: 18,
      recommendationsRejected: 1,
      recommendationsEdited: 2,
      publishSucceeded: 10,
      publishRetryingOrFailed: 0,
      publishAttempts: 10,
      analyticsSuccess: 8,
      averageApprovalTimeHours: 1,
      averagePublishTimeHours: 0.5,
      averageRecommendationConfidence: 0.9,
      manualInterventions: 2,
      workflowFailures: 0,
    }),
    openIssues: [],
    completionPercentage: 100,
    documentationComplete: true,
    scheduleGateOpen: false,
  });
  assert.ok(strong.total >= 85);
  assert.equal(
    strong.launchRecommendation,
    LaunchRecommendations.READY_FOR_SCHEDULE_ACTIVATION
  );

  assert.equal(recommendLaunch(90, 0, true), LaunchRecommendations.NOT_READY);
  assert.equal(recommendLaunch(70, 0, false), LaunchRecommendations.READY_FOR_LIMITED_PRODUCTION);
  assert.equal(recommendLaunch(50, 0, false), LaunchRecommendations.PILOT_IN_PROGRESS);
});

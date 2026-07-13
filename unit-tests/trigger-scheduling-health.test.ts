import test from "node:test";
import assert from "node:assert/strict";
import {
  getAutonomousSchedulingHealth,
  type RunsListClient,
  type SchedulesListClient,
} from "../lib/trigger/schedulingHealth.ts";
import { shouldRegenerateAiProfileForWebsiteAnalysis } from "../lib/recommendation-pipeline/orchestrator.ts";

function makeRun(
  id: string,
  taskIdentifier: string,
  status: string,
  iso: string,
  opts: { success?: boolean; failed?: boolean; finishedIso?: string } = {}
) {
  return {
    id,
    status,
    createdAt: new Date(iso),
    finishedAt: opts.finishedIso ? new Date(opts.finishedIso) : new Date(iso),
    taskIdentifier,
    isSuccess: opts.success ?? status === "COMPLETED",
    isFailed: opts.failed ?? status === "FAILED",
  };
}

test("getAutonomousSchedulingHealth separates sweep vs worker and reports next run", async () => {
  const runsClient: RunsListClient = {
    async *list(params) {
      const taskIdentifier = params.taskIdentifier as string;
      if (taskIdentifier === "recommendation-pipeline-sweep") {
        yield makeRun("sweep-1", taskIdentifier, "COMPLETED", "2026-07-15T14:00:00.000Z", {
          finishedIso: "2026-07-15T14:00:05.000Z",
        });
      }
      if (taskIdentifier === "recommendation-pipeline-for-tenant") {
        yield makeRun("tenant-1", taskIdentifier, "EXECUTING", "2026-07-15T14:01:00.000Z");
      }
      if (taskIdentifier === "publishing-due-sweep") {
        yield makeRun("pub-sweep", taskIdentifier, "FAILED", "2026-07-15T13:05:00.000Z", {
          failed: true,
          success: false,
          finishedIso: "2026-07-15T13:05:02.000Z",
        });
      }
    },
  };

  const schedulesClient: SchedulesListClient = {
    async *list() {
      yield {
        id: "sched-pipeline",
        task: "recommendation-pipeline-sweep",
        active: true,
        nextRun: new Date("2026-07-16T14:00:00.000Z"),
      };
      yield {
        id: "sched-other",
        task: "unrelated-task",
        active: true,
        nextRun: new Date("2026-07-16T00:00:00.000Z"),
      };
    },
  };

  const health = await getAutonomousSchedulingHealth(40, runsClient, schedulesClient);
  const sweep = health.subsystems.find((s) => s.taskIdentifier === "recommendation-pipeline-sweep")!;
  const tenant = health.subsystems.find(
    (s) => s.taskIdentifier === "recommendation-pipeline-for-tenant"
  )!;
  const publishing = health.subsystems.find((s) => s.taskIdentifier === "publishing-due-sweep")!;

  assert.equal(sweep.kind, "sweep");
  assert.equal(tenant.kind, "worker");
  assert.equal(sweep.nextScheduledRun?.toISOString(), "2026-07-16T14:00:00.000Z");
  assert.equal(tenant.currentlyExecutingOrQueued, true);
  assert.equal(publishing.lastFailure?.id, "pub-sweep");
  assert.equal(sweep.averageDurationMs, 5000);
  assert.equal(health.schedules.length, 1);
});

test("shouldRegenerateAiProfileForWebsiteAnalysis compares timestamps safely", () => {
  assert.equal(
    shouldRegenerateAiProfileForWebsiteAnalysis("2026-07-14T00:00:00.000Z", {
      analysis_status: "completed",
      updated_at: "2026-07-15T00:00:00.000Z",
    }),
    true
  );
  assert.equal(
    shouldRegenerateAiProfileForWebsiteAnalysis("2026-07-15T00:00:00.000Z", {
      analysis_status: "completed",
      updated_at: "2026-07-14T00:00:00.000Z",
    }),
    false
  );
  assert.equal(
    shouldRegenerateAiProfileForWebsiteAnalysis("2026-07-15T00:00:00.000Z", {
      analysis_status: "failed",
      updated_at: "2026-07-16T00:00:00.000Z",
    }),
    false
  );
});

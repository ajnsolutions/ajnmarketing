import test from "node:test";
import assert from "node:assert/strict";
import {
  getRecentRecommendationPipelineRuns,
  getRecommendationPipelineHealth,
} from "../lib/trigger/recommendationPipelineStatus.ts";
import type { RecommendationPipelineRunsListClient } from "../lib/trigger/recommendationPipelineStatus.ts";

function makeFakeRunsClient(
  runsByTask: Record<
    string,
    Array<{
      id: string;
      status: string;
      createdAt: Date;
      taskIdentifier: string;
      isSuccess: boolean;
      isFailed: boolean;
    }>
  >
): RecommendationPipelineRunsListClient {
  return {
    async *list(params) {
      const taskIdentifier = params.taskIdentifier as string;
      for (const run of runsByTask[taskIdentifier] ?? []) {
        yield run;
      }
    },
  };
}

test("getRecentRecommendationPipelineRuns queries the recommendation-pipeline-for-tenant task identifier", async () => {
  const queriedTaskIdentifiers: string[] = [];
  const client: RecommendationPipelineRunsListClient = {
    async *list(params) {
      queriedTaskIdentifiers.push(params.taskIdentifier as string);
    },
  };

  await getRecentRecommendationPipelineRuns(20, client);

  assert.deepEqual(queriedTaskIdentifiers, ["recommendation-pipeline-for-tenant"]);
});

test("getRecentRecommendationPipelineRuns sorts runs newest-first and respects limit", async () => {
  const makeRun = (id: string, isoDate: string) => ({
    id,
    status: "COMPLETED",
    createdAt: new Date(isoDate),
    taskIdentifier: "recommendation-pipeline-for-tenant",
    isSuccess: true,
    isFailed: false,
  });

  const client = makeFakeRunsClient({
    "recommendation-pipeline-for-tenant": [
      makeRun("run-1", "2026-07-15T00:00:00.000Z"),
      makeRun("run-2", "2026-07-14T00:00:00.000Z"),
      makeRun("run-3", "2026-07-13T00:00:00.000Z"),
    ],
  });

  const results = await getRecentRecommendationPipelineRuns(2, client);

  assert.equal(results.length, 2);
  assert.deepEqual(
    results.map((r) => r.id),
    ["run-1", "run-2"]
  );
});

test("getRecommendationPipelineHealth surfaces lastRun / lastSuccess / lastFailure / currentStatus", async () => {
  const client = makeFakeRunsClient({
    "recommendation-pipeline-for-tenant": [
      {
        id: "run-failed",
        status: "FAILED",
        createdAt: new Date("2026-07-16T00:00:00.000Z"),
        taskIdentifier: "recommendation-pipeline-for-tenant",
        isSuccess: false,
        isFailed: true,
      },
      {
        id: "run-ok",
        status: "COMPLETED",
        createdAt: new Date("2026-07-15T00:00:00.000Z"),
        taskIdentifier: "recommendation-pipeline-for-tenant",
        isSuccess: true,
        isFailed: false,
      },
    ],
  });

  const health = await getRecommendationPipelineHealth(20, client);

  assert.equal(health.lastRun?.id, "run-failed");
  assert.equal(health.lastSuccess?.id, "run-ok");
  assert.equal(health.lastFailure?.id, "run-failed");
  assert.equal(health.currentStatus, "FAILED");
});

test("getRecommendationPipelineHealth reports idle when there are no runs", async () => {
  const client = makeFakeRunsClient({
    "recommendation-pipeline-for-tenant": [],
  });

  const health = await getRecommendationPipelineHealth(20, client);

  assert.equal(health.lastRun, null);
  assert.equal(health.lastSuccess, null);
  assert.equal(health.lastFailure, null);
  assert.equal(health.currentStatus, "idle");
});

import test from "node:test";
import assert from "node:assert/strict";
import { getRecentAnalyticsCaptureRuns } from "../lib/trigger/analyticsCaptureStatus.ts";
import type { RunsListClient } from "../lib/trigger/analyticsCaptureStatus.ts";

function makeFakeRunsClient(
  runsByTask: Record<
    string,
    Array<{ id: string; status: string; createdAt: Date; taskIdentifier: string; isSuccess: boolean; isFailed: boolean }>
  >
): RunsListClient {
  return {
    async *list(params) {
      const taskIdentifier = params.taskIdentifier as string;
      for (const run of runsByTask[taskIdentifier] ?? []) {
        yield run;
      }
    },
  };
}

test("getRecentAnalyticsCaptureRuns queries both the sweep and per-tenant task identifiers", async () => {
  const queriedTaskIdentifiers: string[] = [];
  const client: RunsListClient = {
    async *list(params) {
      queriedTaskIdentifiers.push(params.taskIdentifier as string);
    },
  };

  await getRecentAnalyticsCaptureRuns(20, client);

  assert.deepEqual(
    queriedTaskIdentifiers.sort(),
    ["analytics-capture-for-tenant", "analytics-capture-sweep"].sort()
  );
});

test("getRecentAnalyticsCaptureRuns merges and sorts runs from both tasks newest-first", async () => {
  const client = makeFakeRunsClient({
    "analytics-capture-sweep": [
      {
        id: "run-sweep-old",
        status: "COMPLETED",
        createdAt: new Date("2026-07-14T00:00:00.000Z"),
        taskIdentifier: "analytics-capture-sweep",
        isSuccess: true,
        isFailed: false,
      },
    ],
    "analytics-capture-for-tenant": [
      {
        id: "run-tenant-new",
        status: "COMPLETED",
        createdAt: new Date("2026-07-15T00:00:00.000Z"),
        taskIdentifier: "analytics-capture-for-tenant",
        isSuccess: true,
        isFailed: false,
      },
    ],
  });

  const results = await getRecentAnalyticsCaptureRuns(20, client);

  assert.deepEqual(
    results.map((r) => r.id),
    ["run-tenant-new", "run-sweep-old"]
  );
});

test("getRecentAnalyticsCaptureRuns surfaces failed runs with isFailed true, for health visibility", async () => {
  const client = makeFakeRunsClient({
    "analytics-capture-sweep": [],
    "analytics-capture-for-tenant": [
      {
        id: "run-failed",
        status: "FAILED",
        createdAt: new Date("2026-07-15T00:00:00.000Z"),
        taskIdentifier: "analytics-capture-for-tenant",
        isSuccess: false,
        isFailed: true,
      },
    ],
  });

  const results = await getRecentAnalyticsCaptureRuns(20, client);

  assert.equal(results.length, 1);
  assert.equal(results[0].isFailed, true);
  assert.equal(results[0].isSuccess, false);
});

test("getRecentAnalyticsCaptureRuns respects the limit after merging", async () => {
  const makeRun = (id: string, isoDate: string) => ({
    id,
    status: "COMPLETED",
    createdAt: new Date(isoDate),
    taskIdentifier: "analytics-capture-for-tenant",
    isSuccess: true,
    isFailed: false,
  });

  const client = makeFakeRunsClient({
    "analytics-capture-sweep": [],
    "analytics-capture-for-tenant": [
      makeRun("run-1", "2026-07-15T00:00:00.000Z"),
      makeRun("run-2", "2026-07-14T00:00:00.000Z"),
      makeRun("run-3", "2026-07-13T00:00:00.000Z"),
    ],
  });

  const results = await getRecentAnalyticsCaptureRuns(2, client);

  assert.equal(results.length, 2);
  assert.deepEqual(
    results.map((r) => r.id),
    ["run-1", "run-2"]
  );
});

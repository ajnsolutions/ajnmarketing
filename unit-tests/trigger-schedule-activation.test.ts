import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ALL_TRIGGER_TASK_IDS,
  ATTACH_DECLARATIVE_PRODUCTION_CRONS,
  INTENDED_PRODUCTION_CRONS,
  SCHEDULED_SWEEP_TASK_IDS,
  declarativeProductionCron,
} from "../lib/trigger/scheduleActivation.ts";

const TRIGGER_SOURCES = [
  new URL("../trigger/publishingDue.ts", import.meta.url),
  new URL("../trigger/analyticsCapture.ts", import.meta.url),
  new URL("../trigger/recommendationPipeline.ts", import.meta.url),
];

const ACTIVATION_SOURCE = readFileSync(
  new URL("../lib/trigger/scheduleActivation.ts", import.meta.url),
  "utf8"
);

test("declarative production cron attachment is gated off by default", () => {
  assert.equal(ATTACH_DECLARATIVE_PRODUCTION_CRONS, false);
  for (const taskId of SCHEDULED_SWEEP_TASK_IDS) {
    assert.deepEqual(declarativeProductionCron(taskId), {});
  }
});

test("intended production cron values remain documented for later activation", () => {
  assert.deepEqual(INTENDED_PRODUCTION_CRONS["analytics-capture-sweep"], {
    pattern: "0 6 * * *",
    timezone: "UTC",
    environments: ["PRODUCTION"],
  });
  assert.deepEqual(INTENDED_PRODUCTION_CRONS["publishing-due-sweep"], {
    pattern: "5 * * * *",
    timezone: "UTC",
    environments: ["PRODUCTION"],
  });
  assert.deepEqual(INTENDED_PRODUCTION_CRONS["recommendation-pipeline-sweep"], {
    pattern: "0 14 * * *",
    timezone: "UTC",
    environments: ["PRODUCTION"],
  });
});

test("all six Trigger.dev tasks remain declared for manual invocation", () => {
  assert.equal(ALL_TRIGGER_TASK_IDS.length, 6);

  const sources = TRIGGER_SOURCES.map((url) => readFileSync(url, "utf8")).join("\n");

  for (const taskId of ALL_TRIGGER_TASK_IDS) {
    assert.match(sources, new RegExp(`id:\\s*"${taskId}"`));
  }

  // Sweep tasks stay schedules.task so dashboard Test / imperative schedules still work.
  for (const sweepId of SCHEDULED_SWEEP_TASK_IDS) {
    assert.match(sources, new RegExp(`schedules\\.task\\([\\s\\S]*?id:\\s*"${sweepId}"`));
  }

  assert.match(sources, /task\(\{\s*\n\s*id:\s*"recommendation-pipeline-for-tenant"/);
  assert.match(sources, /task\(\{\s*\n\s*id:\s*"analytics-capture-for-tenant"/);
  assert.match(sources, /task\(\{\s*\n\s*id:\s*"publishing-execute-job"/);
});

test("trigger sources do not hard-code declarative cron — gate owns attachment", () => {
  for (const url of TRIGGER_SOURCES) {
    const source = readFileSync(url, "utf8");
    assert.equal(
      /cron:\s*\{/.test(source),
      false,
      `${url.pathname} must not declare inline cron — use declarativeProductionCron()`
    );
    assert.match(source, /declarativeProductionCron\(/);
    assert.equal(/environments:\s*\[["']PRODUCTION["']\]/.test(source), false);
  }
});

test("publishing cron cannot become active from this deployment while gate is closed", () => {
  assert.equal(ATTACH_DECLARATIVE_PRODUCTION_CRONS, false);
  assert.deepEqual(declarativeProductionCron("publishing-due-sweep"), {});
  const publishingSource = readFileSync(TRIGGER_SOURCES[0]!, "utf8");
  assert.equal(/pattern:\s*"5 \* \* \* \*"/.test(publishingSource), false);
  assert.match(publishingSource, /declarativeProductionCron\("publishing-due-sweep"\)/);
});

test("activation module documents the one-line future flip", () => {
  assert.match(ACTIVATION_SOURCE, /ATTACH_DECLARATIVE_PRODUCTION_CRONS/);
  assert.match(ACTIVATION_SOURCE, /INTENDED_PRODUCTION_CRONS/);
  assert.match(ACTIVATION_SOURCE, /Flip `ATTACH_DECLARATIVE_PRODUCTION_CRONS`/);
});

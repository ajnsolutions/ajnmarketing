import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildInitialQueueState, computeResumeEligible, loadQueueState, saveQueueState } from "../scripts/ai/queueIO.ts";
import type { QueueState, RunQueue } from "../scripts/ai/queueTypes.ts";

function queueWithTasks(): RunQueue {
  return {
    queue: {
      name: "q",
      project: "ajnmarketing",
      execution_mode: "sequential",
      stop_on_failure: true,
      branch_strategy: "independent",
      base_branch: "main",
      default_agent: "claude",
    },
    safety: {
      allow_merge: false,
      allow_deploy: false,
      allow_production_migrations: false,
      allow_secret_changes: false,
      allow_production_schedule_activation: false,
    },
    tasks: [
      {
        id: "001",
        name: "First",
        prompt: "prompts/001.md",
        branch: "ai-queue/001",
        agent: "claude",
        depends_on: [],
        requires_migration: false,
        requires_deployment: false,
        requires_secret_change: false,
        activates_production_schedule: false,
        stop_if_ambiguous: true,
        status: "pending",
      },
      {
        id: "002",
        name: "Second (example, disabled)",
        prompt: "prompts/002.md",
        branch: "ai-queue/002",
        agent: "claude",
        depends_on: ["001"],
        requires_migration: false,
        requires_deployment: false,
        requires_secret_change: false,
        activates_production_schedule: false,
        stop_if_ambiguous: true,
        status: "disabled",
      },
    ],
  };
}

test("buildInitialQueueState mirrors each task's RUN_QUEUE.yaml status with no branch/commit/PR yet", () => {
  const state = buildInitialQueueState(queueWithTasks());
  assert.equal(state.tasks.length, 2);
  assert.equal(state.tasks[0].status, "pending");
  assert.equal(state.tasks[1].status, "disabled");
  for (const t of state.tasks) {
    assert.equal(t.branch, null);
    assert.equal(t.commit, null);
    assert.equal(t.pr, null);
  }
  assert.equal(state.current_task, null);
  assert.equal(state.resume_eligible, false);
});

test("computeResumeEligible is true when a pending task remains and nothing is stuck in_progress", () => {
  const state = buildInitialQueueState(queueWithTasks());
  assert.equal(computeResumeEligible(state), true);
});

test("computeResumeEligible is false when a task is stuck in_progress (crashed run)", () => {
  const state = buildInitialQueueState(queueWithTasks());
  state.tasks[0].status = "in_progress";
  assert.equal(computeResumeEligible(state), false);
});

test("computeResumeEligible is false once nothing pending remains", () => {
  const state = buildInitialQueueState(queueWithTasks());
  state.tasks[0].status = "completed";
  assert.equal(computeResumeEligible(state), false);
});

test("QUEUE_STATUS.json round-trips through save/load without losing data", () => {
  const root = mkdtempSync(join(tmpdir(), "ai-queue-state-test-"));
  try {
    mkdirSync(join(root, ".ai", "queue"), { recursive: true });
    const original: QueueState = buildInitialQueueState(queueWithTasks());
    original.tasks[0].status = "completed";
    original.tasks[0].branch = "ai-queue/001";
    original.tasks[0].commit = "abc1234";
    original.tasks[0].pr = "https://github.com/ajnsolutions/ajnmarketing/pull/999";

    saveQueueState(root, original);
    const loaded = loadQueueState(root);

    assert.deepEqual(loaded, original);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

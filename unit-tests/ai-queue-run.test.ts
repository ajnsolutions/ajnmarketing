import test from "node:test";
import assert from "node:assert/strict";
import { selectNextEligibleTask, determineBranchBase, runExceedsWallClockBudget } from "../scripts/ai/run-queue.ts";
import type { QueueState, QueueTask, RunQueue, TaskState } from "../scripts/ai/queueTypes.ts";

function task(overrides: Partial<QueueTask> = {}): QueueTask {
  return {
    id: "001",
    name: "Task",
    prompt: "prompts/task.md",
    branch: "ai-queue/001",
    agent: "claude",
    depends_on: [],
    requires_migration: false,
    requires_deployment: false,
    requires_secret_change: false,
    activates_production_schedule: false,
    stop_if_ambiguous: true,
    status: "pending",
    ...overrides,
  };
}

function queueWith(tasks: QueueTask[], branchStrategy: "independent" | "stacked" = "independent"): RunQueue {
  return {
    queue: {
      name: "q",
      project: "ajnmarketing",
      execution_mode: "sequential",
      stop_on_failure: true,
      branch_strategy: branchStrategy,
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
    tasks,
  };
}

function stateFor(tasks: QueueTask[], statusOverrides: Record<string, Partial<TaskState>> = {}): QueueState {
  return {
    queue_name: "q",
    generated_at: new Date().toISOString(),
    generated_by: "test",
    current_task: null,
    last_run_id: null,
    resume_eligible: false,
    tasks: tasks.map((t) => ({
      id: t.id,
      name: t.name,
      status: t.status,
      branch: null,
      commit: null,
      pr: null,
      started_at: null,
      completed_at: null,
      tests: null,
      blocker: null,
      ...statusOverrides[t.id],
    })),
  };
}

test("selects the only pending task with no dependencies", () => {
  const tasks = [task({ id: "001" })];
  const queue = queueWith(tasks);
  const state = stateFor(tasks);
  const next = selectNextEligibleTask(queue, state);
  assert.equal(next?.id, "001");
});

test("does not select a task whose dependency has not completed yet", () => {
  const tasks = [task({ id: "001", status: "pending" }), task({ id: "002", branch: "ai-queue/002", depends_on: ["001"] })];
  const queue = queueWith(tasks);
  const state = stateFor(tasks, { "001": { status: "in_progress" } });
  const next = selectNextEligibleTask(queue, state);
  assert.equal(next, null, "task 002 must not be selected while its dependency 001 is still in_progress");
});

test("selects a dependent task once its dependency has completed", () => {
  const tasks = [task({ id: "001" }), task({ id: "002", branch: "ai-queue/002", depends_on: ["001"] })];
  const queue = queueWith(tasks);
  const state = stateFor(tasks, { "001": { status: "completed" } });
  const next = selectNextEligibleTask(queue, state);
  assert.equal(next?.id, "002");
});

test("never selects a disabled task, even if its live state says pending", () => {
  const tasks = [task({ id: "001", status: "disabled" })];
  const queue = queueWith(tasks);
  const state = stateFor(tasks); // state mirrors "pending" by construction below
  state.tasks[0].status = "pending"; // simulate stale/inconsistent state on purpose
  const next = selectNextEligibleTask(queue, state);
  assert.equal(next, null, "RUN_QUEUE.yaml's disabled status must always win over any live state");
});

test("returns null once every task is completed", () => {
  const tasks = [task({ id: "001" })];
  const queue = queueWith(tasks);
  const state = stateFor(tasks, { "001": { status: "completed" } });
  assert.equal(selectNextEligibleTask(queue, state), null);
});

test("respects file order among multiple simultaneously-eligible tasks", () => {
  const tasks = [task({ id: "002", branch: "ai-queue/002" }), task({ id: "001", branch: "ai-queue/001" })];
  const queue = queueWith(tasks);
  const state = stateFor(tasks);
  const next = selectNextEligibleTask(queue, state);
  assert.equal(next?.id, "002", "the first eligible task in file order should be chosen, not sorted by id");
});

test("determineBranchBase uses the base branch for a task with no dependencies", () => {
  const tasks = [task({ id: "001" })];
  const queue = queueWith(tasks, "stacked");
  const state = stateFor(tasks);
  assert.equal(determineBranchBase(queue, tasks[0], state), "origin/main");
});

test("determineBranchBase (stacked) bases a dependent task on its dependency's own branch", () => {
  const tasks = [task({ id: "001" }), task({ id: "002", branch: "ai-queue/002", depends_on: ["001"] })];
  const queue = queueWith(tasks, "stacked");
  const state = stateFor(tasks, { "001": { status: "completed", branch: "ai-queue/001" } });
  assert.equal(determineBranchBase(queue, tasks[1], state), "ai-queue/001");
});

test("determineBranchBase (independent) always uses the base branch, even for a dependent task", () => {
  const tasks = [task({ id: "001" }), task({ id: "002", branch: "ai-queue/002", depends_on: ["001"] })];
  const queue = queueWith(tasks, "independent");
  const state = stateFor(tasks, { "001": { status: "completed", branch: "ai-queue/001" } });
  assert.equal(determineBranchBase(queue, tasks[1], state), "origin/main");
});

// ---------------------------------------------------------------------------
// runExceedsWallClockBudget — reliability hardening, 2026-08-02. Without this,
// an unattended overnight run had no ceiling at all and could, in principle,
// still be running well into the next business day.
// ---------------------------------------------------------------------------

test("runExceedsWallClockBudget is false immediately after the run starts", () => {
  const start = Date.parse("2026-08-02T02:00:00.000Z");
  assert.equal(runExceedsWallClockBudget(start, start, 360), false);
});

test("runExceedsWallClockBudget is false just under the budget", () => {
  const start = Date.parse("2026-08-02T02:00:00.000Z");
  const almostThere = start + 359 * 60 * 1000;
  assert.equal(runExceedsWallClockBudget(start, almostThere, 360), false);
});

test("runExceedsWallClockBudget is true exactly at the budget", () => {
  const start = Date.parse("2026-08-02T02:00:00.000Z");
  const exactly = start + 360 * 60 * 1000;
  assert.equal(runExceedsWallClockBudget(start, exactly, 360), true);
});

test("runExceedsWallClockBudget is true well past the budget", () => {
  const start = Date.parse("2026-08-02T02:00:00.000Z");
  const wayPast = start + 500 * 60 * 1000;
  assert.equal(runExceedsWallClockBudget(start, wayPast, 360), true);
});

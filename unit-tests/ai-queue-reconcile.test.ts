import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  classifyTaskState,
  reconcileTaskState,
  reconcileQueueState,
  reconcileTaskAgainstMemoryCheckFailure,
  reconcileFailedMemoryChecks,
  isMemoryCheckFailureBlocker,
  isProcessAlive,
  writeRunLock,
  readRunLock,
  removeRunLock,
  isQueueProcessRunning,
  type PrLookup,
  type PrLookupResult,
  type MemoryValidationLike,
  type RefResolver,
} from "../scripts/ai/reconcile.ts";
import { selectNextEligibleTask } from "../scripts/ai/run-queue.ts";
import type { QueueState, QueueTask, RunQueue, TaskState } from "../scripts/ai/queueTypes.ts";

/**
 * Root-cause regression coverage (2026-08-02): PR #101 (Task 001) merged
 * into main with QUEUE_STATUS.json still recording it as "in_progress",
 * because run-queue.ts used to flip the in-memory status to "completed"
 * only AFTER committing/pushing/opening the PR — the commit that became
 * the PR always carried the stale snapshot. This blocked Task 002 (which
 * depends on Task 001) from ever becoming eligible. These tests cover the
 * reconciliation half of the fix directly.
 */

function task(overrides: Partial<QueueTask> = {}): QueueTask {
  return {
    id: "001",
    name: "Task",
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
    ...overrides,
  };
}

function inProgressState(overrides: Partial<TaskState> = {}): TaskState {
  return {
    id: "001",
    name: "Task",
    status: "in_progress",
    branch: null,
    commit: null,
    pr: null,
    started_at: "2026-08-02T13:46:35.636Z",
    completed_at: null,
    tests: null,
    blocker: null,
    ...overrides,
  };
}

function mergedPr(overrides: Partial<PrLookupResult> = {}): PrLookupResult {
  return {
    number: 101,
    state: "MERGED",
    mergedAt: "2026-08-02T13:58:34Z",
    mergeCommitOid: "895f5d3360530938184588a07ae87cbe13e1477a",
    url: "https://github.com/ajnsolutions/ajnmarketing/pull/101",
    baseRefName: "main",
    ...overrides,
  };
}

function lookupReturning(result: PrLookupResult | null): PrLookup {
  return () => result;
}

// ---------------------------------------------------------------------------
// classifyTaskState
// ---------------------------------------------------------------------------

test("classifyTaskState: not_applicable for a task that isn't in_progress", () => {
  const c = classifyTaskState(task(), inProgressState({ status: "completed" }), lookupReturning(null), false);
  assert.equal(c.classification, "not_applicable");
});

test("classifyTaskState: running when a live queue process owns it, regardless of PR state", () => {
  const c = classifyTaskState(task(), inProgressState(), lookupReturning(mergedPr()), true);
  assert.equal(c.classification, "running");
});

test("classifyTaskState: stale_pr_merged — the exact PR #101 scenario this bug is about", () => {
  const c = classifyTaskState(task({ branch: "ai-queue/001-market-radar-foundation" }), inProgressState(), lookupReturning(mergedPr()), false);
  assert.equal(c.classification, "stale_pr_merged");
  assert.equal(c.pr!.number, 101);
});

test("classifyTaskState: stale_pr_open when a PR exists but has not merged", () => {
  const c = classifyTaskState(task(), inProgressState(), lookupReturning(mergedPr({ state: "OPEN", mergedAt: null, mergeCommitOid: null })), false);
  assert.equal(c.classification, "stale_pr_open");
});

test("classifyTaskState: stale_pr_closed when a PR was closed without merging", () => {
  const c = classifyTaskState(task(), inProgressState(), lookupReturning(mergedPr({ state: "CLOSED", mergedAt: null, mergeCommitOid: null })), false);
  assert.equal(c.classification, "stale_pr_closed");
});

test("classifyTaskState: stale_no_evidence when no PR is found at all — a real crash, not a bookkeeping lag", () => {
  const c = classifyTaskState(task(), inProgressState(), lookupReturning(null), false);
  assert.equal(c.classification, "stale_no_evidence");
});

test("classifyTaskState: falls back to the task's own configured branch when stateEntry.branch was never recorded", () => {
  let capturedBranch: string | null = null;
  const lookup: PrLookup = (branch) => {
    capturedBranch = branch;
    return mergedPr();
  };
  classifyTaskState(task({ branch: "ai-queue/001-from-config" }), inProgressState({ branch: null }), lookup, false);
  assert.equal(capturedBranch, "ai-queue/001-from-config");
});

// ---------------------------------------------------------------------------
// reconcileTaskState — "merged completed task is recognized"
// ---------------------------------------------------------------------------

test("reconcileTaskState marks a task completed from a verified merged PR, using only real data (never fabricated)", () => {
  const { stateEntry, change } = reconcileTaskState(task({ branch: "ai-queue/001-market-radar-foundation" }), inProgressState(), lookupReturning(mergedPr()), false);
  assert.equal(stateEntry.status, "completed");
  assert.equal(stateEntry.pr, "https://github.com/ajnsolutions/ajnmarketing/pull/101");
  assert.equal(stateEntry.commit, "895f5d3360530938184588a07ae87cbe13e1477a");
  assert.equal(stateEntry.completed_at, "2026-08-02T13:58:34Z");
  assert.equal(stateEntry.blocker, null);
  assert.ok(change);
  assert.equal(change!.before, "in_progress");
  assert.equal(change!.after, "completed");
  assert.match(change!.reason, /PR #101/);
});

test("reconcileTaskState never invents a branch — if neither stateEntry nor the task config has one, it stays null", () => {
  const { stateEntry } = reconcileTaskState(task({ branch: undefined as unknown as string }), inProgressState({ branch: null }), lookupReturning(null), false);
  assert.equal(stateEntry.branch, null);
});

// ---------------------------------------------------------------------------
// reconcileTaskState — "stale in_progress state is detected and safely reconciled"
// ---------------------------------------------------------------------------

test("reconcileTaskState marks a task failed (never silently resumed or guessed complete) when no PR evidence exists", () => {
  const { stateEntry, change } = reconcileTaskState(task(), inProgressState(), lookupReturning(null), false);
  assert.equal(stateEntry.status, "failed");
  assert.match(stateEntry.blocker!, /stale in_progress state detected/);
  assert.match(stateEntry.blocker!, /no PR was found/);
  assert.equal(change!.after, "failed");
});

test("reconcileTaskState marks a task failed when its PR was closed without merging", () => {
  const { stateEntry } = reconcileTaskState(task(), inProgressState(), lookupReturning(mergedPr({ state: "CLOSED", mergedAt: null, mergeCommitOid: null })), false);
  assert.equal(stateEntry.status, "failed");
  assert.match(stateEntry.blocker!, /closed without merging/);
});

test("reconcileTaskState leaves an actively-running task completely untouched", () => {
  const original = inProgressState();
  const { stateEntry, change } = reconcileTaskState(task(), original, lookupReturning(mergedPr()), true);
  assert.deepEqual(stateEntry, original);
  assert.equal(change, null);
});

test("reconcileTaskState leaves a task with an open (not yet merged) PR untouched — never guesses", () => {
  const original = inProgressState();
  const { stateEntry, change } = reconcileTaskState(task(), original, lookupReturning(mergedPr({ state: "OPEN", mergedAt: null, mergeCommitOid: null })), false);
  assert.deepEqual(stateEntry, original);
  assert.equal(change, null);
});

test("reconcileTaskState never touches a task that isn't in_progress (pending, completed, failed, disabled, skipped all pass through unchanged)", () => {
  for (const status of ["pending", "completed", "failed", "disabled", "skipped"]) {
    const original = inProgressState({ status });
    const { stateEntry, change } = reconcileTaskState(task(), original, lookupReturning(mergedPr()), false);
    assert.deepEqual(stateEntry, original, `status ${status} must be untouched`);
    assert.equal(change, null);
  }
});

// ---------------------------------------------------------------------------
// reconcileQueueState — multi-task
// ---------------------------------------------------------------------------

test("reconcileQueueState applies independently across tasks and reports every change", () => {
  const queue: RunQueue["tasks"] = [
    task({ id: "001", branch: "ai-queue/001" }),
    task({ id: "002", branch: "ai-queue/002", depends_on: ["001"] }),
  ];
  const state: QueueState = {
    queue_name: "q",
    generated_at: "2026-08-02T00:00:00Z",
    generated_by: "test",
    current_task: "001",
    last_run_id: "run",
    resume_eligible: false,
    tasks: [inProgressState({ id: "001", branch: "ai-queue/001" }), { ...inProgressState({ id: "002", branch: "ai-queue/002" }) }],
  };
  const lookup: PrLookup = (branch) => (branch === "ai-queue/001" ? mergedPr() : null);
  const { state: result, changes } = reconcileQueueState({ queue: {} as never, safety: {} as never, tasks: queue }, state, lookup, false);
  assert.equal(result.tasks.find((t) => t.id === "001")!.status, "completed");
  assert.equal(result.tasks.find((t) => t.id === "002")!.status, "failed");
  assert.equal(changes.length, 2);
});

// ---------------------------------------------------------------------------
// "pending dependent task becomes eligible only after verified completion"
// ---------------------------------------------------------------------------

test("a dependent pending task stays ineligible while its dependency is merely in_progress", () => {
  const tasks = [task({ id: "001", branch: "ai-queue/001" }), task({ id: "002", branch: "ai-queue/002", depends_on: ["001"] })];
  const runQueue: RunQueue = { queue: { name: "q", project: "p", execution_mode: "sequential", stop_on_failure: true, branch_strategy: "stacked", base_branch: "main", default_agent: "claude" }, safety: { allow_merge: false, allow_deploy: false, allow_production_migrations: false, allow_secret_changes: false, allow_production_schedule_activation: false }, tasks };
  const state: QueueState = { queue_name: "q", generated_at: "x", generated_by: "test", current_task: "001", last_run_id: "run", resume_eligible: false, tasks: [inProgressState({ id: "001", branch: "ai-queue/001" }), inProgressState({ id: "002", branch: "ai-queue/002", status: "pending" })] };

  assert.equal(selectNextEligibleTask(runQueue, state), null, "002 must not be eligible while 001 is still in_progress, reconciled or not");
});

test("a dependent pending task becomes eligible once its dependency is reconciled from a genuinely merged PR — the exact end-to-end fix for the PR #101 incident", () => {
  const tasks = [task({ id: "001", branch: "ai-queue/001-market-radar-foundation" }), task({ id: "002", branch: "ai-queue/002-market-radar-view", depends_on: ["001"] })];
  const runQueue: RunQueue = { queue: { name: "q", project: "p", execution_mode: "sequential", stop_on_failure: true, branch_strategy: "stacked", base_branch: "main", default_agent: "claude" }, safety: { allow_merge: false, allow_deploy: false, allow_production_migrations: false, allow_secret_changes: false, allow_production_schedule_activation: false }, tasks };
  const staleState: QueueState = {
    queue_name: "q",
    generated_at: "x",
    generated_by: "test",
    current_task: "001",
    last_run_id: "run",
    resume_eligible: false,
    tasks: [inProgressState({ id: "001", branch: "ai-queue/001-market-radar-foundation" }), inProgressState({ id: "002", branch: "ai-queue/002-market-radar-view", status: "pending" })],
  };

  assert.equal(selectNextEligibleTask(runQueue, staleState), null, "sanity check: ineligible before reconciliation");

  const { state: reconciled } = reconcileQueueState(runQueue, staleState, lookupReturning(mergedPr()), false);
  const next = selectNextEligibleTask(runQueue, reconciled);
  assert.equal(next?.id, "002", "002 must become selectable once 001 is verified completed, exactly reproducing the PR #101 fix");
});

test("a dependent pending task does NOT become eligible if reconciliation only finds an open (unmerged) PR — never falsely unblocks", () => {
  const tasks = [task({ id: "001", branch: "ai-queue/001" }), task({ id: "002", branch: "ai-queue/002", depends_on: ["001"] })];
  const runQueue: RunQueue = { queue: { name: "q", project: "p", execution_mode: "sequential", stop_on_failure: true, branch_strategy: "stacked", base_branch: "main", default_agent: "claude" }, safety: { allow_merge: false, allow_deploy: false, allow_production_migrations: false, allow_secret_changes: false, allow_production_schedule_activation: false }, tasks };
  const staleState: QueueState = { queue_name: "q", generated_at: "x", generated_by: "test", current_task: "001", last_run_id: "run", resume_eligible: false, tasks: [inProgressState({ id: "001", branch: "ai-queue/001" }), inProgressState({ id: "002", branch: "ai-queue/002", status: "pending" })] };

  const { state: reconciled } = reconcileQueueState(runQueue, staleState, lookupReturning(mergedPr({ state: "OPEN", mergedAt: null, mergeCommitOid: null })), false);
  assert.equal(selectNextEligibleTask(runQueue, reconciled), null, "002 must stay ineligible — an open PR is not verified completion");
});

// ---------------------------------------------------------------------------
// Process liveness (real OS process checks, no mocking)
// ---------------------------------------------------------------------------

test("isProcessAlive is true for this test process's own PID", () => {
  assert.equal(isProcessAlive(process.pid), true);
});

test("isProcessAlive is false for a PID that (almost certainly) does not exist", () => {
  assert.equal(isProcessAlive(999999), false);
});

test("run lock: write/read/remove round-trip, and isQueueProcessRunning reflects real liveness", () => {
  const root = mkdtempSync(join(tmpdir(), "ai-queue-lock-test-"));
  try {
    assert.equal(readRunLock(root), null);
    assert.equal(isQueueProcessRunning(root), false);

    writeRunLock(root, { pid: process.pid, startedAt: "2026-08-02T00:00:00Z", runId: "test-run" });
    const lock = readRunLock(root);
    assert.equal(lock?.pid, process.pid);
    assert.equal(isQueueProcessRunning(root), true, "a lock referencing this live test process must be reported as running");

    removeRunLock(root);
    assert.equal(readRunLock(root), null);
    assert.equal(isQueueProcessRunning(root), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("isQueueProcessRunning is false for a lock left behind by a process that no longer exists (a real crash)", () => {
  const root = mkdtempSync(join(tmpdir(), "ai-queue-lock-test-"));
  try {
    writeRunLock(root, { pid: 999999, startedAt: "2026-08-02T00:00:00Z", runId: "crashed-run" });
    assert.equal(isQueueProcessRunning(root), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Project Memory false-failure reconciliation (2026-08-03) — the exact real
// incident: Task 003 genuinely completed its implementation AND its Project
// Memory update, in the same commit, and opened a real PR — but the OLD
// memory check only detected UNCOMMITTED changes, so it failed the task
// anyway. reconcileTaskAgainstMemoryCheckFailure is the permanent, reusable
// supported recovery path for exactly this failure mode.
// ---------------------------------------------------------------------------

function memoryFailedState(overrides: Partial<TaskState> = {}): TaskState {
  return {
    id: "003",
    name: "Competitor Observation Engine",
    status: "failed",
    branch: "ai-queue/003-competitor-observation-engine",
    commit: null,
    pr: null,
    started_at: "2026-08-03T05:14:17.676Z",
    completed_at: null,
    tests: "passed",
    blocker: "task completed and passed quality gates, but did not update any .ai/ memory file — AGENTS.md requires this before completing work.",
    ...overrides,
  };
}

function passingValidator(changedFiles: string[] = [".ai/HANDOFF.md"]): MemoryValidationLike {
  return { passed: true, changedFiles, reasons: [] };
}

function failingValidator(reasons: string[] = ["still no update"]): MemoryValidationLike {
  return { passed: false, changedFiles: [], reasons };
}

function resolverReturning(sha: string | null): RefResolver {
  return () => sha;
}

test("isMemoryCheckFailureBlocker matches the real historical blocker text and its replacement, not unrelated failures", () => {
  assert.equal(isMemoryCheckFailureBlocker("task completed and passed quality gates, but did not update any .ai/ memory file — AGENTS.md requires this before completing work."), true);
  assert.equal(isMemoryCheckFailureBlocker("task completed and passed quality gates, but its Project Memory update is invalid after 3 repair attempt(s): X"), true);
  assert.equal(isMemoryCheckFailureBlocker("quality gate failed after 3 auto-repair attempt(s) — new regression(s): typescript"), false);
  assert.equal(isMemoryCheckFailureBlocker("git push failed: network error"), false);
  assert.equal(isMemoryCheckFailureBlocker(null), false);
});

test("reconcileTaskAgainstMemoryCheckFailure: the real PR #107 incident — real PR, valid re-validation, reconciles to completed", () => {
  const pr = mergedPr({ number: 107, state: "OPEN", mergedAt: null, baseRefName: "main" });
  const { stateEntry, change } = reconcileTaskAgainstMemoryCheckFailure(
    "/fake/repo",
    task({ id: "003", branch: "ai-queue/003-competitor-observation-engine" }),
    memoryFailedState(),
    lookupReturning(pr),
    () => passingValidator([".ai/CURRENT_STATUS.md", ".ai/STATUS.json", ".ai/HANDOFF.md"]),
    resolverReturning("8261a201b52ea8770cad62beee346148c2cb3536")
  );
  assert.equal(stateEntry.status, "completed");
  assert.equal(stateEntry.pr, pr.url);
  assert.equal(stateEntry.commit, "8261a201b52ea8770cad62beee346148c2cb3536");
  assert.equal(stateEntry.blocker, null);
  assert.equal(stateEntry.memory_validation?.passed, true);
  assert.ok(change);
  assert.equal(change?.before, "failed");
  assert.equal(change?.after, "completed");
  assert.match(change!.reason, /#107/);
});

test("reconcileTaskAgainstMemoryCheckFailure preserves the task's real implementation — never touches branch/commit files, only the state entry", () => {
  // "Preserves valid implementation work": the reconciliation is a pure
  // state-object transform. It must never shell out to touch the working
  // tree, checkout a branch, or modify any file other than the returned
  // TaskState — verified here by construction (the function takes no
  // filesystem-mutating dependency at all, only lookupPr/validateMemory/
  // resolveRef, all read-only injected functions).
  const pr = mergedPr({ number: 107, state: "OPEN", mergedAt: null, baseRefName: "main" });
  let validateCalls = 0;
  const { stateEntry } = reconcileTaskAgainstMemoryCheckFailure(
    "/fake/repo",
    task({ id: "003", branch: "ai-queue/003-competitor-observation-engine" }),
    memoryFailedState({ tests: "passed — 11/11 new, 1808/1808 full suite" }),
    lookupReturning(pr),
    () => {
      validateCalls++;
      return passingValidator();
    },
    resolverReturning("8261a20")
  );
  assert.equal(validateCalls, 1, "must re-validate against real state exactly once, not skip verification");
  assert.equal(stateEntry.tests, "passed — 11/11 new, 1808/1808 full suite", "the task's own recorded test evidence must survive reconciliation untouched");
  assert.equal(stateEntry.branch, "ai-queue/003-competitor-observation-engine", "branch must be preserved, not fabricated or cleared");
});

test("reconcileTaskAgainstMemoryCheckFailure does NOT reconcile a task whose blocker is unrelated to the memory check", () => {
  const { stateEntry, change } = reconcileTaskAgainstMemoryCheckFailure(
    "/fake/repo",
    task(),
    memoryFailedState({ blocker: "quality gate failed after 3 auto-repair attempt(s) — new regression(s): typescript" }),
    lookupReturning(mergedPr({ state: "OPEN" })),
    () => passingValidator(),
    resolverReturning("abc123")
  );
  assert.equal(stateEntry.status, "failed", "an unrelated failure must never be silently reclassified as completed");
  assert.equal(change, null);
});

test("reconcileTaskAgainstMemoryCheckFailure does NOT reconcile when no PR exists — refuses to fabricate", () => {
  const { stateEntry, change } = reconcileTaskAgainstMemoryCheckFailure(
    "/fake/repo",
    task(),
    memoryFailedState(),
    lookupReturning(null),
    () => passingValidator(),
    resolverReturning("abc123")
  );
  assert.equal(stateEntry.status, "failed");
  assert.equal(change, null);
});

test("reconcileTaskAgainstMemoryCheckFailure does NOT reconcile when the PR was closed without merging", () => {
  const { stateEntry, change } = reconcileTaskAgainstMemoryCheckFailure(
    "/fake/repo",
    task(),
    memoryFailedState(),
    lookupReturning(mergedPr({ state: "CLOSED", mergedAt: null })),
    () => passingValidator(),
    resolverReturning("abc123")
  );
  assert.equal(stateEntry.status, "failed");
  assert.equal(change, null);
});

test("reconcileTaskAgainstMemoryCheckFailure does NOT reconcile when re-validation genuinely still fails — the memory update really is still missing", () => {
  const { stateEntry, change } = reconcileTaskAgainstMemoryCheckFailure(
    "/fake/repo",
    task(),
    memoryFailedState(),
    lookupReturning(mergedPr({ state: "OPEN" })),
    () => failingValidator(["HANDOFF.md was not updated"]),
    resolverReturning("abc123")
  );
  assert.equal(stateEntry.status, "failed", "a task genuinely still missing its memory update must stay failed, never waved through");
  assert.equal(change, null);
});

test("reconcileTaskAgainstMemoryCheckFailure is a no-op for a task that isn't failed at all", () => {
  const { stateEntry, change } = reconcileTaskAgainstMemoryCheckFailure(
    "/fake/repo",
    task(),
    memoryFailedState({ status: "completed", blocker: null }),
    lookupReturning(mergedPr({ state: "OPEN" })),
    () => passingValidator(),
    resolverReturning("abc123")
  );
  assert.equal(stateEntry.status, "completed");
  assert.equal(change, null);
});

test("reconcileFailedMemoryChecks: batch version reconciles matching failed tasks and leaves everything else untouched", () => {
  const queue: RunQueue = {
    queue: { name: "q", project: "p", execution_mode: "sequential", stop_on_failure: true, branch_strategy: "stacked", base_branch: "main", default_agent: "claude" },
    safety: { allow_merge: false, allow_deploy: false, allow_production_migrations: false, allow_secret_changes: false, allow_production_schedule_activation: false },
    tasks: [task({ id: "001", branch: "ai-queue/001" }), task({ id: "003", branch: "ai-queue/003", depends_on: ["001"] })],
  };
  const state: QueueState = {
    queue_name: "q",
    generated_at: "2026-08-03T00:00:00Z",
    generated_by: "test",
    current_task: null,
    last_run_id: "run",
    resume_eligible: true,
    tasks: [
      { id: "001", name: "t", status: "completed", branch: "ai-queue/001", commit: "aaa", pr: "https://github.com/x/y/pull/101", started_at: null, completed_at: null, tests: "passed", blocker: null },
      memoryFailedState({ id: "003", branch: "ai-queue/003" }),
    ],
  };
  const { state: reconciled, changes } = reconcileFailedMemoryChecks(
    "/fake/repo",
    queue,
    state,
    lookupReturning(mergedPr({ number: 107, state: "OPEN", baseRefName: "main" })),
    () => passingValidator([".ai/HANDOFF.md"]),
    resolverReturning("8261a20")
  );
  assert.equal(changes.length, 1);
  assert.equal(changes[0].taskId, "003");
  const t001 = reconciled.tasks.find((t) => t.id === "001")!;
  const t003 = reconciled.tasks.find((t) => t.id === "003")!;
  assert.equal(t001.status, "completed", "an already-completed, unrelated task must be left byte-for-byte alone");
  assert.equal(t003.status, "completed");
});

import test from "node:test";
import assert from "node:assert/strict";
import { formatQueueStatusReport } from "../scripts/ai/queue-status.ts";
import type { TaskClassification } from "../scripts/ai/reconcile.ts";
import type { QueueState, QueueTask, RunQueue, TaskState } from "../scripts/ai/queueTypes.ts";

/**
 * "Improve ai:queue:status so it distinguishes: actively running process,
 * stale in_progress state, completed PR merged" (2026-08-02) — before this,
 * every in_progress task rendered identically regardless of which of these
 * three very different situations it was actually in, which is exactly what
 * let the PR #101 incident's stale state go unnoticed.
 */

function task(overrides: Partial<QueueTask> = {}): QueueTask {
  return {
    id: "001",
    name: "Task one",
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

function queueWith(tasks: QueueTask[]): RunQueue {
  return {
    queue: { name: "q", project: "p", execution_mode: "sequential", stop_on_failure: true, branch_strategy: "stacked", base_branch: "main", default_agent: "claude" },
    safety: { allow_merge: false, allow_deploy: false, allow_production_migrations: false, allow_secret_changes: false, allow_production_schedule_activation: false },
    tasks,
  };
}

function inProgressEntry(overrides: Partial<TaskState> = {}): TaskState {
  return { id: "001", name: "Task one", status: "in_progress", branch: "ai-queue/001", commit: null, pr: null, started_at: "2026-08-02T13:46:35.636Z", completed_at: null, tests: null, blocker: null, ...overrides };
}

function stateWith(entry: TaskState): QueueState {
  return { queue_name: "q", generated_at: "x", generated_by: "test", current_task: "001", last_run_id: "run", resume_eligible: false, tasks: [entry] };
}

test("an in_progress task with no classification data renders plainly, as before", () => {
  const report = formatQueueStatusReport(queueWith([task()]), stateWith(inProgressEntry()));
  assert.match(report, /\[in_progress\] 001/);
  assert.doesNotMatch(report, /live status:/);
});

test("a RUNNING task is labeled distinctly from a stale one", () => {
  const classifications = new Map<string, TaskClassification>([["001", { classification: "running", pr: null }]]);
  const report = formatQueueStatusReport(queueWith([task()]), stateWith(inProgressEntry()), classifications);
  assert.match(report, /live status: RUNNING/);
});

test("a stale task with a MERGED PR is labeled distinctly and points at the fix — the exact PR #101 situation", () => {
  const classifications = new Map<string, TaskClassification>([
    ["001", { classification: "stale_pr_merged", pr: { number: 101, state: "MERGED", mergedAt: "2026-08-02T13:58:34Z", mergeCommitOid: "895f5d3", url: "https://github.com/x/y/pull/101" } }],
  ]);
  const report = formatQueueStatusReport(queueWith([task()]), stateWith(inProgressEntry()), classifications);
  assert.match(report, /STALE, but PR #101 is MERGED/);
  assert.match(report, /ai:queue:reconcile/);
  assert.match(report, /Reason: task\(s\) 001 show "in_progress", but 001 actually merged already/);
});

test("a stale task with no PR evidence is labeled as a likely crash, distinct from the merged case", () => {
  const classifications = new Map<string, TaskClassification>([["001", { classification: "stale_no_evidence", pr: null }]]);
  const report = formatQueueStatusReport(queueWith([task()]), stateWith(inProgressEntry()), classifications);
  assert.match(report, /STALE — no PR found/);
  assert.doesNotMatch(report, /ai:queue:reconcile/, "the generic crash message should not point at reconcile the same way the merged case does");
});

test("a stale task with an open (unmerged) PR is labeled as unverified, not assumed complete", () => {
  const classifications = new Map<string, TaskClassification>([
    ["001", { classification: "stale_pr_open", pr: { number: 55, state: "OPEN", mergedAt: null, mergeCommitOid: null, url: "https://github.com/x/y/pull/55" } }],
  ]);
  const report = formatQueueStatusReport(queueWith([task()]), stateWith(inProgressEntry()), classifications);
  assert.match(report, /STALE — PR #55 exists but is still open/);
});

test("a completed task never shows a live-status line, even if a stale classification happens to be passed for it", () => {
  const completedEntry: TaskState = { id: "001", name: "Task one", status: "completed", branch: "ai-queue/001", commit: "abc", pr: "https://github.com/x/y/pull/101", started_at: "x", completed_at: "y", tests: "passed", blocker: null };
  const classifications = new Map<string, TaskClassification>([["001", { classification: "stale_pr_merged", pr: null }]]);
  const report = formatQueueStatusReport(queueWith([task()]), stateWith(completedEntry), classifications);
  assert.doesNotMatch(report, /live status:/);
});

/**
 * Queue state reconciliation.
 *
 * Root cause this fixes (2026-08-02, discovered while fixing a stale
 * QUEUE_STATUS.json on main after PR #101 merged): a successful task's
 * `attemptTask()` in run-queue.ts used to set `status: "completed"` on the
 * in-memory state object only AFTER `git commit` + `git push` + `gh pr
 * create` had already run — but that commit/push had already captured
 * QUEUE_STATUS.json in its still-"in_progress" shape, because `git add -A`
 * (which stages QUEUE_STATUS.json alongside the task's real deliverable
 * files) happened before the in-memory status flip. The "completed" update
 * only ever existed in the local working tree's file, never pushed to the
 * branch that became the PR. When that PR was reviewed and merged as-is,
 * main permanently inherited a stale "in_progress" snapshot for a task that
 * had, in reality, already succeeded — which incorrectly blocked its
 * dependent task from ever becoming eligible (`selectNextEligibleTask`
 * requires a dependency's status to be exactly `"completed"`).
 *
 * Two independent layers now prevent and detect this:
 *   1. run-queue.ts's ordering fix (see its own comments) — the completed
 *      state is now committed and pushed to the task's branch as a final
 *      step, so the PR itself carries the correct state from the start.
 *   2. This module — a defense-in-depth reconciler that treats a merged
 *      GitHub PR as ground truth. It runs automatically at the start of
 *      every `npm run ai:queue` invocation (before any new task is
 *      selected) and is also available standalone via
 *      `npm run ai:queue:reconcile`, so a stale state can always be healed
 *      even if fix #1 is ever bypassed (a hand-edited QUEUE_STATUS.json, a
 *      manually-run task, a future bug). It never fabricates data — every
 *      field it fills in comes from a real `gh pr list` lookup.
 */
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runCommand } from "./subprocess.ts";
import type { QueueState, QueueTask, RunQueue, TaskState } from "./queueTypes.ts";

export const RUN_LOCK_PATH = ".ai/queue/.run.lock";
const GH_LOOKUP_TIMEOUT_MS = 60 * 1000;

// ---------------------------------------------------------------------------
// Process liveness — is a queue run actually in progress right now, on this
// machine, or is an "in_progress" status left over from one that stopped
// existing without ever updating its own state (crash, SIGKILL, machine
// sleep)?
// ---------------------------------------------------------------------------

export interface RunLock {
  pid: number;
  startedAt: string;
  runId: string;
}

function lockPath(repoRoot: string): string {
  return join(repoRoot, RUN_LOCK_PATH);
}

export function writeRunLock(repoRoot: string, lock: RunLock): void {
  mkdirSync(join(repoRoot, ".ai", "queue"), { recursive: true });
  writeFileSync(lockPath(repoRoot), JSON.stringify(lock, null, 2) + "\n", "utf8");
}

export function readRunLock(repoRoot: string): RunLock | null {
  const path = lockPath(repoRoot);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as RunLock;
  } catch {
    return null;
  }
}

export function removeRunLock(repoRoot: string): void {
  const path = lockPath(repoRoot);
  if (existsSync(path)) {
    try {
      unlinkSync(path);
    } catch {
      // best-effort — a leftover lock just means the next run's liveness
      // check falls through to the (correct) "process not alive" branch
    }
  }
}

/** Exported for testing — real liveness check is just "does this PID still exist". */
export function isProcessAlive(pid: number): boolean {
  try {
    // Signal 0 sends nothing; it only checks whether the process could be
    // signaled, i.e. whether it exists and is ours to check.
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function isQueueProcessRunning(repoRoot: string): boolean {
  const lock = readRunLock(repoRoot);
  if (!lock) return false;
  return isProcessAlive(lock.pid);
}

// ---------------------------------------------------------------------------
// PR lookup — real GitHub state, the source of truth for reconciliation.
// ---------------------------------------------------------------------------

export interface PrLookupResult {
  number: number;
  state: "OPEN" | "MERGED" | "CLOSED";
  mergedAt: string | null;
  mergeCommitOid: string | null;
  url: string;
}

export type PrLookup = (branch: string) => PrLookupResult | null;

interface GhPrListEntry {
  number: number;
  state: string;
  mergedAt: string | null;
  mergeCommit: { oid: string } | null;
  url: string;
}

/** Real implementation — shells out to `gh`. Injected as a parameter everywhere else so reconciliation logic itself stays pure and unit-testable without a network call. */
export function lookupPrForBranch(repoRoot: string): PrLookup {
  return (branch: string): PrLookupResult | null => {
    const result = runCommand(
      "gh",
      ["pr", "list", "--head", branch, "--state", "all", "--json", "number,state,mergedAt,mergeCommit,url", "--limit", "1"],
      repoRoot,
      GH_LOOKUP_TIMEOUT_MS
    );
    if (!result.ok) return null;
    let parsed: GhPrListEntry[];
    try {
      parsed = JSON.parse(result.stdout) as GhPrListEntry[];
    } catch {
      return null;
    }
    if (parsed.length === 0) return null;
    const pr = parsed[0];
    if (pr.state !== "OPEN" && pr.state !== "MERGED" && pr.state !== "CLOSED") return null;
    return {
      number: pr.number,
      state: pr.state,
      mergedAt: pr.mergedAt,
      mergeCommitOid: pr.mergeCommit?.oid ?? null,
      url: pr.url,
    };
  };
}

// ---------------------------------------------------------------------------
// Classification and reconciliation — pure, unit-tested directly.
// ---------------------------------------------------------------------------

export type TaskLiveClassification =
  | "not_applicable" // status isn't in_progress; nothing to classify
  | "running" // an active queue process (verified via the lock file + a live PID) owns this task right now
  | "stale_pr_merged" // no active process, and GitHub confirms the task's PR merged — it actually succeeded
  | "stale_pr_open" // no active process, PR exists and is still open — not stale exactly, but not verifiably done either; never guess
  | "stale_pr_closed" // no active process, PR was closed without merging — genuinely did not complete
  | "stale_no_evidence"; // no active process and no PR found at all — likely crashed before ever pushing

export interface TaskClassification {
  classification: TaskLiveClassification;
  pr: PrLookupResult | null;
}

export function classifyTaskState(task: QueueTask, stateEntry: TaskState, lookupPr: PrLookup, queueProcessRunning: boolean): TaskClassification {
  if (stateEntry.status !== "in_progress") {
    return { classification: "not_applicable", pr: null };
  }
  if (queueProcessRunning) {
    return { classification: "running", pr: null };
  }
  const branch = stateEntry.branch ?? task.branch;
  const pr = branch ? lookupPr(branch) : null;
  if (!pr) return { classification: "stale_no_evidence", pr: null };
  if (pr.state === "MERGED") return { classification: "stale_pr_merged", pr };
  if (pr.state === "OPEN") return { classification: "stale_pr_open", pr };
  return { classification: "stale_pr_closed", pr };
}

export interface ReconciliationChange {
  taskId: string;
  before: string;
  after: string;
  reason: string;
}

/**
 * Reconciles one task's state. Only ever changes a task away from
 * "in_progress" — never touches pending/completed/failed/disabled/skipped
 * tasks, and never fabricates a field: every value written comes directly
 * from the verified `PrLookupResult`, or is left as `null`/unchanged.
 */
export function reconcileTaskState(task: QueueTask, stateEntry: TaskState, lookupPr: PrLookup, queueProcessRunning: boolean): { stateEntry: TaskState; change: ReconciliationChange | null } {
  const { classification, pr } = classifyTaskState(task, stateEntry, lookupPr, queueProcessRunning);

  switch (classification) {
    case "not_applicable":
    case "running":
    case "stale_pr_open":
      return { stateEntry, change: null };

    case "stale_pr_merged": {
      const reconciled: TaskState = {
        ...stateEntry,
        status: "completed",
        branch: stateEntry.branch ?? task.branch,
        pr: pr!.url,
        commit: pr!.mergeCommitOid,
        completed_at: pr!.mergedAt,
        tests: stateEntry.tests ?? "passed (inferred from merged PR — the original run's own recorded quality-gate result was not available to reconcile)",
        blocker: null,
      };
      return {
        stateEntry: reconciled,
        change: {
          taskId: task.id,
          before: "in_progress",
          after: "completed",
          reason: `PR #${pr!.number} for branch ${reconciled.branch} is merged (verified via gh) — reconciled from real GitHub state, not fabricated.`,
        },
      };
    }

    case "stale_pr_closed":
    case "stale_no_evidence": {
      const branch = stateEntry.branch ?? task.branch;
      const reasonDetail =
        classification === "stale_pr_closed"
          ? `PR #${pr!.number} for branch ${branch} was closed without merging`
          : `no PR was found for branch ${branch ?? "(no branch recorded)"}`;
      const blocker = `stale in_progress state detected: no active queue process, and ${reasonDetail} — this looks like a crashed or interrupted run, not a success. Investigate manually; this state was reconciled honestly (marked failed), never silently resumed or guessed complete.`;
      const reconciled: TaskState = { ...stateEntry, status: "failed", blocker };
      return {
        stateEntry: reconciled,
        change: { taskId: task.id, before: "in_progress", after: "failed", reason: blocker },
      };
    }
  }
}

export interface ReconciliationResult {
  state: QueueState;
  changes: ReconciliationChange[];
}

export function reconcileQueueState(queue: RunQueue, state: QueueState, lookupPr: PrLookup, queueProcessRunning: boolean): ReconciliationResult {
  const changes: ReconciliationChange[] = [];
  const tasks = state.tasks.map((entry) => {
    const task = queue.tasks.find((t) => t.id === entry.id);
    if (!task) return entry;
    const { stateEntry, change } = reconcileTaskState(task, entry, lookupPr, queueProcessRunning);
    if (change) changes.push(change);
    return stateEntry;
  });
  return { state: { ...state, tasks }, changes };
}

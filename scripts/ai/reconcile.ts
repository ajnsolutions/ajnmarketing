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
  /** The branch this PR targets (e.g. "main") — needed to resolve a merged dependency's base without assuming it always matches queue.base_branch. */
  baseRefName: string | null;
}

export type PrLookup = (branch: string) => PrLookupResult | null;
export type PrLookupByUrl = (prUrl: string) => PrLookupResult | null;

interface GhPrListEntry {
  number: number;
  state: string;
  mergedAt: string | null;
  mergeCommit: { oid: string } | null;
  url: string;
  baseRefName?: string;
}

/** Real implementation — shells out to `gh`. Injected as a parameter everywhere else so reconciliation logic itself stays pure and unit-testable without a network call. */
export function lookupPrForBranch(repoRoot: string): PrLookup {
  return (branch: string): PrLookupResult | null => {
    const result = runCommand(
      "gh",
      ["pr", "list", "--head", branch, "--state", "all", "--json", "number,state,mergedAt,mergeCommit,url,baseRefName", "--limit", "1"],
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
      baseRefName: pr.baseRefName ?? null,
    };
  };
}

/**
 * Looks up a PR by its known URL (e.g. the value already recorded in
 * TaskState.pr for a completed task) rather than searching by branch name —
 * an exact lookup against a specific PR number, more reliable than a
 * branch-name search when the branch itself may no longer exist as a ref.
 * Real implementation — shells out to `gh pr view`.
 */
export function lookupPrByUrl(repoRoot: string): PrLookupByUrl {
  return (prUrl: string): PrLookupResult | null => {
    const match = prUrl.match(/\/pull\/(\d+)/);
    if (!match) return null;
    const result = runCommand("gh", ["pr", "view", match[1], "--json", "number,state,mergedAt,mergeCommit,url,baseRefName"], repoRoot, GH_LOOKUP_TIMEOUT_MS);
    if (!result.ok) return null;
    let parsed: GhPrListEntry;
    try {
      parsed = JSON.parse(result.stdout) as GhPrListEntry;
    } catch {
      return null;
    }
    if (parsed.state !== "OPEN" && parsed.state !== "MERGED" && parsed.state !== "CLOSED") return null;
    return {
      number: parsed.number,
      state: parsed.state,
      mergedAt: parsed.mergedAt,
      mergeCommitOid: parsed.mergeCommit?.oid ?? null,
      url: parsed.url,
      baseRefName: parsed.baseRefName ?? null,
    };
  };
}

// ---------------------------------------------------------------------------
// Git ref resolution — real implementations shell out to git; injected
// everywhere else so the resolution logic itself stays pure and testable.
// ---------------------------------------------------------------------------

export type RefResolver = (ref: string) => string | null;
export type AncestorCheck = (commit: string, ref: string) => boolean;

/** Resolves a ref (branch, remote-tracking ref, or commit) to its commit SHA, or null if it doesn't exist. Never throws. */
export function resolveGitRef(repoRoot: string): RefResolver {
  return (ref: string): string | null => {
    const result = runCommand("git", ["rev-parse", "--verify", `${ref}^{commit}`], repoRoot, GH_LOOKUP_TIMEOUT_MS);
    return result.ok ? result.stdout.trim() : null;
  };
}

/** True if `commit` is an ancestor of `ref` (i.e. already part of that ref's history) — the actual proof that a dependency's work really landed on the base being proposed, not just an assumption. */
export function isAncestorRef(repoRoot: string): AncestorCheck {
  return (commit: string, ref: string): boolean => {
    const result = runCommand("git", ["merge-base", "--is-ancestor", commit, ref], repoRoot, GH_LOOKUP_TIMEOUT_MS);
    return result.ok;
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

// ---------------------------------------------------------------------------
// Dependency-base resolution (2026-08-02, second incident same day as the
// completion-state fix above).
//
// Root cause: Task 001 completed and merged as PR #101, and its local
// branch (correctly) got deleted. Task 002 (depends_on: ["001"]) then tried
// to branch from Task 001's *recorded branch name*
// (`ai-queue/001-market-radar-foundation`) directly — a plain, un-prefixed
// local branch reference — which no longer existed, so
// `git checkout -b ai-queue/002-... ai-queue/001-market-radar-foundation`
// failed outright: "fatal: 'ai-queue/001-market-radar-foundation' is not a
// commit". The old `determineBranchBase()` unconditionally used a
// completed dependency's *branch*, forever, regardless of whether it had
// since been merged and cleaned up — the queue was requiring a merged
// dependency branch to survive indefinitely, which no normal PR workflow
// (including this repository's own habit of deleting merged branches)
// guarantees.
//
// resolveDependencyBase() replaces that with three explicit, verified
// cases instead of one unconditional assumption:
//   1. Dependency's PR is verified MERGED (via a real `gh pr view` lookup,
//      not just trusting the locally-recorded branch/commit) — use the
//      PR's actual merge target (normally origin/main), and REQUIRE that
//      the recorded merge commit is a real ancestor of that ref
//      (`git merge-base --is-ancestor`) before trusting it. A merged
//      dependency's branch is never required to still exist.
//   2. Dependency's PR is still OPEN — use its branch (preferring the
//      remote-tracking ref, origin/<branch>, over a possibly-stale local
//      one) for a genuinely stacked build. Fails clearly, not silently,
//      if that branch can't be resolved either way.
//   3. Neither a merged PR nor a resolvable branch can be found for a
//      dependency marked "completed" — stop safely with an actionable
//      error. NEVER falls back to guessing origin/main in this case; a
//      "completed" task with no verifiable evidence is a queue-state
//      inconsistency to investigate, not something to paper over.
// ---------------------------------------------------------------------------

export interface BaseResolution {
  ok: boolean;
  /** The resolved git ref (e.g. "origin/main" or "origin/ai-queue/001-foo") to branch the next task from. Null when ok is false. */
  ref: string | null;
  /** Human-readable explanation of why this ref was chosen — recorded in task logs, RUN_SUMMARY.md, RUN_STATUS.json, and queue-status output. Empty when ok is false (see `error` instead). */
  reason: string;
  /** Actionable explanation of what went wrong and what to do about it. Null when ok is true. */
  error: string | null;
}

function uniqueDefined(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.filter((v): v is string => Boolean(v)))];
}

/**
 * Resolves the git ref a task should branch from, given its queue
 * definition, dependency chain, and current state. Pure aside from the
 * three injected functions (`lookupPrByUrl`, `resolveRef`, `isAncestor`),
 * which is what makes this fully unit-testable without a real git repo or
 * network access — see unit-tests/ai-queue-base-resolution.test.ts.
 */
export function resolveDependencyBase(
  queue: RunQueue,
  task: QueueTask,
  state: QueueState,
  lookupPrByUrlFn: PrLookupByUrl,
  resolveRef: RefResolver,
  isAncestor: AncestorCheck
): BaseResolution {
  const baseBranchRef = `origin/${queue.queue.base_branch}`;

  if (queue.queue.branch_strategy !== "stacked" || task.depends_on.length === 0) {
    return { ok: true, ref: baseBranchRef, reason: "no stacked dependency for this task — using the queue base branch", error: null };
  }

  const lastDepId = task.depends_on[task.depends_on.length - 1];
  const depTask = queue.tasks.find((t) => t.id === lastDepId);
  const depState = state.tasks.find((t) => t.id === lastDepId);

  if (!depTask || !depState) {
    return { ok: false, ref: null, reason: "", error: `dependency task "${lastDepId}" was not found in the queue definition or state — cannot resolve a base for "${task.id}".` };
  }
  if (depState.status !== "completed") {
    return {
      ok: false,
      ref: null,
      reason: "",
      error: `dependency "${lastDepId}" is not completed (status: "${depState.status}") — cannot resolve a base for "${task.id}" until it finishes. This should not normally happen (selectNextEligibleTask already requires completed dependencies) — investigate if seen.`,
    };
  }

  const branchCandidates = uniqueDefined([depState.branch, depTask.branch]);

  function resolveBranchDirectly(reasonPrefix: string): BaseResolution | null {
    for (const branch of branchCandidates) {
      const remoteRef = `origin/${branch}`;
      if (resolveRef(remoteRef)) {
        return { ok: true, ref: remoteRef, reason: `${reasonPrefix} — using its remote-tracking branch ${remoteRef}`, error: null };
      }
    }
    for (const branch of branchCandidates) {
      if (resolveRef(branch)) {
        return { ok: true, ref: branch, reason: `${reasonPrefix} — using its local branch ${branch} (no remote-tracking ref found; prefer pushing so origin/${branch} exists)`, error: null };
      }
    }
    return null;
  }

  if (!depState.pr) {
    // No PR recorded at all for a "completed" dependency. Try its branch
    // directly as a last resort before giving up — but this is already a
    // weaker signal than a verified PR, so it's tried last, not first.
    const direct = resolveBranchDirectly(`dependency "${lastDepId}" has no recorded PR`);
    if (direct) return direct;
    return {
      ok: false,
      ref: null,
      reason: "",
      error: `dependency "${lastDepId}" is marked completed, but it has no recorded PR and neither a remote nor local branch (${branchCandidates.join(" / ") || "none recorded"}) could be resolved. Cannot verify what it actually produced — refusing to guess ${baseBranchRef}. Investigate manually, or run "npm run ai:queue:reconcile".`,
    };
  }

  const pr = lookupPrByUrlFn(depState.pr);
  if (!pr) {
    return {
      ok: false,
      ref: null,
      reason: "",
      error: `dependency "${lastDepId}" is marked completed with PR ${depState.pr}, but that PR could not be verified via "gh pr view" — stop, do not guess. Check network/auth ("gh auth status"), confirm the PR still exists, or run "npm run ai:queue:reconcile".`,
    };
  }

  if (pr.state === "MERGED") {
    const targetBranch = pr.baseRefName || queue.queue.base_branch;
    const target = `origin/${targetBranch}`;
    if (!pr.mergeCommitOid) {
      return {
        ok: false,
        ref: null,
        reason: "",
        error: `dependency "${lastDepId}"'s PR #${pr.number} is merged, but GitHub recorded no merge commit — cannot verify ancestry, refusing to guess the base.`,
      };
    }
    const targetSha = resolveRef(target);
    if (!targetSha) {
      return {
        ok: false,
        ref: null,
        reason: "",
        error: `base ref "${target}" does not resolve locally — fetch may have failed, or the branch was renamed/deleted. Run "git fetch origin" and retry.`,
      };
    }
    if (!isAncestor(pr.mergeCommitOid, target)) {
      return {
        ok: false,
        ref: null,
        reason: "",
        error: `dependency "${lastDepId}"'s merge commit ${pr.mergeCommitOid} (PR #${pr.number}) could not be verified as an ancestor of ${target} — refusing to guess the base. ${target} may be stale locally (try "git fetch origin"), or the merge history is not what was expected.`,
      };
    }
    return {
      ok: true,
      ref: target,
      reason: `dependency "${lastDepId}" completed via PR #${pr.number}, verified MERGED into ${targetBranch}; merge commit ${pr.mergeCommitOid} confirmed as an ancestor of ${target} — the merged dependency branch is not required to still exist.`,
      error: null,
    };
  }

  if (pr.state === "OPEN") {
    const direct = resolveBranchDirectly(`dependency "${lastDepId}"'s PR #${pr.number} is still open (not yet merged)`);
    if (direct) return direct;
    return {
      ok: false,
      ref: null,
      reason: "",
      error: `dependency "${lastDepId}"'s PR #${pr.number} is open but unmerged, and its branch (${branchCandidates.join(" / ") || "none recorded"}) could not be resolved locally or remotely. Fetch and retry ("git fetch origin"), or investigate why the branch is missing.`,
    };
  }

  // CLOSED without merging — should not happen for a task marked
  // "completed", but never guess main just because a branch might resolve.
  return {
    ok: false,
    ref: null,
    reason: "",
    error: `dependency "${lastDepId}" is marked completed, but its PR #${pr.number} was closed WITHOUT merging — queue state is inconsistent. Run "npm run ai:queue:reconcile" or investigate manually before retrying "${task.id}".`,
  };
}

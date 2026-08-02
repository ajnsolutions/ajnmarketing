import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { resolveDependencyBase, resolveGitRef, isAncestorRef, type PrLookupResult, type PrLookupByUrl, type RefResolver, type AncestorCheck } from "../scripts/ai/reconcile.ts";
import { selectNextEligibleTask } from "../scripts/ai/run-queue.ts";
import type { QueueState, QueueTask, RunQueue, TaskState } from "../scripts/ai/queueTypes.ts";

/**
 * Regression coverage for the real 2026-08-02 incident: Task 001 merged as
 * PR #101 and its local branch was (correctly) deleted. Task 002
 * (depends_on: ["001"]) then tried `git checkout -b ai-queue/002-...
 * ai-queue/001-market-radar-foundation` directly and failed outright —
 * "fatal: 'ai-queue/001-market-radar-foundation' is not a commit" — because
 * the old determineBranchBase() unconditionally reused a completed
 * dependency's recorded branch name forever, requiring it to survive
 * indefinitely. resolveDependencyBase() (scripts/ai/reconcile.ts) replaces
 * that with three explicit, GitHub-verified cases — see its own header
 * comment and .ai/DECISIONS.md for the ADR.
 */

function task(overrides: Partial<QueueTask> = {}): QueueTask {
  return {
    id: "002",
    name: "Task",
    prompt: "prompts/002.md",
    branch: "ai-queue/002",
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

function queueWith(tasks: QueueTask[], branchStrategy: "independent" | "stacked" = "stacked", baseBranch = "main"): RunQueue {
  return {
    queue: { name: "q", project: "p", execution_mode: "sequential", stop_on_failure: true, branch_strategy: branchStrategy, base_branch: baseBranch, default_agent: "claude" },
    safety: { allow_merge: false, allow_deploy: false, allow_production_migrations: false, allow_secret_changes: false, allow_production_schedule_activation: false },
    tasks,
  };
}

function stateEntry(overrides: Partial<TaskState> = {}): TaskState {
  return { id: "001", name: "Dependency", status: "completed", branch: null, commit: null, pr: null, started_at: "x", completed_at: "y", tests: "passed", blocker: null, ...overrides };
}

function stateWith(entries: TaskState[]): QueueState {
  return { queue_name: "q", generated_at: "x", generated_by: "test", current_task: null, last_run_id: "run", resume_eligible: false, tasks: entries };
}

function mergedPrResult(overrides: Partial<PrLookupResult> = {}): PrLookupResult {
  return { number: 101, state: "MERGED", mergedAt: "2026-08-02T13:58:34Z", mergeCommitOid: "895f5d3360530938184588a07ae87cbe13e1477a", url: "https://github.com/ajnsolutions/ajnmarketing/pull/101", baseRefName: "main", ...overrides };
}

function fakeLookup(byUrl: Record<string, PrLookupResult | null>): PrLookupByUrl {
  return (url) => (url in byUrl ? byUrl[url] : null);
}
function fakeResolveRef(existing: Record<string, string>): RefResolver {
  return (ref) => existing[ref] ?? null;
}
function fakeIsAncestor(pairs: Record<string, string[]>): AncestorCheck {
  return (commit, ref) => (pairs[commit] ?? []).includes(ref);
}

// ---------------------------------------------------------------------------
// 1. Merged dependency with deleted local AND remote branch uses origin/main
// ---------------------------------------------------------------------------

test("a merged dependency whose branch has been deleted (local and remote) resolves to origin/main — the exact PR #101 -> Task 002 incident", () => {
  const dep = task({ id: "001", branch: "ai-queue/001-market-radar-foundation" });
  const t002 = task({ id: "002", branch: "ai-queue/002-market-radar-view", depends_on: ["001"] });
  const queue = queueWith([dep, t002]);
  const state = stateWith([
    stateEntry({ id: "001", branch: "ai-queue/001-market-radar-foundation", pr: "https://github.com/ajnsolutions/ajnmarketing/pull/101" }),
    stateEntry({ id: "002", status: "pending" }),
  ]);
  const lookupPr = fakeLookup({ "https://github.com/ajnsolutions/ajnmarketing/pull/101": mergedPrResult() });
  // Note: "ai-queue/001-market-radar-foundation" and "origin/ai-queue/001-market-radar-foundation" are deliberately ABSENT here — deleted, exactly like the real incident.
  const resolveRef = fakeResolveRef({ "origin/main": "mainSha" });
  const isAncestor = fakeIsAncestor({ "895f5d3360530938184588a07ae87cbe13e1477a": ["origin/main"] });

  const result = resolveDependencyBase(queue, t002, state, lookupPr, resolveRef, isAncestor);
  assert.equal(result.ok, true, result.error ?? "");
  assert.equal(result.ref, "origin/main");
  assert.match(result.reason, /not required to still exist/);
});

// ---------------------------------------------------------------------------
// 2. Merged dependency commit must be contained in the chosen base
// ---------------------------------------------------------------------------

test("refuses to trust a merged dependency's base until its merge commit is verified as an ancestor of that base", () => {
  const dep = task({ id: "001" });
  const t002 = task({ id: "002", depends_on: ["001"] });
  const queue = queueWith([dep, t002]);
  const state = stateWith([stateEntry({ id: "001", pr: "https://github.com/x/y/pull/101" }), stateEntry({ id: "002", status: "pending" })]);
  const lookupPr = fakeLookup({ "https://github.com/x/y/pull/101": mergedPrResult() });
  const resolveRef = fakeResolveRef({ "origin/main": "mainSha" });
  // isAncestor deliberately returns false for every pair -- simulates a base
  // that's stale locally, or a merge commit that doesn't actually reach it.
  const isAncestor = fakeIsAncestor({});

  const result = resolveDependencyBase(queue, t002, state, lookupPr, resolveRef, isAncestor);
  assert.equal(result.ok, false);
  assert.match(result.error!, /could not be verified as an ancestor/);
});

test("refuses to guess when a merged PR has no recorded merge commit at all", () => {
  const dep = task({ id: "001" });
  const t002 = task({ id: "002", depends_on: ["001"] });
  const queue = queueWith([dep, t002]);
  const state = stateWith([stateEntry({ id: "001", pr: "https://github.com/x/y/pull/101" }), stateEntry({ id: "002", status: "pending" })]);
  const lookupPr = fakeLookup({ "https://github.com/x/y/pull/101": mergedPrResult({ mergeCommitOid: null }) });
  const result = resolveDependencyBase(queue, t002, state, lookupPr, fakeResolveRef({ "origin/main": "mainSha" }), fakeIsAncestor({}));
  assert.equal(result.ok, false);
  assert.match(result.error!, /no merge commit/);
});

test("REAL git: a genuine merge commit is verified as an ancestor of main; an unrelated commit is correctly rejected", () => {
  const repoRoot = mkdtempSync(join(tmpdir(), "ai-queue-ancestry-test-"));
  try {
    execFileSync("git", ["init", "-q", "-b", "main"], { cwd: repoRoot });
    execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: repoRoot });
    execFileSync("git", ["config", "user.name", "Test"], { cwd: repoRoot });
    writeFileSync(join(repoRoot, "a.txt"), "a");
    execFileSync("git", ["add", "-A"], { cwd: repoRoot });
    execFileSync("git", ["commit", "-q", "-m", "initial"], { cwd: repoRoot });

    execFileSync("git", ["checkout", "-q", "-b", "feature"], { cwd: repoRoot });
    writeFileSync(join(repoRoot, "b.txt"), "b");
    execFileSync("git", ["add", "-A"], { cwd: repoRoot });
    execFileSync("git", ["commit", "-q", "-m", "feature work"], { cwd: repoRoot });
    const featureSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();

    execFileSync("git", ["checkout", "-q", "main"], { cwd: repoRoot });
    execFileSync("git", ["merge", "--no-ff", "-q", "-m", "merge feature", "feature"], { cwd: repoRoot });
    const mergeSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();

    // An unrelated, orphan commit that never touched main.
    execFileSync("git", ["checkout", "-q", "--orphan", "unrelated"], { cwd: repoRoot });
    writeFileSync(join(repoRoot, "c.txt"), "c");
    execFileSync("git", ["add", "-A"], { cwd: repoRoot });
    execFileSync("git", ["commit", "-q", "-m", "unrelated"], { cwd: repoRoot });
    const unrelatedSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();

    const isAncestor = isAncestorRef(repoRoot);
    assert.equal(isAncestor(featureSha, "main"), true, "the feature branch's own commit is a real ancestor of the merge commit it fed into main");
    assert.equal(isAncestor(mergeSha, "main"), true, "the merge commit itself is trivially an ancestor of main");
    assert.equal(isAncestor(unrelatedSha, "main"), false, "an orphan commit that never touched main must not be reported as an ancestor");

    const resolveRef = resolveGitRef(repoRoot);
    assert.equal(resolveRef("main"), mergeSha);
    assert.equal(resolveRef("does-not-exist"), null);
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// 3. Open dependency PR uses its branch for stacked work
// ---------------------------------------------------------------------------

test("an open (unmerged) dependency PR uses its own remote branch as the base for a stacked build", () => {
  const dep = task({ id: "001", branch: "ai-queue/001-open" });
  const t002 = task({ id: "002", depends_on: ["001"] });
  const queue = queueWith([dep, t002]);
  const state = stateWith([stateEntry({ id: "001", branch: "ai-queue/001-open", pr: "https://github.com/x/y/pull/55" }), stateEntry({ id: "002", status: "pending" })]);
  const lookupPr = fakeLookup({ "https://github.com/x/y/pull/55": mergedPrResult({ number: 55, state: "OPEN", mergedAt: null, mergeCommitOid: null }) });
  const resolveRef = fakeResolveRef({ "origin/ai-queue/001-open": "openSha" });

  const result = resolveDependencyBase(queue, t002, state, lookupPr, resolveRef, fakeIsAncestor({}));
  assert.equal(result.ok, true, result.error ?? "");
  assert.equal(result.ref, "origin/ai-queue/001-open");
  assert.match(result.reason, /still open/);
});

// ---------------------------------------------------------------------------
// 4. Missing unmerged dependency branch fails clearly
// ---------------------------------------------------------------------------

test("an open dependency PR whose branch cannot be resolved locally or remotely fails clearly, not silently", () => {
  const dep = task({ id: "001", branch: "ai-queue/001-missing" });
  const t002 = task({ id: "002", depends_on: ["001"] });
  const queue = queueWith([dep, t002]);
  const state = stateWith([stateEntry({ id: "001", branch: "ai-queue/001-missing", pr: "https://github.com/x/y/pull/55" }), stateEntry({ id: "002", status: "pending" })]);
  const lookupPr = fakeLookup({ "https://github.com/x/y/pull/55": mergedPrResult({ number: 55, state: "OPEN", mergedAt: null, mergeCommitOid: null }) });
  // Neither the remote-tracking ref nor the bare local branch resolves.
  const result = resolveDependencyBase(queue, t002, state, lookupPr, fakeResolveRef({}), fakeIsAncestor({}));
  assert.equal(result.ok, false);
  assert.equal(result.ref, null);
  assert.match(result.error!, /could not be resolved locally or remotely/);
});

test("a completed dependency with no PR at all and no resolvable branch fails clearly rather than guessing main", () => {
  const dep = task({ id: "001", branch: "ai-queue/001-gone" });
  const t002 = task({ id: "002", depends_on: ["001"] });
  const queue = queueWith([dep, t002]);
  const state = stateWith([stateEntry({ id: "001", branch: "ai-queue/001-gone", pr: null }), stateEntry({ id: "002", status: "pending" })]);
  const result = resolveDependencyBase(queue, t002, state, fakeLookup({}), fakeResolveRef({}), fakeIsAncestor({}));
  assert.equal(result.ok, false);
  assert.match(result.error!, /no recorded PR and neither a remote nor local branch/);
  assert.doesNotMatch(result.error!, /^$/);
});

test("a completed dependency whose PR could not be verified via gh fails clearly rather than guessing", () => {
  const dep = task({ id: "001" });
  const t002 = task({ id: "002", depends_on: ["001"] });
  const queue = queueWith([dep, t002]);
  const state = stateWith([stateEntry({ id: "001", pr: "https://github.com/x/y/pull/999" }), stateEntry({ id: "002", status: "pending" })]);
  // lookupPr returns null -- gh failed (network/auth issue, or PR truly gone).
  const result = resolveDependencyBase(queue, t002, state, fakeLookup({}), fakeResolveRef({}), fakeIsAncestor({}));
  assert.equal(result.ok, false);
  assert.match(result.error!, /could not be verified via "gh pr view"/);
});

test("a dependency whose PR was closed without merging fails clearly, never silently uses main", () => {
  const dep = task({ id: "001" });
  const t002 = task({ id: "002", depends_on: ["001"] });
  const queue = queueWith([dep, t002]);
  const state = stateWith([stateEntry({ id: "001", pr: "https://github.com/x/y/pull/7" }), stateEntry({ id: "002", status: "pending" })]);
  const lookupPr = fakeLookup({ "https://github.com/x/y/pull/7": mergedPrResult({ number: 7, state: "CLOSED", mergedAt: null, mergeCommitOid: null }) });
  const result = resolveDependencyBase(queue, t002, state, lookupPr, fakeResolveRef({ "origin/main": "mainSha" }), fakeIsAncestor({}));
  assert.equal(result.ok, false);
  assert.match(result.error!, /closed WITHOUT merging/);
});

// ---------------------------------------------------------------------------
// 5. Stale local dependency branch does not override verified remote/merge state
// ---------------------------------------------------------------------------

test("a stale local dependency branch that still happens to exist does not override a verified merged PR", () => {
  const dep = task({ id: "001", branch: "ai-queue/001-stale-leftover" });
  const t002 = task({ id: "002", depends_on: ["001"] });
  const queue = queueWith([dep, t002]);
  const state = stateWith([stateEntry({ id: "001", branch: "ai-queue/001-stale-leftover", pr: "https://github.com/x/y/pull/101" }), stateEntry({ id: "002", status: "pending" })]);
  const lookupPr = fakeLookup({ "https://github.com/x/y/pull/101": mergedPrResult() });
  // BOTH the stale old branch and origin/main resolve successfully here --
  // proving the merged case doesn't even consult the branch candidates,
  // regardless of whether one happens to still be lying around locally.
  const resolveRef = fakeResolveRef({ "ai-queue/001-stale-leftover": "staleSha", "origin/ai-queue/001-stale-leftover": "staleSha", "origin/main": "mainSha" });
  const isAncestor = fakeIsAncestor({ "895f5d3360530938184588a07ae87cbe13e1477a": ["origin/main"] });

  const result = resolveDependencyBase(queue, t002, state, lookupPr, resolveRef, isAncestor);
  assert.equal(result.ok, true);
  assert.equal(result.ref, "origin/main");
  assert.notEqual(result.ref, "ai-queue/001-stale-leftover");
  assert.notEqual(result.ref, "origin/ai-queue/001-stale-leftover");
});

// ---------------------------------------------------------------------------
// Trivial cases (no dependency / independent strategy) still work as before
// ---------------------------------------------------------------------------

test("a task with no dependencies always resolves to the queue base branch", () => {
  const t001 = task({ id: "001", depends_on: [] });
  const queue = queueWith([t001]);
  const state = stateWith([stateEntry({ id: "001", status: "pending" })]);
  const result = resolveDependencyBase(queue, t001, state, fakeLookup({}), fakeResolveRef({}), fakeIsAncestor({}));
  assert.equal(result.ok, true);
  assert.equal(result.ref, "origin/main");
  assert.match(result.reason, /no stacked dependency/);
});

test("independent branch_strategy always resolves to the queue base branch, even for a dependent task", () => {
  const dep = task({ id: "001" });
  const t002 = task({ id: "002", depends_on: ["001"] });
  const queue = queueWith([dep, t002], "independent");
  const state = stateWith([stateEntry({ id: "001", pr: "https://github.com/x/y/pull/101" }), stateEntry({ id: "002", status: "pending" })]);
  const result = resolveDependencyBase(queue, t002, state, fakeLookup({}), fakeResolveRef({}), fakeIsAncestor({}));
  assert.equal(result.ok, true);
  assert.equal(result.ref, "origin/main");
});

// ---------------------------------------------------------------------------
// 6. Task 002 becomes eligible after reconciliation — the real fix, end to end
// ---------------------------------------------------------------------------

test("Task 002 becomes eligible once Task 001 is correctly recorded completed — the actual PR #101 fix", () => {
  const t001 = task({ id: "001", name: "Market Radar: persistence foundation", branch: "ai-queue/001-market-radar-foundation", depends_on: [] });
  const t002 = task({ id: "002", name: "Market Radar: owner-facing view", branch: "ai-queue/002-market-radar-view", depends_on: ["001"] });
  const queue = queueWith([t001, t002]);
  const state = stateWith([
    stateEntry({ id: "001", status: "completed", branch: "ai-queue/001-market-radar-foundation", commit: "79f23901a431da39b41dd0f226976de40f4bcd76", pr: "https://github.com/ajnsolutions/ajnmarketing/pull/101" }),
    stateEntry({ id: "002", status: "pending", branch: null, commit: null, pr: null, completed_at: null, tests: null }),
  ]);
  const next = selectNextEligibleTask(queue, state);
  assert.equal(next?.id, "002");
});

// ---------------------------------------------------------------------------
// 7. Branch creation uses the resolved base — real git, end to end
// ---------------------------------------------------------------------------

test("REAL git: creating the next task's branch from the resolved ref actually works and lands on the right commit", () => {
  const repoRoot = mkdtempSync(join(tmpdir(), "ai-queue-checkout-test-"));
  try {
    execFileSync("git", ["init", "-q", "-b", "main"], { cwd: repoRoot });
    execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: repoRoot });
    execFileSync("git", ["config", "user.name", "Test"], { cwd: repoRoot });
    writeFileSync(join(repoRoot, "a.txt"), "a");
    execFileSync("git", ["add", "-A"], { cwd: repoRoot });
    execFileSync("git", ["commit", "-q", "-m", "initial"], { cwd: repoRoot });

    // Simulate Task 001: a feature branch, merged into main, then deleted --
    // exactly the real incident's starting condition.
    execFileSync("git", ["checkout", "-q", "-b", "ai-queue/001-market-radar-foundation"], { cwd: repoRoot });
    writeFileSync(join(repoRoot, "market-radar.txt"), "persistence layer");
    execFileSync("git", ["add", "-A"], { cwd: repoRoot });
    execFileSync("git", ["commit", "-q", "-m", "Task 001 work"], { cwd: repoRoot });
    execFileSync("git", ["checkout", "-q", "main"], { cwd: repoRoot });
    execFileSync("git", ["merge", "--no-ff", "-q", "-m", "merge Task 001", "ai-queue/001-market-radar-foundation"], { cwd: repoRoot });
    const mainSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
    execFileSync("git", ["branch", "-D", "ai-queue/001-market-radar-foundation"], { cwd: repoRoot }); // deleted, like the real incident

    // Resolve the base using the REAL functions (no fakes) — treating "main"
    // as if it were "origin/main" is fine here since resolveGitRef/isAncestorRef
    // only care that the ref string given resolves via real git, and this
    // test's goal is proving checkout-from-resolved-ref works, not exercising
    // the origin/ prefix convention itself (already covered by other tests).
    const resolveRef = resolveGitRef(repoRoot);
    const isAncestor = isAncestorRef(repoRoot);
    assert.equal(resolveRef("main"), mainSha);
    assert.ok(isAncestor(mainSha, "main"));

    // Now actually create Task 002's branch FROM the resolved ref, exactly as
    // run-queue.ts's attemptTask() does: `git checkout -b <branch> <resolvedRef>`.
    execFileSync("git", ["checkout", "-q", "-b", "ai-queue/002-market-radar-view", "main"], { cwd: repoRoot });
    const newBranchSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
    assert.equal(newBranchSha, mainSha, "the new branch must start exactly at the resolved base, not some other commit");

    const currentBranch = execFileSync("git", ["branch", "--show-current"], { cwd: repoRoot, encoding: "utf8" }).trim();
    assert.equal(currentBranch, "ai-queue/002-market-radar-view");

    // And Task 001's actual file content must be present, since it's really merged into this base.
    const files = execFileSync("git", ["ls-files"], { cwd: repoRoot, encoding: "utf8" });
    assert.match(files, /market-radar\.txt/);
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});

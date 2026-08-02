import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { finalizeCompletionState } from "../scripts/ai/run-queue.ts";
import type { QueueState } from "../scripts/ai/queueTypes.ts";

/**
 * "successful task persists completed state before commit/PR" — the core
 * regression test for the PR #101 incident (2026-08-02): run-queue.ts used
 * to `git add -A && git commit` a task's real work while QUEUE_STATUS.json
 * on disk still said "in_progress" (the completed flip happened only in
 * memory, after that commit), so the branch that became the PR always
 * carried a stale snapshot. finalizeCompletionState() is the fix — it must
 * make the actual git HEAD, not just the in-memory object, reflect the
 * completed state. This test proves that with a real git repository and
 * real git commands, not mocks, since the bug was entirely about the
 * relationship between disk state and git history.
 */

function initRepoWithRemote(): { base: string; workDir: string; remoteDir: string } {
  const base = mkdtempSync(join(tmpdir(), "ai-queue-completion-test-"));
  const remoteDir = join(base, "remote.git");
  const workDir = join(base, "work");
  mkdirSync(remoteDir, { recursive: true });
  execFileSync("git", ["init", "--bare", "-q"], { cwd: remoteDir });

  execFileSync("git", ["clone", "-q", remoteDir, workDir]);
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: workDir });
  execFileSync("git", ["config", "user.name", "Test"], { cwd: workDir });

  mkdirSync(join(workDir, ".ai", "queue"), { recursive: true });
  return { base, workDir, remoteDir };
}

function commitInitialState(workDir: string, state: QueueState): void {
  writeFileSync(join(workDir, ".ai", "queue", "QUEUE_STATUS.json"), JSON.stringify(state, null, 2) + "\n", "utf8");
  execFileSync("git", ["add", "-A"], { cwd: workDir });
  execFileSync("git", ["commit", "-q", "-m", "Task's real work, plus QUEUE_STATUS.json still in_progress (the bug)"], { cwd: workDir });
}

function baseState(status: string): QueueState {
  return {
    queue_name: "q",
    generated_at: "2026-08-02T00:00:00Z",
    generated_by: "test",
    current_task: status === "in_progress" ? "001" : null,
    last_run_id: "test-run",
    resume_eligible: false,
    tasks: [
      {
        id: "001",
        name: "Test task",
        status,
        branch: status === "completed" ? "ai-queue/001" : null,
        commit: null,
        pr: status === "completed" ? "https://github.com/x/y/pull/1" : null,
        started_at: "2026-08-02T13:46:35.636Z",
        completed_at: status === "completed" ? "2026-08-02T13:53:18Z" : null,
        tests: status === "completed" ? "passed" : null,
        blocker: null,
      },
    ],
  };
}

test("finalizeCompletionState commits the completed state so git HEAD (not just disk) reflects it", () => {
  const { base, workDir, remoteDir } = initRepoWithRemote();
  try {
    // Reproduce the bug's starting condition exactly: a commit already
    // exists on this branch where QUEUE_STATUS.json says "in_progress" —
    // this is what run-queue.ts's `git add -A` / `git commit` for the
    // task's real deliverable work produces, before this fix runs.
    commitInitialState(workDir, baseState("in_progress"));
    execFileSync("git", ["push", "-q", "-u", "origin", "main"], { cwd: workDir });

    const preFixHead = execFileSync("git", ["show", "HEAD:.ai/queue/QUEUE_STATUS.json"], { cwd: workDir, encoding: "utf8" });
    assert.match(preFixHead, /"in_progress"/, "sanity check: the pre-existing commit really does carry the bug's stale state");

    // Now call the actual fix with the already-updated-to-completed state object.
    const completedState = baseState("completed");
    const result = finalizeCompletionState(workDir, completedState, "main");

    assert.equal(result.ok, true, result.output);
    assert.ok(result.commitSha, "a new commit should have been created");

    // The critical assertion: git HEAD — not just the working-tree file —
    // now reflects "completed". This is exactly what was missing before:
    // the in-memory flip never made it into git history before the PR's
    // branch was pushed.
    const postFixHead = execFileSync("git", ["show", "HEAD:.ai/queue/QUEUE_STATUS.json"], { cwd: workDir, encoding: "utf8" });
    assert.match(postFixHead, /"completed"/);
    assert.doesNotMatch(postFixHead, /"in_progress"/);

    // And it's not just committed locally — it was actually pushed, which
    // is what makes it part of the PR a human reviews and merges.
    const remoteHead = execFileSync("git", ["show", `refs/heads/main:.ai/queue/QUEUE_STATUS.json`], { cwd: remoteDir, encoding: "utf8" });
    assert.match(remoteHead, /"completed"/, "the completed state must reach the remote — a local-only commit would not appear in the PR");

    // The working-tree file and git HEAD must agree — no drift between
    // "what's on disk" and "what's actually committed", which was the
    // entire nature of the original bug.
    const onDisk = JSON.parse(readFileSync(join(workDir, ".ai", "queue", "QUEUE_STATUS.json"), "utf8"));
    assert.equal(onDisk.tasks[0].status, "completed");
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("finalizeCompletionState succeeds gracefully (ok: true) when the state was already pushed by a prior attempt — nothing to commit is not an error", () => {
  const { base, workDir } = initRepoWithRemote();
  try {
    const completedState = baseState("completed");
    commitInitialState(workDir, completedState);
    execFileSync("git", ["push", "-q", "-u", "origin", "main"], { cwd: workDir });

    // Calling finalizeCompletionState again with the exact same state that's
    // already committed and pushed must not be treated as a failure.
    const result = finalizeCompletionState(workDir, completedState, "main");
    assert.equal(result.ok, true, result.output);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("finalizeCompletionState fails clearly (ok: false) when the branch has no configured remote to push to", () => {
  const base = mkdtempSync(join(tmpdir(), "ai-queue-completion-test-noremote-"));
  const workDir = join(base, "work");
  try {
    mkdirSync(workDir, { recursive: true });
    execFileSync("git", ["init", "-q", "-b", "main"], { cwd: workDir });
    execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: workDir });
    execFileSync("git", ["config", "user.name", "Test"], { cwd: workDir });
    mkdirSync(join(workDir, ".ai", "queue"), { recursive: true });
    commitInitialState(workDir, baseState("in_progress"));

    const result = finalizeCompletionState(workDir, baseState("completed"), "main");
    assert.equal(result.ok, false);
    assert.match(result.output, /git push failed/);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

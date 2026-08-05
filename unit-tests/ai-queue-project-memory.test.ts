import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  REQUIRED_PROJECT_MEMORY_FILES,
  OPTIONAL_PROJECT_MEMORY_FILES,
  CURRENT_STATUS_PATH,
  STATUS_JSON_PATH,
  HANDOFF_PATH,
  ROADMAP_PATH,
  hasConflictMarkers,
  isTrivialMemoryDiff,
  jsonParseError,
  validateProjectMemoryUpdateCore,
  validateProjectMemoryUpdate,
  buildMemoryRepairPrompt,
  formatMemoryValidationMarkdown,
  runMemoryValidationWithRepair,
  type MemoryFileDiff,
  type MemoryValidationResult,
} from "../scripts/ai/projectMemory.ts";

/**
 * Root-cause regression coverage (2026-08-03): Task 003's real, unattended
 * queue run genuinely completed its implementation AND its Project Memory
 * update — in the same commit, with a real PR already open — but the old
 * check (`git status --porcelain -- .ai/CURRENT_STATUS.md ...`) only ever
 * detects UNCOMMITTED changes, so it saw a clean working tree and failed
 * the task with "no project-memory update". See this module's own header
 * comment and .ai/DECISIONS.md ADR-0017 for the full incident.
 */

function diff(overrides: Partial<MemoryFileDiff> = {}): MemoryFileDiff {
  return { changed: false, diffText: "", currentContent: null, ...overrides };
}

function changedDiff(content: string, previous = ""): MemoryFileDiff {
  const diffText = [
    `--- a/file`,
    `+++ b/file`,
    ...previous.split("\n").map((l) => `-${l}`),
    ...content.split("\n").map((l) => `+${l}`),
  ].join("\n");
  return { changed: true, diffText, currentContent: content };
}

function allUnchangedDiffs(): Record<string, MemoryFileDiff> {
  const out: Record<string, MemoryFileDiff> = {};
  for (const f of [...REQUIRED_PROJECT_MEMORY_FILES, ...OPTIONAL_PROJECT_MEMORY_FILES]) out[f] = diff();
  return out;
}

function validUpdateDiffs(): Record<string, MemoryFileDiff> {
  const diffs = allUnchangedDiffs();
  diffs[CURRENT_STATUS_PATH] = changedDiff("# Current Status\n\nTask X shipped: real, substantive detail about what changed.");
  diffs[STATUS_JSON_PATH] = changedDiff('{"active_initiative": "Task X shipped"}', '{"active_initiative": "old"}');
  diffs[HANDOFF_PATH] = changedDiff("# Handoff\n\nBranch: ai-queue/00X\nStatus: complete.");
  return diffs;
}

// ---------------------------------------------------------------------------
// Pure content checks
// ---------------------------------------------------------------------------

test("hasConflictMarkers detects each of the three conflict marker lines", () => {
  assert.equal(hasConflictMarkers("normal text"), false);
  assert.equal(hasConflictMarkers("<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>> branch"), true);
  assert.equal(hasConflictMarkers("some text\n<<<<<<< HEAD\nmore"), true);
  assert.equal(hasConflictMarkers("some text\n=======\nmore"), true);
  assert.equal(hasConflictMarkers("some text\n>>>>>>> feature\nmore"), true);
});

test("hasConflictMarkers does not false-positive on markdown horizontal rules or similar short runs", () => {
  assert.equal(hasConflictMarkers("---\n\nSome content"), false);
  assert.equal(hasConflictMarkers("======"), false); // only 6 chars, not 7
});

test("jsonParseError returns null for valid JSON, a message for invalid JSON", () => {
  assert.equal(jsonParseError('{"a": 1}'), null);
  assert.notEqual(jsonParseError("{not json"), null);
});

test("isTrivialMemoryDiff: empty diff is trivial", () => {
  assert.equal(isTrivialMemoryDiff(""), true);
});

test("isTrivialMemoryDiff: a diff that only changes a timestamp is trivial", () => {
  const d = [
    `--- a/.ai/STATUS.json`,
    `+++ b/.ai/STATUS.json`,
    `-  "last_verified_at": "2026-08-02T00:00:00Z",`,
    `+  "last_verified_at": "2026-08-03T00:00:00Z",`,
  ].join("\n");
  assert.equal(isTrivialMemoryDiff(d), true);
});

test("isTrivialMemoryDiff: a diff with real added content is not trivial, even alongside a timestamp change", () => {
  const d = [
    `--- a/.ai/STATUS.json`,
    `+++ b/.ai/STATUS.json`,
    `-  "last_verified_at": "2026-08-02T00:00:00Z",`,
    `+  "last_verified_at": "2026-08-03T00:00:00Z",`,
    `+  "active_initiative": "Task 003 shipped the competitor observation engine",`,
  ].join("\n");
  assert.equal(isTrivialMemoryDiff(d), false);
});

// ---------------------------------------------------------------------------
// validateProjectMemoryUpdateCore — the pure decision logic
// ---------------------------------------------------------------------------

test("a valid update (all three required files, non-trivial, HANDOFF present) passes", () => {
  const result = validateProjectMemoryUpdateCore(validUpdateDiffs());
  assert.equal(result.passed, true);
  assert.equal(result.reasons.length, 0);
  assert.ok(result.changedFiles.includes(CURRENT_STATUS_PATH));
  assert.ok(result.changedFiles.includes(STATUS_JSON_PATH));
  assert.ok(result.changedFiles.includes(HANDOFF_PATH));
});

test("no memory file changed at all fails, citing every required file", () => {
  const result = validateProjectMemoryUpdateCore(allUnchangedDiffs());
  assert.equal(result.passed, false);
  assert.equal(result.changedFiles.length, 0);
  for (const f of REQUIRED_PROJECT_MEMORY_FILES) {
    assert.ok(result.reasons.some((r) => r.includes(f)), `expected a reason mentioning ${f}`);
  }
});

test("only an unrelated .ai file changing (not in the recognized set) still fails, exactly like no change at all", () => {
  // Simulates only .ai/queue/QUEUE_STATUS.json or .ai/runs/* changing —
  // neither is in ALL_PROJECT_MEMORY_FILES, so it can never satisfy the
  // requirement no matter how it's diffed.
  const diffs = allUnchangedDiffs();
  const result = validateProjectMemoryUpdateCore(diffs);
  assert.equal(result.passed, false);
  assert.deepEqual(result.changedFiles, []);
});

test("HANDOFF.md not updated fails even when CURRENT_STATUS.md and STATUS.json are", () => {
  const diffs = validUpdateDiffs();
  diffs[HANDOFF_PATH] = diff();
  const result = validateProjectMemoryUpdateCore(diffs);
  assert.equal(result.passed, false);
  assert.ok(result.reasons.some((r) => r.includes(HANDOFF_PATH)));
});

test("invalid STATUS.json fails with a specific reason, even though it changed", () => {
  const diffs = validUpdateDiffs();
  diffs[STATUS_JSON_PATH] = changedDiff("{not valid json", '{"active_initiative": "old"}');
  const result = validateProjectMemoryUpdateCore(diffs);
  assert.equal(result.passed, false);
  assert.ok(result.reasons.some((r) => r.includes("not valid JSON")));
});

test("a timestamp-only change to a required file fails as trivial", () => {
  const diffs = validUpdateDiffs();
  diffs[CURRENT_STATUS_PATH] = changedDiff("**Date last verified:** 2026-08-03", "**Date last verified:** 2026-08-02");
  const result = validateProjectMemoryUpdateCore(diffs);
  assert.equal(result.passed, false);
  assert.ok(result.reasons.some((r) => r.includes(CURRENT_STATUS_PATH) && r.includes("trivial")));
});

test("unresolved conflict markers in a required file fail, even if the file otherwise changed substantively", () => {
  const diffs = validUpdateDiffs();
  diffs[CURRENT_STATUS_PATH] = changedDiff("<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>> branch");
  const result = validateProjectMemoryUpdateCore(diffs);
  assert.equal(result.passed, false);
  assert.ok(result.reasons.some((r) => r.includes(CURRENT_STATUS_PATH) && r.includes("conflict")));
});

test("unresolved conflict markers in an optional file fail too, even though that file isn't required to change", () => {
  const diffs = validUpdateDiffs();
  diffs[ROADMAP_PATH] = changedDiff("<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>> branch");
  const result = validateProjectMemoryUpdateCore(diffs);
  assert.equal(result.passed, false);
  assert.ok(result.reasons.some((r) => r.includes(ROADMAP_PATH) && r.includes("conflict")));
});

test("an optional file changing has no bearing on pass/fail beyond its own validity", () => {
  const diffs = validUpdateDiffs();
  diffs[ROADMAP_PATH] = changedDiff("Roadmap note updated.");
  const result = validateProjectMemoryUpdateCore(diffs);
  assert.equal(result.passed, true);
  assert.ok(result.changedFiles.includes(ROADMAP_PATH));
});

// ---------------------------------------------------------------------------
// buildMemoryRepairPrompt / formatMemoryValidationMarkdown — pure formatting
// ---------------------------------------------------------------------------

test("buildMemoryRepairPrompt names every reason, the required files, and forbids touching feature code", () => {
  const result: MemoryValidationResult = { passed: false, changedFiles: [], reasons: ["X was not updated", "Y is trivial"] };
  const prompt = buildMemoryRepairPrompt(result, "003", "Competitor Observation Engine", "ai-queue/003-x", "unit 11/11 passing", 1, 3);
  assert.match(prompt, /X was not updated/);
  assert.match(prompt, /Y is trivial/);
  assert.match(prompt, /attempt 1 of 3/);
  for (const f of REQUIRED_PROJECT_MEMORY_FILES) assert.ok(prompt.includes(f));
  assert.match(prompt, /Do not alter any feature\/product code/);
  assert.match(prompt, /Do not fabricate completion/);
  assert.match(prompt, /remain valid JSON/);
});

test("formatMemoryValidationMarkdown reports PASS/FAIL, changed files, and reasons only on failure", () => {
  const pass = formatMemoryValidationMarkdown("003 — Task", { passed: true, changedFiles: [HANDOFF_PATH], reasons: [] }, 0);
  assert.match(pass, /PASS/);
  assert.match(pass, new RegExp(HANDOFF_PATH.replace(/[./]/g, "\\$&")));
  assert.doesNotMatch(pass, /Reasons:/);

  const fail = formatMemoryValidationMarkdown("003 — Task", { passed: false, changedFiles: [], reasons: ["no update"] }, 2);
  assert.match(fail, /FAIL/);
  assert.match(fail, /repair attempts used: 2/i);
  assert.match(fail, /no update/);
});

// ---------------------------------------------------------------------------
// runMemoryValidationWithRepair — injectable repair loop, no real git/agent
// ---------------------------------------------------------------------------

function baseRepairParams() {
  return {
    repoRoot: "/fake/repo",
    baseRef: "origin/main",
    taskId: "003",
    taskName: "Task",
    branch: "ai-queue/003-x",
    testsSummary: "all passing",
    maxAttempts: 3,
  };
}

test("a valid update on the first check never triggers repair", async () => {
  let validateCalls = 0;
  const passResult: MemoryValidationResult = { passed: true, changedFiles: [HANDOFF_PATH], reasons: [] };
  let agentCalls = 0;
  const outcome = await runMemoryValidationWithRepair({
    ...baseRepairParams(),
    validateMemory: () => {
      validateCalls++;
      return passResult;
    },
    runRepairAgent: async () => {
      agentCalls++;
      return { success: true, log: "" };
    },
  });
  assert.equal(outcome.finalResult.passed, true);
  assert.equal(outcome.attempts, 0);
  assert.equal(validateCalls, 1);
  assert.equal(agentCalls, 0, "no memory update should never invoke the repair agent");
});

test("an invalid update triggers repair, and a successful repair on attempt 1 allows completion", async () => {
  const failResult: MemoryValidationResult = { passed: false, changedFiles: [], reasons: ["no update"] };
  const passResult: MemoryValidationResult = { passed: true, changedFiles: [HANDOFF_PATH, CURRENT_STATUS_PATH, STATUS_JSON_PATH], reasons: [] };
  let call = 0;
  const outcome = await runMemoryValidationWithRepair({
    ...baseRepairParams(),
    validateMemory: () => (call === 0 ? failResult : passResult),
    runRepairAgent: async () => {
      call++;
      return { success: true, log: "repaired" };
    },
  });
  assert.equal(outcome.finalResult.passed, true);
  assert.equal(outcome.attempts, 1);
  assert.match(outcome.log, /Memory repair attempt 1\/3/);
});

test("repair that keeps failing stops safely after exhausting the bounded retry limit", async () => {
  const failResult: MemoryValidationResult = { passed: false, changedFiles: [], reasons: ["still no update"] };
  let agentCalls = 0;
  const outcome = await runMemoryValidationWithRepair({
    ...baseRepairParams(),
    maxAttempts: 3,
    validateMemory: () => failResult,
    runRepairAgent: async () => {
      agentCalls++;
      return { success: true, log: `attempt ${agentCalls}` };
    },
  });
  assert.equal(outcome.finalResult.passed, false);
  assert.equal(outcome.attempts, 3, "must stop at exactly maxAttempts, not loop indefinitely");
  assert.equal(agentCalls, 3);
});

test("a repair agent invocation that itself fails stops the loop immediately rather than retrying blindly", async () => {
  const failResult: MemoryValidationResult = { passed: false, changedFiles: [], reasons: ["no update"] };
  let agentCalls = 0;
  const outcome = await runMemoryValidationWithRepair({
    ...baseRepairParams(),
    validateMemory: () => failResult,
    runRepairAgent: async () => {
      agentCalls++;
      return { success: false, log: "agent crashed" };
    },
  });
  assert.equal(outcome.finalResult.passed, false);
  assert.equal(outcome.attempts, 1, "should stop after the first failed agent invocation, not keep retrying");
  assert.equal(agentCalls, 1);
});

// ---------------------------------------------------------------------------
// REAL git: validateProjectMemoryUpdate's actual git wiring, end to end
// ---------------------------------------------------------------------------

test("REAL git: a genuine committed memory update since branching is detected, whether committed or left uncommitted", () => {
  const repoRoot = mkdtempSync(join(tmpdir(), "ai-queue-memory-real-"));
  try {
    execFileSync("git", ["init", "-q", "-b", "main"], { cwd: repoRoot });
    execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: repoRoot });
    execFileSync("git", ["config", "user.name", "Test"], { cwd: repoRoot });

    mkdirSync(join(repoRoot, ".ai"), { recursive: true });
    writeFileSync(join(repoRoot, ".ai", "CURRENT_STATUS.md"), "# Current Status\n\nBaseline.\n");
    writeFileSync(join(repoRoot, ".ai", "STATUS.json"), '{"active_initiative": "none"}\n');
    writeFileSync(join(repoRoot, ".ai", "HANDOFF.md"), "# Handoff\n\nBaseline.\n");
    execFileSync("git", ["add", "-A"], { cwd: repoRoot });
    execFileSync("git", ["commit", "-q", "-m", "initial"], { cwd: repoRoot });

    execFileSync("git", ["checkout", "-q", "-b", "task-branch"], { cwd: repoRoot });

    // Case 1: the agent commits its own memory update (Task 003's real
    // behavior) — must still be detected, unlike the old uncommitted-only check.
    writeFileSync(join(repoRoot, ".ai", "CURRENT_STATUS.md"), "# Current Status\n\nTask X shipped real, substantive work.\n");
    writeFileSync(join(repoRoot, ".ai", "STATUS.json"), '{"active_initiative": "Task X shipped"}\n');
    writeFileSync(join(repoRoot, ".ai", "HANDOFF.md"), "# Handoff\n\nBranch: task-branch. Status: complete.\n");
    execFileSync("git", ["add", "-A"], { cwd: repoRoot });
    execFileSync("git", ["commit", "-q", "-m", "real work + memory, self-committed"], { cwd: repoRoot });

    const result = validateProjectMemoryUpdate(repoRoot, "main");
    assert.equal(result.passed, true, `expected pass, got reasons: ${result.reasons.join("; ")}`);
    assert.ok(result.changedFiles.includes(CURRENT_STATUS_PATH));
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});

test("REAL git: no memory file changed since branching fails, even with unrelated commits present", () => {
  const repoRoot = mkdtempSync(join(tmpdir(), "ai-queue-memory-real-"));
  try {
    execFileSync("git", ["init", "-q", "-b", "main"], { cwd: repoRoot });
    execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: repoRoot });
    execFileSync("git", ["config", "user.name", "Test"], { cwd: repoRoot });
    mkdirSync(join(repoRoot, ".ai"), { recursive: true });
    writeFileSync(join(repoRoot, ".ai", "CURRENT_STATUS.md"), "# Current Status\n");
    writeFileSync(join(repoRoot, ".ai", "STATUS.json"), '{"a": 1}\n');
    writeFileSync(join(repoRoot, ".ai", "HANDOFF.md"), "# Handoff\n");
    execFileSync("git", ["add", "-A"], { cwd: repoRoot });
    execFileSync("git", ["commit", "-q", "-m", "initial"], { cwd: repoRoot });

    execFileSync("git", ["checkout", "-q", "-b", "task-branch"], { cwd: repoRoot });
    writeFileSync(join(repoRoot, "some-feature.txt"), "real feature work, no memory touched\n");
    execFileSync("git", ["add", "-A"], { cwd: repoRoot });
    execFileSync("git", ["commit", "-q", "-m", "feature work only"], { cwd: repoRoot });

    const result = validateProjectMemoryUpdate(repoRoot, "main");
    assert.equal(result.passed, false);
    assert.deepEqual(result.changedFiles, []);
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});

/**
 * Project Memory validation for the AI queue.
 *
 * Root cause this exists to fix (2026-08-03, Task 003's real first live
 * multi-task run — evidence: .ai/runs/2026-08-03T051052683Z/): run-queue.ts
 * used to detect a task's Project Memory update with a single line —
 * `git status --porcelain -- .ai/CURRENT_STATUS.md ...` — which only ever
 * sees UNCOMMITTED changes. Task 003's real agent invocation did exactly
 * what its own injected prompt told it to do ("update the relevant .ai/
 * memory files ... and commit them in this same branch"): it wrote a
 * genuine, substantial memory update (CURRENT_STATUS.md, STATUS.json,
 * HANDOFF.md, ROADMAP.md) AND committed it AND pushed AND opened a real PR
 * (#107) — all before returning control to run-queue.ts. By the time the
 * old check ran, the working tree was already clean, so `git status
 * --porcelain` found nothing and the task was failed with "no
 * project-memory update" despite a real, valid update sitting right there
 * in the task's own commit. See .ai/DECISIONS.md ADR-0017 for the full
 * writeup.
 *
 * The fix: detect a memory update by asking "did any recognized memory
 * file change at all since this task's branch point?" — a union of (a)
 * commits made since branching (`git diff <baseRef>...HEAD`) and (b)
 * anything still uncommitted (`git diff HEAD`) — instead of only (b). This
 * is correct regardless of whether the agent commits its own work or
 * leaves it for run-queue.ts to commit.
 *
 * Every impure function here (the ones that shell out to git) is a thin
 * wrapper around a pure, injectable core — the same dependency-injection
 * pattern already used by resolveDependencyBase/reconcileTaskState in
 * reconcile.ts — so the actual validation logic is fully unit-testable
 * with canned diffs, no real git repo required.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { runCommand } from "./subprocess.ts";

const GIT_DIFF_TIMEOUT_MS = 2 * 60 * 1000;

// ---------------------------------------------------------------------------
// The recognized Project Memory file set — defined exactly once, here.
// ---------------------------------------------------------------------------

export const CURRENT_STATUS_PATH = ".ai/CURRENT_STATUS.md";
export const STATUS_JSON_PATH = ".ai/STATUS.json";
export const HANDOFF_PATH = ".ai/HANDOFF.md";
export const ROADMAP_PATH = ".ai/ROADMAP.md";
export const ARCHITECTURE_PATH = ".ai/ARCHITECTURE.md";
export const DECISIONS_PATH = ".ai/DECISIONS.md";
export const OPEN_ITEMS_PATH = ".ai/OPEN_ITEMS.md";

/**
 * Required for every completed task — matches AGENTS.md's "at minimum
 * CURRENT_STATUS.md, STATUS.json, and HANDOFF.md" and HANDOFF.md's own
 * header ("overwrite it wholesale on your next task"). A task that hasn't
 * touched all three has not met this repository's own stated bar.
 */
export const REQUIRED_PROJECT_MEMORY_FILES: readonly string[] = [CURRENT_STATUS_PATH, STATUS_JSON_PATH, HANDOFF_PATH];

/**
 * Conditional — only relevant "where applicable" (a durable decision was
 * made, architecture actually changed, an item was opened/closed, the
 * roadmap moved). Checked for validity (no conflict markers) if changed,
 * but never required to change on every task.
 */
export const OPTIONAL_PROJECT_MEMORY_FILES: readonly string[] = [ROADMAP_PATH, ARCHITECTURE_PATH, DECISIONS_PATH, OPEN_ITEMS_PATH];

export const ALL_PROJECT_MEMORY_FILES: readonly string[] = [...REQUIRED_PROJECT_MEMORY_FILES, ...OPTIONAL_PROJECT_MEMORY_FILES];

// ---------------------------------------------------------------------------
// Pure content checks — unit-tested directly with canned strings.
// ---------------------------------------------------------------------------

const CONFLICT_MARKER_RE = /^(<{7}|={7}|>{7})(?![<=>])/m;

/** True if `content` contains an unresolved Git conflict marker at the start of a line. */
export function hasConflictMarkers(content: string): boolean {
  return CONFLICT_MARKER_RE.test(content);
}

const ISO_TIMESTAMP_RE = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?/g;
const DATE_ONLY_RE = /\d{4}-\d{2}-\d{2}/g;

/** Normalizes away date/timestamp substrings so a line that differs only in its date compares equal to its former self. */
export function stripTimestamps(line: string): string {
  return line.replace(ISO_TIMESTAMP_RE, "<TS>").replace(DATE_ONLY_RE, "<DATE>");
}

/**
 * True if a unified diff's only substantive content is a timestamp/date
 * change (or the diff is empty) — i.e. every non-blank added line, once
 * timestamps are normalized away, also appears among the normalized
 * removed lines. A real content change never satisfies this, because the
 * normalized added line won't match anything in the normalized removed
 * set. Diff header lines (+++/---) are ignored.
 */
export function isTrivialMemoryDiff(diffText: string): boolean {
  const added: string[] = [];
  const removed: string[] = [];
  for (const line of diffText.split("\n")) {
    if (line.startsWith("+++") || line.startsWith("---")) continue;
    if (line.startsWith("+")) {
      const stripped = stripTimestamps(line.slice(1).trim());
      if (stripped.length > 0) added.push(stripped);
    } else if (line.startsWith("-")) {
      const stripped = stripTimestamps(line.slice(1).trim());
      if (stripped.length > 0) removed.push(stripped);
    }
  }
  if (added.length === 0) return true;
  const removedSet = new Set(removed);
  return added.every((line) => removedSet.has(line));
}

/** Returns a parse-error message, or null if `content` is valid JSON. */
export function jsonParseError(content: string): string | null {
  try {
    JSON.parse(content);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

// ---------------------------------------------------------------------------
// Per-file diff info — the one impure boundary. Injected everywhere else so
// the actual validation decision logic (below) stays pure and testable.
// ---------------------------------------------------------------------------

export interface MemoryFileDiff {
  /** True if this file differs from baseRef in any way — committed since branching, uncommitted, or both. */
  changed: boolean;
  /** Unified diff text covering both the committed-since-baseRef and any-still-uncommitted change. Empty when changed is false. */
  diffText: string;
  /** Current on-disk content, or null if the file doesn't exist. */
  currentContent: string | null;
}

export type MemoryFileDiffProvider = (repoRoot: string, baseRef: string, file: string) => MemoryFileDiff;

/** Real implementation — shells out to git. */
export const getRealMemoryFileDiff: MemoryFileDiffProvider = (repoRoot, baseRef, file) => {
  const committed = runCommand("git", ["diff", `${baseRef}...HEAD`, "--", file], repoRoot, GIT_DIFF_TIMEOUT_MS);
  const uncommitted = runCommand("git", ["diff", "HEAD", "--", file], repoRoot, GIT_DIFF_TIMEOUT_MS);
  const diffText = (committed.ok ? committed.stdout : "") + (uncommitted.ok ? uncommitted.stdout : "");
  const absPath = join(repoRoot, file);
  const currentContent = existsSync(absPath) ? readFileSync(absPath, "utf8") : null;
  return { changed: diffText.trim().length > 0, diffText, currentContent };
};

// ---------------------------------------------------------------------------
// Validation — the pure core, and the real orchestrator on top of it.
// ---------------------------------------------------------------------------

export interface MemoryValidationResult {
  passed: boolean;
  /** Every recognized memory file (required or optional) that actually changed since baseRef. */
  changedFiles: string[];
  /** Empty when passed is true. Human-readable, specific — not just "failed". */
  reasons: string[];
}

/**
 * Pure validation core — takes precomputed per-file diffs, makes no git
 * calls itself. See validateProjectMemoryUpdate() below for the real
 * (impure) entry point used by run-queue.ts.
 */
export function validateProjectMemoryUpdateCore(diffs: Record<string, MemoryFileDiff>): MemoryValidationResult {
  const reasons: string[] = [];
  const changedFiles = ALL_PROJECT_MEMORY_FILES.filter((f) => diffs[f]?.changed);

  for (const file of REQUIRED_PROJECT_MEMORY_FILES) {
    const diff = diffs[file];
    if (!diff?.changed) {
      reasons.push(`${file} was not updated — required for every completed task (AGENTS.md; this file's own header).`);
      continue;
    }
    if (isTrivialMemoryDiff(diff.diffText)) {
      reasons.push(`${file}'s change is empty, timestamp-only, or otherwise trivial — not a substantive update.`);
    }
    if (hasConflictMarkers(diff.currentContent ?? "")) {
      reasons.push(`${file} contains unresolved Git conflict markers.`);
    }
    if (file === STATUS_JSON_PATH && diff.currentContent !== null) {
      const err = jsonParseError(diff.currentContent);
      if (err) reasons.push(`${STATUS_JSON_PATH} is not valid JSON: ${err}`);
    }
  }

  for (const file of OPTIONAL_PROJECT_MEMORY_FILES) {
    const diff = diffs[file];
    if (!diff?.changed) continue;
    if (hasConflictMarkers(diff.currentContent ?? "")) {
      reasons.push(`${file} contains unresolved Git conflict markers.`);
    }
  }

  return { passed: reasons.length === 0, changedFiles, reasons };
}

/** Real entry point — collects real diffs via git, then runs the pure core. */
export function validateProjectMemoryUpdate(
  repoRoot: string,
  baseRef: string,
  getDiff: MemoryFileDiffProvider = getRealMemoryFileDiff
): MemoryValidationResult {
  const diffs: Record<string, MemoryFileDiff> = {};
  for (const file of ALL_PROJECT_MEMORY_FILES) {
    diffs[file] = getDiff(repoRoot, baseRef, file);
  }
  return validateProjectMemoryUpdateCore(diffs);
}

// ---------------------------------------------------------------------------
// Repair prompt + reporting — pure, unit-tested directly.
// ---------------------------------------------------------------------------

/**
 * A narrow, bounded repair prompt — asks for a truthful Project Memory
 * update ONLY. Must never ask the agent to touch feature code, re-run
 * tests it should simply report honestly, or fabricate anything.
 */
export function buildMemoryRepairPrompt(
  result: MemoryValidationResult,
  taskId: string,
  taskName: string,
  branch: string,
  testsSummary: string,
  attempt: number,
  maxAttempts: number
): string {
  const lines = [
    `Task "${taskId} — ${taskName}" (branch \`${branch}\`) passed its quality gates, but its Project Memory update is incomplete or invalid. This is memory-repair attempt ${attempt} of ${maxAttempts}.`,
    "",
    "Problems found:",
    "",
    ...result.reasons.map((r) => `- ${r}`),
    "",
    `Already-recognized changed memory files this task touched: ${result.changedFiles.length > 0 ? result.changedFiles.join(", ") : "(none)"}.`,
    "",
    `This task's own test/quality results (report these truthfully — do not re-run tests and do not fabricate a different result): ${testsSummary}`,
    "",
    "Fix ONLY the Project Memory update:",
    `- ${REQUIRED_PROJECT_MEMORY_FILES.join(", ")} are required — update all three truthfully.`,
    `- ${OPTIONAL_PROJECT_MEMORY_FILES.join(", ")} only where actually applicable (a durable decision, an architecture change, an opened/closed item, a roadmap move) — do not touch one that doesn't apply.`,
    "- Do not alter any feature/product code, do not touch tests, do not re-scope the task.",
    "- Do not fabricate completion, invent test results, or write generic boilerplate — every claim in the memory update must be truthful and specific to this task's real, already-completed work.",
    "- .ai/STATUS.json must remain valid JSON.",
    "- Do not leave unresolved Git conflict markers in any file you touch.",
    "- Commit your changes in this same branch when done (do not push or open/modify a PR — the queue handles that).",
  ];
  return lines.join("\n");
}

/** Renders a MemoryValidationResult as a Markdown block for RUN_SUMMARY.md, mirroring qualityGates.ts's formatQualityComparisonMarkdown. */
export function formatMemoryValidationMarkdown(taskLabel: string, result: MemoryValidationResult, repairAttempts: number): string {
  const lines = [
    `### Project Memory — ${taskLabel}: ${result.passed ? "PASS" : "FAIL"}`,
    "",
    ...(repairAttempts > 0 ? [`Memory repair attempts used: ${repairAttempts}.`, ""] : []),
    `Changed memory files: ${result.changedFiles.length > 0 ? result.changedFiles.join(", ") : "(none)"}`,
  ];
  if (!result.passed) {
    lines.push("", "Reasons:", ...result.reasons.map((r) => `- ${r}`));
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Injectable repair loop — the orchestration is pure aside from the two
// injected async callbacks, so it's fully unit-testable with fake
// validate/agent functions (no real git, no real Claude invocation).
// ---------------------------------------------------------------------------

export interface RunMemoryValidationWithRepairParams {
  repoRoot: string;
  baseRef: string;
  taskId: string;
  taskName: string;
  branch: string;
  testsSummary: string;
  maxAttempts: number;
  validateMemory: (repoRoot: string, baseRef: string) => MemoryValidationResult;
  runRepairAgent: (prompt: string) => Promise<{ success: boolean; log: string }>;
}

export interface RunMemoryValidationWithRepairResult {
  finalResult: MemoryValidationResult;
  attempts: number;
  log: string;
}

/**
 * Validates the Project Memory requirement, and if it fails, invokes a
 * bounded number of narrow repair attempts (re-validating after each),
 * exactly mirroring qualityGates.ts's own repair-loop shape and reusing the
 * same maxAttempts budget the caller passes in (run-queue.ts passes
 * queue.max_repair_attempts, the same knob the quality-gate repair loop
 * already uses — see this module's header comment).
 */
export async function runMemoryValidationWithRepair(params: RunMemoryValidationWithRepairParams): Promise<RunMemoryValidationWithRepairResult> {
  const { repoRoot, baseRef, taskId, taskName, branch, testsSummary, maxAttempts, validateMemory, runRepairAgent } = params;
  let result = validateMemory(repoRoot, baseRef);
  let attempts = 0;
  let log = "";

  while (!result.passed && attempts < maxAttempts) {
    attempts++;
    const prompt = buildMemoryRepairPrompt(result, taskId, taskName, branch, testsSummary, attempts, maxAttempts);
    const repairResult = await runRepairAgent(prompt);
    log += `\n\n--- Memory repair attempt ${attempts}/${maxAttempts} ---\n${repairResult.log}`;
    if (!repairResult.success) break;
    result = validateMemory(repoRoot, baseRef);
  }

  return { finalResult: result, attempts, log };
}

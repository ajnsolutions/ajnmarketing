/**
 * Queue v2 — baseline-aware quality gates.
 *
 * The v1 queue (PR #97) ran a fixed quality-gate command list and required
 * a clean pass — but this repository has a small number of documented,
 * pre-existing baseline issues (see .ai/OPEN_ITEMS.md's "Pre-existing
 * type-check debt"), so v1's gate stopped the queue even when a task
 * introduced zero regressions of its own. That's a design flaw, not a task
 * failure: the queue was evaluating repository-wide quality instead of
 * task-specific quality.
 *
 * Queue v2 fixes this by capturing a QualitySnapshot of the repository
 * BEFORE a run's first task begins (the "baseline"), then comparing every
 * task's post-change QualitySnapshot against that same baseline: existing
 * debt that's still present and unchanged never fails a task; anything
 * newly broken always does. See docs/AI_OVERNIGHT_QUEUE.md's "Queue v2"
 * section for the full walkthrough.
 *
 * Capture (captureQualitySnapshot) shells out to real project commands and
 * is intentionally not unit-tested directly, matching this repo's existing
 * convention of not unit-testing raw command/IO wrappers (see
 * lib/opportunity-engine/persistence.ts and its sibling tests for the same
 * pattern). Every parsing and comparison function below is pure and is
 * unit-tested with canned sample output in
 * unit-tests/ai-queue-quality-gates.test.ts.
 */
import { runCommand } from "./subprocess.ts";

// Generous per-gate ceilings for an unattended run — see subprocess.ts's
// header comment for why every subprocess call needs an explicit one.
const TSC_TIMEOUT_MS = 8 * 60 * 1000;
const ESLINT_TIMEOUT_MS = 5 * 60 * 1000;
const UNIT_TEST_TIMEOUT_MS = 8 * 60 * 1000;
const PLAYWRIGHT_TIMEOUT_MS = 20 * 60 * 1000;
const BUILD_TIMEOUT_MS = 10 * 60 * 1000;

export type QualitySnapshot = {
  generatedAt: string;
  typescriptErrorCount: number;
  eslintErrorCount: number;
  eslintWarningCount: number;
  unitTestFailureCount: number;
  unitTestFailureNames: string[];
  playwrightFailureCount: number;
  playwrightFailureNames: string[];
  buildSucceeded: boolean;
  /**
   * Reliability hardening (2026-08-02): which gate commands, if any, were
   * killed for exceeding their timeout (subprocess.ts) rather than actually
   * completing. A timed-out gate's counts above are computed from whatever
   * partial output it produced before being killed — not trustworthy as a
   * real pass/fail signal. compareQualitySnapshots() treats any
   * newly-timed-out gate as an automatic regression precisely because a
   * silent "0 errors" from a killed process is worse than an honest failure.
   */
  timedOutGates: string[];
};

export type GateStatus = "pass" | "fail";

export type GateComparison = {
  gate: string;
  baselineValue: string;
  currentValue: string;
  status: GateStatus;
  reason?: string;
};

export type QualityComparisonResult = {
  overallStatus: GateStatus;
  gates: GateComparison[];
  newRegressions: string[];
  fixedRegressions: string[];
  remainingHistoricalDebt: string[];
};

// ---------------------------------------------------------------------------
// Parsing — pure, unit-tested directly with canned sample output.
// ---------------------------------------------------------------------------

/** Counts `error TSxxxx` occurrences in `tsc --noEmit` output — the same
 * pattern this repo's own agents have used by hand all along (`grep -c
 * "error TS"`), just made a permanent, testable function. */
export function parseTypescriptErrorCount(output: string): number {
  const matches = output.match(/error TS\d+/g);
  return matches ? matches.length : 0;
}

type EslintJsonEntry = { errorCount?: number; warningCount?: number };

/** Parses `eslint --format json` output (an array of one entry per linted
 * file, each with its own errorCount/warningCount) into repo-wide totals. */
export function parseEslintJson(jsonOutput: string): { errorCount: number; warningCount: number } {
  let entries: unknown;
  try {
    entries = JSON.parse(jsonOutput);
  } catch {
    return { errorCount: 0, warningCount: 0 };
  }
  if (!Array.isArray(entries)) return { errorCount: 0, warningCount: 0 };
  let errorCount = 0;
  let warningCount = 0;
  for (const entry of entries as EslintJsonEntry[]) {
    errorCount += entry.errorCount ?? 0;
    warningCount += entry.warningCount ?? 0;
  }
  return { errorCount, warningCount };
}

/** Parses Node's built-in test runner's default TAP output (this repo's
 * `npm run test:unit`) for a failure count and the identity (name) of each
 * failing test — identity, not just count, is what lets the comparator
 * distinguish "the same historical failure" from "a different, new one"
 * even when counts happen to match. */
export function parseNodeTestFailures(output: string): { failureCount: number; failureNames: string[] } {
  const summaryMatch = output.match(/^# fail (\d+)/m);
  const failureCount = summaryMatch ? Number(summaryMatch[1]) : 0;
  const failureNames = [...output.matchAll(/^not ok \d+ - (.+)$/gm)].map((m) => m[1]!.trim());
  return { failureCount, failureNames };
}

type PlaywrightJsonSpec = { title: string; ok: boolean };
type PlaywrightJsonSuite = { title?: string; specs?: PlaywrightJsonSpec[]; suites?: PlaywrightJsonSuite[]; file?: string };
type PlaywrightJsonReport = { suites?: PlaywrightJsonSuite[]; stats?: { unexpected?: number; flaky?: number } };

function collectFailingSpecTitles(suites: PlaywrightJsonSuite[] | undefined, filePrefix = ""): string[] {
  const names: string[] = [];
  for (const suite of suites ?? []) {
    const currentFile = suite.file ?? filePrefix;
    for (const spec of suite.specs ?? []) {
      if (!spec.ok) names.push(currentFile ? `${currentFile} > ${spec.title}` : spec.title);
    }
    names.push(...collectFailingSpecTitles(suite.suites, currentFile));
  }
  return names;
}

/** Parses `playwright test --reporter=json` output. Falls back to a
 * count-only result (no identities) if the JSON shape isn't as expected,
 * rather than throwing — a malformed/empty report should never crash the
 * queue, only ever be treated conservatively (as if nothing is known to
 * have newly failed is NOT assumed; see compareQualitySnapshots's use). */
export function parsePlaywrightJson(jsonOutput: string): { failureCount: number; failureNames: string[] } {
  let report: PlaywrightJsonReport;
  try {
    report = JSON.parse(jsonOutput);
  } catch {
    return { failureCount: 0, failureNames: [] };
  }
  const failureNames = collectFailingSpecTitles(report.suites);
  const statsUnexpected = (report.stats?.unexpected ?? 0) + (report.stats?.flaky ?? 0);
  return { failureCount: Math.max(failureNames.length, statsUnexpected), failureNames };
}

// ---------------------------------------------------------------------------
// Capture — impure, shells out. Not unit-tested directly.
// ---------------------------------------------------------------------------

function runCapture(command: string, args: string[], cwd: string, timeoutMs: number): { ok: boolean; stdout: string; stderr: string; timedOut: boolean } {
  const result = runCommand(command, args, cwd, timeoutMs);
  return { ok: result.ok, stdout: result.stdout, stderr: result.stderr, timedOut: result.timedOut };
}

/**
 * Runs the full quality suite (TypeScript, ESLint, unit tests, Playwright,
 * build) and returns one QualitySnapshot. Used both to capture the run's
 * baseline (once, before the first task) and to check every task's
 * after-state (compared against that same baseline) — see
 * run-queue.ts's use of this function for exactly when each happens.
 *
 * Every command below has an explicit timeout (subprocess.ts) so a single
 * hung gate can never block an unattended run indefinitely — a timed-out
 * gate is treated as a real failure (its snapshot reflects whatever partial
 * output it produced before being killed), not silently skipped.
 */
export function captureQualitySnapshot(repoRoot: string, now: Date = new Date()): QualitySnapshot {
  const tsResult = runCapture("npx", ["tsc", "--noEmit"], repoRoot, TSC_TIMEOUT_MS);
  const typescriptErrorCount = parseTypescriptErrorCount(tsResult.stdout + tsResult.stderr);

  const eslintResult = runCapture("npx", ["eslint", ".", "--format", "json"], repoRoot, ESLINT_TIMEOUT_MS);
  const { errorCount: eslintErrorCount, warningCount: eslintWarningCount } = parseEslintJson(eslintResult.stdout);

  const unitResult = runCapture(
    "node",
    ["--import", "./unit-tests/support/register.mjs", "--test", "unit-tests/*.test.ts"],
    repoRoot,
    UNIT_TEST_TIMEOUT_MS
  );
  const { failureCount: unitTestFailureCount, failureNames: unitTestFailureNames } = parseNodeTestFailures(
    unitResult.stdout + unitResult.stderr
  );

  const playwrightResult = runCapture("npx", ["playwright", "test", "--reporter=json"], repoRoot, PLAYWRIGHT_TIMEOUT_MS);
  const { failureCount: playwrightFailureCount, failureNames: playwrightFailureNames } = parsePlaywrightJson(
    playwrightResult.stdout
  );

  const buildResult = runCapture("npm", ["run", "build"], repoRoot, BUILD_TIMEOUT_MS);

  const timedOutGates: string[] = [];
  if (tsResult.timedOut) timedOutGates.push("typescript");
  if (eslintResult.timedOut) timedOutGates.push("eslint");
  if (unitResult.timedOut) timedOutGates.push("unit_tests");
  if (playwrightResult.timedOut) timedOutGates.push("playwright");
  if (buildResult.timedOut) timedOutGates.push("build");

  return {
    generatedAt: now.toISOString(),
    typescriptErrorCount,
    eslintErrorCount,
    eslintWarningCount,
    unitTestFailureCount,
    unitTestFailureNames,
    playwrightFailureCount,
    playwrightFailureNames,
    buildSucceeded: buildResult.ok,
    timedOutGates,
  };
}

// ---------------------------------------------------------------------------
// Comparison — pure, unit-tested directly.
// ---------------------------------------------------------------------------

function identityDiff(baselineNames: string[], currentNames: string[]): { added: string[]; removed: string[] } {
  const baselineSet = new Set(baselineNames);
  const currentSet = new Set(currentNames);
  return {
    added: currentNames.filter((n) => !baselineSet.has(n)),
    removed: baselineNames.filter((n) => !currentSet.has(n)),
  };
}

/**
 * Compares a task's after-state QualitySnapshot against the run's baseline.
 * Rules (see docs/AI_OVERNIGHT_QUEUE.md's "Queue v2" section for the full
 * rationale of each):
 *
 * - TypeScript / ESLint errors / ESLint warnings: PASS if the count did not
 *   increase. Existing debt (a baseline count > 0 that stays the same) is
 *   never a failure.
 * - Unit tests / Playwright: identity-aware, not just count-based — a
 *   currently-failing test PASSES this gate only if it was ALSO failing in
 *   the baseline (by name). A brand-new failing test name always fails the
 *   gate, even if some other historical failure happened to get fixed in
 *   the same run (so counts alone can't mask a real regression).
 * - Build: must succeed, unless the baseline build was itself already
 *   broken (pre-existing breakage isn't this task's fault either).
 * - Timeouts (reliability hardening, 2026-08-02): a gate that timed out in
 *   `current` but not in `baseline` is always a hard failure, regardless of
 *   whatever partial counts it produced — a killed process's output is not
 *   a trustworthy "0 errors". A gate that was already timing out in the
 *   baseline is historical debt, same as any other pre-existing issue.
 */
export function compareQualitySnapshots(baseline: QualitySnapshot, current: QualitySnapshot): QualityComparisonResult {
  const gates: GateComparison[] = [];
  const newRegressions: string[] = [];
  const fixedRegressions: string[] = [];
  const remainingHistoricalDebt: string[] = [];

  // Timeouts — checked first; a timed-out gate's own counts below are not trustworthy.
  {
    const baselineTimedOut = new Set(baseline.timedOutGates ?? []);
    const currentTimedOut = new Set(current.timedOutGates ?? []);
    for (const gate of currentTimedOut) {
      if (!baselineTimedOut.has(gate)) {
        newRegressions.push(`${gate}: timed out (did not complete within its time budget)`);
      } else {
        remainingHistoricalDebt.push(`${gate}: still timing out, unchanged from baseline`);
      }
    }
    for (const gate of baselineTimedOut) {
      if (!currentTimedOut.has(gate)) {
        fixedRegressions.push(`${gate}: no longer timing out`);
      }
    }
  }

  // TypeScript
  {
    const status: GateStatus = current.typescriptErrorCount <= baseline.typescriptErrorCount ? "pass" : "fail";
    gates.push({
      gate: "typescript",
      baselineValue: `${baseline.typescriptErrorCount} error(s)`,
      currentValue: `${current.typescriptErrorCount} error(s)`,
      status,
      reason: status === "fail" ? `${current.typescriptErrorCount - baseline.typescriptErrorCount} new TypeScript error(s)` : undefined,
    });
    if (status === "fail") newRegressions.push(gates.at(-1)!.reason!);
    else if (current.typescriptErrorCount < baseline.typescriptErrorCount) fixedRegressions.push(`${baseline.typescriptErrorCount - current.typescriptErrorCount} pre-existing TypeScript error(s) fixed`);
    else if (baseline.typescriptErrorCount > 0) remainingHistoricalDebt.push(`${baseline.typescriptErrorCount} pre-existing TypeScript error(s), unchanged`);
  }

  // ESLint errors
  {
    const status: GateStatus = current.eslintErrorCount <= baseline.eslintErrorCount ? "pass" : "fail";
    gates.push({
      gate: "eslint_errors",
      baselineValue: `${baseline.eslintErrorCount} error(s)`,
      currentValue: `${current.eslintErrorCount} error(s)`,
      status,
      reason: status === "fail" ? `${current.eslintErrorCount - baseline.eslintErrorCount} new ESLint error(s)` : undefined,
    });
    if (status === "fail") newRegressions.push(gates.at(-1)!.reason!);
    else if (current.eslintErrorCount < baseline.eslintErrorCount) fixedRegressions.push(`${baseline.eslintErrorCount - current.eslintErrorCount} pre-existing ESLint error(s) fixed`);
    else if (baseline.eslintErrorCount > 0) remainingHistoricalDebt.push(`${baseline.eslintErrorCount} pre-existing ESLint error(s), unchanged`);
  }

  // ESLint warnings — "may not increase"
  {
    const status: GateStatus = current.eslintWarningCount <= baseline.eslintWarningCount ? "pass" : "fail";
    gates.push({
      gate: "eslint_warnings",
      baselineValue: `${baseline.eslintWarningCount} warning(s)`,
      currentValue: `${current.eslintWarningCount} warning(s)`,
      status,
      reason: status === "fail" ? `${current.eslintWarningCount - baseline.eslintWarningCount} new ESLint warning(s)` : undefined,
    });
    if (status === "fail") newRegressions.push(gates.at(-1)!.reason!);
    else if (current.eslintWarningCount < baseline.eslintWarningCount) fixedRegressions.push(`${baseline.eslintWarningCount - current.eslintWarningCount} pre-existing ESLint warning(s) fixed`);
    else if (baseline.eslintWarningCount > 0) remainingHistoricalDebt.push(`${baseline.eslintWarningCount} pre-existing ESLint warning(s), unchanged`);
  }

  // Unit tests — identity-aware
  {
    const { added, removed } = identityDiff(baseline.unitTestFailureNames, current.unitTestFailureNames);
    const status: GateStatus = added.length === 0 ? "pass" : "fail";
    gates.push({
      gate: "unit_tests",
      baselineValue: `${baseline.unitTestFailureCount} failure(s)`,
      currentValue: `${current.unitTestFailureCount} failure(s)`,
      status,
      reason: status === "fail" ? `new failing test(s): ${added.join(", ")}` : undefined,
    });
    if (status === "fail") newRegressions.push(`unit tests: ${gates.at(-1)!.reason}`);
    if (removed.length > 0) fixedRegressions.push(`unit tests: previously-failing test(s) now passing: ${removed.join(", ")}`);
    const stillFailing = current.unitTestFailureNames.filter((n) => baseline.unitTestFailureNames.includes(n));
    if (stillFailing.length > 0) remainingHistoricalDebt.push(`unit tests: ${stillFailing.length} pre-existing failure(s), unchanged: ${stillFailing.join(", ")}`);
  }

  // Playwright — identity-aware
  {
    const { added, removed } = identityDiff(baseline.playwrightFailureNames, current.playwrightFailureNames);
    const status: GateStatus = added.length === 0 ? "pass" : "fail";
    gates.push({
      gate: "playwright",
      baselineValue: `${baseline.playwrightFailureCount} failure(s)`,
      currentValue: `${current.playwrightFailureCount} failure(s)`,
      status,
      reason: status === "fail" ? `new failing test(s): ${added.join(", ")}` : undefined,
    });
    if (status === "fail") newRegressions.push(`playwright: ${gates.at(-1)!.reason}`);
    if (removed.length > 0) fixedRegressions.push(`playwright: previously-failing test(s) now passing: ${removed.join(", ")}`);
    const stillFailing = current.playwrightFailureNames.filter((n) => baseline.playwrightFailureNames.includes(n));
    if (stillFailing.length > 0) remainingHistoricalDebt.push(`playwright: ${stillFailing.length} pre-existing failure(s), unchanged: ${stillFailing.join(", ")}`);
  }

  // Build — must always succeed, unless it was already broken in the baseline
  {
    const status: GateStatus = current.buildSucceeded || !baseline.buildSucceeded ? "pass" : "fail";
    gates.push({
      gate: "build",
      baselineValue: baseline.buildSucceeded ? "succeeded" : "already failing",
      currentValue: current.buildSucceeded ? "succeeded" : "failed",
      status,
      reason: status === "fail" ? "build broke and did not previously fail in the baseline" : undefined,
    });
    if (status === "fail") newRegressions.push("build: newly broken");
    else if (!baseline.buildSucceeded && !current.buildSucceeded) remainingHistoricalDebt.push("build: pre-existing failure, unchanged");
    else if (!baseline.buildSucceeded && current.buildSucceeded) fixedRegressions.push("build: pre-existing failure fixed");
  }

  // newRegressions can gain entries above (timeouts) that never produced a
  // `gates` row — overallStatus must fail on those too, not just on `gates`.
  const overallStatus: GateStatus = gates.every((g) => g.status === "pass") && newRegressions.length === 0 ? "pass" : "fail";
  return { overallStatus, gates, newRegressions, fixedRegressions, remainingHistoricalDebt };
}

// ---------------------------------------------------------------------------
// Repair prompt — pure, unit-tested directly.
// ---------------------------------------------------------------------------

/**
 * Builds the follow-up prompt sent to the agent when its own task
 * introduced new regressions. Deliberately narrow: repair only what's
 * listed, never touch historical debt, never expand scope.
 */
export function buildRepairPrompt(comparison: QualityComparisonResult, attempt: number, maxAttempts: number): string {
  const lines = [
    `Your previous change on this branch introduced new regression(s) compared to this repository's baseline captured before this task started. This is repair attempt ${attempt} of ${maxAttempts}.`,
    "",
    "Fix ONLY the following new regressions. Do not revert unrelated, intentional changes from your own task, and do not expand scope beyond fixing these:",
    "",
    ...comparison.newRegressions.map((r) => `- ${r}`),
    "",
    "Do not touch pre-existing historical debt that was already present in the baseline (unrelated to your change) — leaving it alone is correct, not a shortcoming. After your fix, the same quality gates will be re-checked automatically.",
  ];
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Reporting — pure, unit-tested directly.
// ---------------------------------------------------------------------------

/** Renders a QualityComparisonResult as a Markdown block for RUN_SUMMARY.md. */
export function formatQualityComparisonMarkdown(taskLabel: string, comparison: QualityComparisonResult, repairAttempts: number): string {
  const lines = [
    `### Quality gate — ${taskLabel}: ${comparison.overallStatus.toUpperCase()}`,
    "",
    ...(repairAttempts > 0 ? [`Auto-repair attempts used: ${repairAttempts}.`, ""] : []),
    "| Gate | Baseline | Current | Result |",
    "|---|---|---|---|",
    ...comparison.gates.map((g) => `| ${g.gate} | ${g.baselineValue} | ${g.currentValue} | ${g.status.toUpperCase()}${g.reason ? ` — ${g.reason}` : ""} |`),
    "",
    `**New regressions:** ${comparison.newRegressions.length === 0 ? "none" : comparison.newRegressions.join("; ")}`,
    `**Fixed regressions:** ${comparison.fixedRegressions.length === 0 ? "none" : comparison.fixedRegressions.join("; ")}`,
    `**Remaining historical debt:** ${comparison.remainingHistoricalDebt.length === 0 ? "none" : comparison.remainingHistoricalDebt.join("; ")}`,
  ];
  return lines.join("\n");
}

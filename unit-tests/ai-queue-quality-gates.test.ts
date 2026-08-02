import test from "node:test";
import assert from "node:assert/strict";
import {
  parseTypescriptErrorCount,
  parseEslintJson,
  parseNodeTestFailures,
  parsePlaywrightJson,
  compareQualitySnapshots,
  buildRepairPrompt,
  formatQualityComparisonMarkdown,
  type QualitySnapshot,
} from "../scripts/ai/qualityGates.ts";

const NOW = "2026-08-01T00:00:00.000Z";

function snapshot(overrides: Partial<QualitySnapshot> = {}): QualitySnapshot {
  return {
    generatedAt: NOW,
    typescriptErrorCount: 0,
    eslintErrorCount: 0,
    eslintWarningCount: 0,
    unitTestFailureCount: 0,
    unitTestFailureNames: [],
    playwrightFailureCount: 0,
    playwrightFailureNames: [],
    buildSucceeded: true,
    timedOutGates: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

test("parseTypescriptErrorCount counts every error TSxxxx occurrence", () => {
  const output = [
    "unit-tests/a.test.ts(44,20): error TS7009: 'new' expression, whose target lacks a construct signature.",
    "unit-tests/b.test.ts(10,3): error TS2322: Type 'number' is not assignable to type 'string'.",
    "Found 2 errors.",
  ].join("\n");
  assert.equal(parseTypescriptErrorCount(output), 2);
});

test("parseTypescriptErrorCount returns 0 for clean output", () => {
  assert.equal(parseTypescriptErrorCount(""), 0);
  assert.equal(parseTypescriptErrorCount("no errors here"), 0);
});

test("parseEslintJson sums errorCount/warningCount across every file entry", () => {
  const json = JSON.stringify([
    { filePath: "/repo/a.ts", messages: [], errorCount: 1, warningCount: 2 },
    { filePath: "/repo/b.ts", messages: [], errorCount: 0, warningCount: 0 },
    { filePath: "/repo/c.ts", messages: [], errorCount: 3, warningCount: 1 },
  ]);
  assert.deepEqual(parseEslintJson(json), { errorCount: 4, warningCount: 3 });
});

test("parseEslintJson tolerates malformed JSON by returning zeros rather than throwing", () => {
  assert.deepEqual(parseEslintJson("not json"), { errorCount: 0, warningCount: 0 });
  assert.deepEqual(parseEslintJson("{}"), { errorCount: 0, warningCount: 0 });
});

test("parseNodeTestFailures reads the TAP summary count and each failing test's name", () => {
  const output = [
    "TAP version 13",
    "# Subtest: test one",
    "ok 1 - test one",
    "# Subtest: test two",
    "not ok 2 - test two",
    "  ---",
    "  duration_ms: 1",
    "  ...",
    "1..2",
    "# tests 2",
    "# pass 1",
    "# fail 1",
  ].join("\n");
  assert.deepEqual(parseNodeTestFailures(output), { failureCount: 1, failureNames: ["test two"] });
});

test("parseNodeTestFailures returns zero failures for a fully passing run", () => {
  const output = ["1..3", "# tests 3", "# pass 3", "# fail 0"].join("\n");
  assert.deepEqual(parseNodeTestFailures(output), { failureCount: 0, failureNames: [] });
});

test("parsePlaywrightJson collects failing spec titles with their file, and counts via stats", () => {
  const json = JSON.stringify({
    suites: [
      {
        title: "suite",
        file: "tests/a.spec.ts",
        specs: [
          { title: "passes", ok: true },
          { title: "fails", ok: false },
        ],
        suites: [],
      },
    ],
    stats: { unexpected: 1, flaky: 0 },
  });
  assert.deepEqual(parsePlaywrightJson(json), { failureCount: 1, failureNames: ["tests/a.spec.ts > fails"] });
});

test("parsePlaywrightJson walks nested suites", () => {
  const json = JSON.stringify({
    suites: [
      {
        title: "outer",
        file: "tests/b.spec.ts",
        specs: [],
        suites: [{ title: "inner", specs: [{ title: "nested fail", ok: false }], suites: [] }],
      },
    ],
    stats: { unexpected: 1 },
  });
  const result = parsePlaywrightJson(json);
  assert.equal(result.failureCount, 1);
  assert.ok(result.failureNames[0]!.includes("nested fail"));
});

test("parsePlaywrightJson never throws on malformed JSON — returns zero failures", () => {
  assert.deepEqual(parsePlaywrightJson("not json"), { failureCount: 0, failureNames: [] });
});

// ---------------------------------------------------------------------------
// compareQualitySnapshots — the core baseline-aware behavior
// ---------------------------------------------------------------------------

test("PASSES when a pre-existing error count stays exactly the same (the repo's actual case: 18 baseline TypeScript errors)", () => {
  const baseline = snapshot({ typescriptErrorCount: 18 });
  const current = snapshot({ typescriptErrorCount: 18 });
  const result = compareQualitySnapshots(baseline, current);
  const tsGate = result.gates.find((g) => g.gate === "typescript")!;
  assert.equal(tsGate.status, "pass");
  assert.equal(result.overallStatus, "pass");
  assert.deepEqual(result.newRegressions, []);
  assert.ok(result.remainingHistoricalDebt.some((d) => d.includes("18 pre-existing TypeScript")));
});

test("FAILS when TypeScript errors increase, citing exactly how many are new", () => {
  const baseline = snapshot({ typescriptErrorCount: 18 });
  const current = snapshot({ typescriptErrorCount: 20 });
  const result = compareQualitySnapshots(baseline, current);
  assert.equal(result.overallStatus, "fail");
  assert.ok(result.newRegressions.some((r) => r.includes("2 new TypeScript error")));
});

test("records a fixed regression when a pre-existing error count decreases", () => {
  const baseline = snapshot({ typescriptErrorCount: 18 });
  const current = snapshot({ typescriptErrorCount: 15 });
  const result = compareQualitySnapshots(baseline, current);
  assert.equal(result.gates.find((g) => g.gate === "typescript")!.status, "pass");
  assert.ok(result.fixedRegressions.some((f) => f.includes("3 pre-existing TypeScript")));
});

test("ESLint errors must not increase; warnings must not increase either", () => {
  const baseline = snapshot({ eslintErrorCount: 0, eslintWarningCount: 7 });
  const worseErrors = snapshot({ eslintErrorCount: 1, eslintWarningCount: 7 });
  const worseWarnings = snapshot({ eslintErrorCount: 0, eslintWarningCount: 8 });

  const errorResult = compareQualitySnapshots(baseline, worseErrors);
  assert.equal(errorResult.overallStatus, "fail");
  assert.ok(errorResult.newRegressions.some((r) => r.includes("1 new ESLint error")));

  const warningResult = compareQualitySnapshots(baseline, worseWarnings);
  assert.equal(warningResult.overallStatus, "fail");
  assert.ok(warningResult.newRegressions.some((r) => r.includes("1 new ESLint warning")));
});

test("this task's own worked example: 0 baseline unit failures -> 2 current failures is a hard FAIL", () => {
  const baseline = snapshot({ unitTestFailureCount: 0, unitTestFailureNames: [] });
  const current = snapshot({ unitTestFailureCount: 2, unitTestFailureNames: ["new test A", "new test B"] });
  const result = compareQualitySnapshots(baseline, current);
  assert.equal(result.overallStatus, "fail");
  assert.ok(result.newRegressions.some((r) => r.includes("new test A") && r.includes("new test B")));
});

test("unit tests: a historical failure that is STILL failing (same name) is not a new regression", () => {
  const baseline = snapshot({ unitTestFailureCount: 1, unitTestFailureNames: ["flaky legacy test"] });
  const current = snapshot({ unitTestFailureCount: 1, unitTestFailureNames: ["flaky legacy test"] });
  const result = compareQualitySnapshots(baseline, current);
  assert.equal(result.gates.find((g) => g.gate === "unit_tests")!.status, "pass");
  assert.equal(result.overallStatus, "pass");
  assert.ok(result.remainingHistoricalDebt.some((d) => d.includes("flaky legacy test")));
});

test("unit tests: identity-aware comparison catches a genuinely new failure even when the total COUNT is unchanged (an old failure got fixed, masking a new one by raw count alone)", () => {
  const baseline = snapshot({ unitTestFailureCount: 1, unitTestFailureNames: ["old flaky test"] });
  // Same count (1), but a totally different test is now failing — a real regression a naive count comparison would miss.
  const current = snapshot({ unitTestFailureCount: 1, unitTestFailureNames: ["brand new failure"] });
  const result = compareQualitySnapshots(baseline, current);
  assert.equal(result.gates.find((g) => g.gate === "unit_tests")!.status, "fail");
  assert.ok(result.newRegressions.some((r) => r.includes("brand new failure")));
  assert.ok(result.fixedRegressions.some((f) => f.includes("old flaky test")));
});

test("playwright follows the same identity-aware rule as unit tests", () => {
  const baseline = snapshot({ playwrightFailureCount: 1, playwrightFailureNames: ["tests/x.spec.ts > known issue"] });
  const currentSameFailure = snapshot({ playwrightFailureCount: 1, playwrightFailureNames: ["tests/x.spec.ts > known issue"] });
  const currentNewFailure = snapshot({ playwrightFailureCount: 1, playwrightFailureNames: ["tests/y.spec.ts > new break"] });

  assert.equal(compareQualitySnapshots(baseline, currentSameFailure).overallStatus, "pass");
  const failResult = compareQualitySnapshots(baseline, currentNewFailure);
  assert.equal(failResult.overallStatus, "fail");
  assert.ok(failResult.newRegressions.some((r) => r.includes("new break")));
});

test("build must succeed; a newly-broken build is always a hard failure", () => {
  const baseline = snapshot({ buildSucceeded: true });
  const current = snapshot({ buildSucceeded: false });
  const result = compareQualitySnapshots(baseline, current);
  assert.equal(result.overallStatus, "fail");
  assert.ok(result.newRegressions.some((r) => r.includes("build")));
});

test("build: a pre-existing build failure (already broken in baseline) does not block — existing debt, not this task's fault", () => {
  const baseline = snapshot({ buildSucceeded: false });
  const current = snapshot({ buildSucceeded: false });
  const result = compareQualitySnapshots(baseline, current);
  assert.equal(result.gates.find((g) => g.gate === "build")!.status, "pass");
  assert.ok(result.remainingHistoricalDebt.some((d) => d.includes("build")));
});

test("build: fixing a pre-existing build failure is recorded as a fixed regression", () => {
  const baseline = snapshot({ buildSucceeded: false });
  const current = snapshot({ buildSucceeded: true });
  const result = compareQualitySnapshots(baseline, current);
  assert.equal(result.overallStatus, "pass");
  assert.ok(result.fixedRegressions.some((f) => f.includes("build")));
});

test("a task with zero changes to any gate passes cleanly with no regressions, no fixes, and no debt reported when baseline is already clean", () => {
  const clean = snapshot();
  const result = compareQualitySnapshots(clean, clean);
  assert.equal(result.overallStatus, "pass");
  assert.deepEqual(result.newRegressions, []);
  assert.deepEqual(result.fixedRegressions, []);
  assert.deepEqual(result.remainingHistoricalDebt, []);
});

// ---------------------------------------------------------------------------
// Timeout handling (reliability hardening, 2026-08-02)
// ---------------------------------------------------------------------------

test("a gate that newly times out is a hard FAIL, even if its own counts look clean", () => {
  const baseline = snapshot({ timedOutGates: [] });
  // A killed tsc process might report 0 parsed errors from partial output —
  // the timeout itself must still fail the gate, not the (untrustworthy) count.
  const current = snapshot({ typescriptErrorCount: 0, timedOutGates: ["typescript"] });
  const result = compareQualitySnapshots(baseline, current);
  assert.equal(result.overallStatus, "fail");
  assert.ok(result.newRegressions.some((r) => r.includes("typescript") && r.includes("timed out")));
});

test("a gate that was already timing out in the baseline is historical debt, not a new regression", () => {
  const baseline = snapshot({ timedOutGates: ["playwright"] });
  const current = snapshot({ timedOutGates: ["playwright"] });
  const result = compareQualitySnapshots(baseline, current);
  assert.equal(result.overallStatus, "pass");
  assert.deepEqual(result.newRegressions, []);
  assert.ok(result.remainingHistoricalDebt.some((d) => d.includes("playwright") && d.includes("still timing out")));
});

test("a gate that stops timing out is recorded as a fixed regression", () => {
  const baseline = snapshot({ timedOutGates: ["build"] });
  const current = snapshot({ timedOutGates: [] });
  const result = compareQualitySnapshots(baseline, current);
  assert.ok(result.fixedRegressions.some((f) => f.includes("build") && f.includes("no longer timing out")));
});

test("compareQualitySnapshots tolerates a baseline captured before timedOutGates existed (missing field, not just empty array)", () => {
  const legacyBaseline = { ...snapshot(), timedOutGates: undefined } as unknown as QualitySnapshot;
  const current = snapshot({ timedOutGates: [] });
  assert.doesNotThrow(() => compareQualitySnapshots(legacyBaseline, current));
  assert.equal(compareQualitySnapshots(legacyBaseline, current).overallStatus, "pass");
});

// ---------------------------------------------------------------------------
// buildRepairPrompt / formatQualityComparisonMarkdown
// ---------------------------------------------------------------------------

test("buildRepairPrompt names exactly the new regressions and forbids touching historical debt", () => {
  const baseline = snapshot({ unitTestFailureCount: 0 });
  const current = snapshot({ unitTestFailureCount: 1, unitTestFailureNames: ["oops"] });
  const comparison = compareQualitySnapshots(baseline, current);
  const prompt = buildRepairPrompt(comparison, 1, 3);
  assert.match(prompt, /repair attempt 1 of 3/);
  assert.match(prompt, /oops/);
  assert.match(prompt, /Do not touch pre-existing historical debt/);
});

test("formatQualityComparisonMarkdown renders a table with baseline/current/result per gate", () => {
  const baseline = snapshot({ typescriptErrorCount: 18 });
  const current = snapshot({ typescriptErrorCount: 18 });
  const comparison = compareQualitySnapshots(baseline, current);
  const markdown = formatQualityComparisonMarkdown("001 — Example task", comparison, 0);
  assert.match(markdown, /PASS/);
  assert.match(markdown, /\| typescript \| 18 error\(s\) \| 18 error\(s\)/);
  assert.match(markdown, /New regressions:\*\* none/);
});

test("formatQualityComparisonMarkdown reports repair attempts when any were used", () => {
  const baseline = snapshot();
  const current = snapshot();
  const comparison = compareQualitySnapshots(baseline, current);
  const markdown = formatQualityComparisonMarkdown("001 — Example task", comparison, 2);
  assert.match(markdown, /Auto-repair attempts used: 2/);
});

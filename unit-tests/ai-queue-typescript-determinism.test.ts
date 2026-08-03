import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  buildTypescriptCheckArgs,
  runTypescriptCheck,
  compareQualitySnapshots,
  type QualitySnapshot,
} from "../scripts/ai/qualityGates.ts";

/**
 * The real incident this file guards against: a queue run's baseline.json
 * recorded typescriptErrorCount=2, while an independent `npx tsc --noEmit
 * --incremental false` on the exact same commit reported 18 — a phantom
 * 16-error "regression" that failed Task 002 three times. Root cause (see
 * qualityGates.ts's header comment): (1) tsconfig.json's `incremental: true`
 * left a persistent, gitignored tsconfig.tsbuildinfo cache read/written
 * across invocations, never reset between baseline and comparison captures;
 * (2) tsconfig.json's `include` pulls in Next.js's auto-generated
 * `.next/types` and `.next/dev/types` route validators, which are stale
 * whenever `.next/` was last built from a different branch. These tests run
 * the REAL `tsc` invocation the queue uses (not a mock) — that's the only
 * way to prove determinism, since the bug was in command construction and
 * on-disk cache/build state, not in any pure parsing logic.
 */

const REPO_ROOT = path.resolve(import.meta.dirname, "..");

test("buildTypescriptCheckArgs always returns the same argv — the single source both baseline and comparison capture call", () => {
  const args = buildTypescriptCheckArgs();
  assert.deepEqual(args, ["tsc", "--noEmit", "--project", "tsconfig.quality-gate.json", "--incremental", "false"]);
  // Called twice: proves it's not stateful (e.g. no counter, no cache flag).
  assert.deepEqual(buildTypescriptCheckArgs(), args);
});

test("REAL tsc: two consecutive checks of the same unchanged repository state report identical error counts", () => {
  const first = runTypescriptCheck(REPO_ROOT);
  const second = runTypescriptCheck(REPO_ROOT);

  assert.equal(first.timedOut, false);
  assert.equal(second.timedOut, false);
  assert.equal(
    first.errorCount,
    second.errorCount,
    `expected identical counts across two runs with no source changes between them, got ${first.errorCount} then ${second.errorCount} — this is the exact class of non-determinism that broke Task 002`
  );
});

test("REAL tsc: a stale .next/ build artifact from a different branch does not change the count (Root Cause #1)", () => {
  const staleDir = path.join(REPO_ROOT, ".next", "types");
  // A name that can never collide with Next.js's own real validator.ts —
  // this fixture is always ours to create and always ours to delete,
  // regardless of what real build output may or may not already be present.
  const staleFile = path.join(staleDir, "__typescript-determinism-test-fixture__.ts");

  const before = runTypescriptCheck(REPO_ROOT);

  mkdirSync(staleDir, { recursive: true });
  writeFileSync(
    staleFile,
    `import * as entry from "../../app/market-radar/does-not-exist-on-main/page.js";\nexport type Check = typeof entry;\n`
  );

  try {
    const after = runTypescriptCheck(REPO_ROOT);
    assert.equal(
      after.errorCount,
      before.errorCount,
      "a stale, gitignored .next/types file referencing a route from another branch must not leak into the quality gate's count — this is the .next-exclusion in tsconfig.quality-gate.json"
    );
  } finally {
    rmSync(staleFile, { force: true });
  }
});

test("REAL tsc: running the check never leaves a tsbuildinfo file behind (Root Cause #2)", () => {
  const candidatePaths = [
    path.join(REPO_ROOT, "tsconfig.tsbuildinfo"),
    path.join(REPO_ROOT, "tsconfig.quality-gate.tsbuildinfo"),
  ];

  // Start from a clean slate: tsconfig.tsbuildinfo is a gitignored, purely
  // regenerable perf cache belonging to the *real* tsconfig.json (which
  // stays incremental: true for local/editor use, see this file's header
  // comment) — a normal `npm run typecheck` or editor recheck run just
  // before this test would legitimately leave one behind, which is not
  // this test's concern. What this test proves is narrower and load-
  // bearing: runTypescriptCheck() itself never writes either file.
  for (const p of candidatePaths) rmSync(p, { force: true });

  runTypescriptCheck(REPO_ROOT);
  runTypescriptCheck(REPO_ROOT);

  for (const p of candidatePaths) {
    assert.equal(existsSync(p), false, `${p} must not exist — --incremental false must never write a persistent cache`);
  }
});

test("REAL tsc + compareQualitySnapshots: an unchanged repository never reports a false TypeScript regression", () => {
  const baselineCount = runTypescriptCheck(REPO_ROOT).errorCount;
  const currentCount = runTypescriptCheck(REPO_ROOT).errorCount;

  const base = (typescriptErrorCount: number): QualitySnapshot => ({
    generatedAt: "2026-08-02T00:00:00.000Z",
    typescriptErrorCount,
    eslintErrorCount: 0,
    eslintWarningCount: 0,
    unitTestFailureCount: 0,
    unitTestFailureNames: [],
    playwrightFailureCount: 0,
    playwrightFailureNames: [],
    buildSucceeded: true,
    timedOutGates: [],
  });

  const comparison = compareQualitySnapshots(base(baselineCount), base(currentCount));

  assert.equal(
    comparison.newRegressions.filter((r) => r.includes("TypeScript")).length,
    0,
    `unchanged repository state must never produce a TypeScript regression entry, got: ${JSON.stringify(comparison.newRegressions)}`
  );
  assert.equal(comparison.overallStatus, "pass");
});

test("tsconfig.quality-gate.json exists at the repo root (not nested) so its exclude globs resolve against the real repo layout", () => {
  // A config placed at scripts/ai/tsconfig.quality-gate.json previously
  // resolved "exclude": ["scripts/**/*"] relative to scripts/ai/ itself
  // (i.e. scripts/ai/scripts/**/*, which doesn't exist), silently type-
  // checking scripts/ files that should have been excluded. Pinning the
  // config's location is part of the fix, not an implementation detail.
  assert.equal(existsSync(path.join(REPO_ROOT, "tsconfig.quality-gate.json")), true);
  assert.equal(existsSync(path.join(REPO_ROOT, "scripts", "ai", "tsconfig.quality-gate.json")), false);
});

/**
 * Timeout- and buffer-safe subprocess helpers, shared by run-queue.ts and
 * qualityGates.ts.
 *
 * Reliability rationale: before this file existed, every subprocess call in
 * the queue (git operations, gh, tsc, eslint, unit tests, Playwright, npm
 * build) used Node's spawnSync with NO timeout and a default maxBuffer. In
 * an unattended overnight run, a single hung command (a flaky network call
 * inside `git fetch`, a Playwright test waiting on a dev server that never
 * comes up, a `gh` command unexpectedly prompting for input with no one
 * there to answer) would block the entire run indefinitely with no
 * self-recovery — the opposite of "reliable unattended execution." Every
 * call site now passes an explicit, deliberately-chosen timeout; the
 * default here exists only as a backstop, not as the primary safety
 * mechanism.
 *
 * stdout and stderr are kept separate (not merged) — several call sites
 * (ESLint's `--format json`, in particular) require clean, parseable stdout
 * with nothing from stderr interleaved into it. Use `.output` when you just
 * want everything for a human-readable log.
 */
import { spawnSync, type SpawnSyncReturns } from "node:child_process";

/** 64 MB — generous enough for a verbose Playwright/build log, small enough to still be a real bound rather than "unlimited". */
export const DEFAULT_MAX_BUFFER = 64 * 1024 * 1024;
export const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

export interface SubprocessResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  /** stdout and stderr concatenated, for logging/display only — never parse this. */
  output: string;
  timedOut: boolean;
}

/** Runs a full command line through the shell (for git/gh one-liners that already read naturally as shell commands). Always timeout- and buffer-bounded. */
export function sh(command: string, cwd: string, timeoutMs: number = DEFAULT_TIMEOUT_MS): SubprocessResult {
  const result = spawnSync(command, {
    cwd,
    encoding: "utf8",
    shell: true,
    timeout: timeoutMs,
    maxBuffer: DEFAULT_MAX_BUFFER,
    killSignal: "SIGKILL",
  });
  return finalize(result, timeoutMs);
}

/** Runs a command directly (no shell) with an explicit argv array — preferred over sh() whenever arguments come from data rather than a fixed literal, since it sidesteps shell quoting/injection entirely. Always timeout- and buffer-bounded. */
export function runCommand(command: string, args: string[], cwd: string, timeoutMs: number = DEFAULT_TIMEOUT_MS): SubprocessResult {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: DEFAULT_MAX_BUFFER,
    killSignal: "SIGKILL",
    // gh/git must never be able to block on a prompt no one is present to
    // answer in an unattended run — give them no stdin to read from at all.
    stdio: ["ignore", "pipe", "pipe"],
  });
  return finalize(result, timeoutMs);
}

function finalize(result: SpawnSyncReturns<string>, timeoutMs: number): SubprocessResult {
  const stdout = result.stdout ?? "";
  let stderr = result.stderr ?? "";
  // Node sets status to null and signal to the kill signal when spawnSync's
  // own `timeout` option fires — this is how a timeout is distinguished
  // from a normal nonzero-exit failure.
  const timedOut = result.status === null && result.signal !== null;
  if (timedOut) {
    const humanTimeout = timeoutMs >= 1000 ? `${Math.round(timeoutMs / 1000)}s` : `${timeoutMs}ms`;
    stderr = `${stderr}\n[process killed after exceeding its ${humanTimeout} timeout]`;
    return { ok: false, stdout, stderr, output: stdout + stderr, timedOut: true };
  }
  return { ok: result.status === 0, stdout, stderr, output: stdout + stderr, timedOut: false };
}

import test from "node:test";
import assert from "node:assert/strict";
import { sh, runCommand } from "../scripts/ai/subprocess.ts";

/**
 * Reliability hardening (2026-08-02): before subprocess.ts existed, no
 * command the queue ran had a timeout, so a single hung command could block
 * an unattended overnight run forever. These tests prove the timeout
 * actually fires and is distinguishable from a normal failure, using real
 * short-lived processes rather than mocks — the behavior under test is
 * fundamentally about real process/signal handling.
 */

test("sh() returns ok:true and the command's real output for a normal, fast command", () => {
  const result = sh("echo hello", process.cwd());
  assert.equal(result.ok, true);
  assert.equal(result.timedOut, false);
  assert.match(result.stdout, /hello/);
});

test("sh() kills a command that exceeds its timeout and reports timedOut:true, ok:false", () => {
  const result = sh("sleep 5", process.cwd(), 300);
  assert.equal(result.ok, false);
  assert.equal(result.timedOut, true);
  assert.match(result.output, /exceeding its .+ timeout/);
});

test("sh() reports ok:false, timedOut:false for a normal nonzero exit (not a timeout)", () => {
  const result = sh("exit 1", process.cwd(), 5000);
  assert.equal(result.ok, false);
  assert.equal(result.timedOut, false);
});

test("runCommand() keeps stdout and stderr separate (does not interleave them)", () => {
  const result = runCommand("node", ["-e", "process.stdout.write('out-marker'); process.stderr.write('err-marker');"], process.cwd(), 10_000);
  assert.match(result.stdout, /out-marker/);
  assert.doesNotMatch(result.stdout, /err-marker/);
  assert.match(result.stderr, /err-marker/);
  assert.doesNotMatch(result.stderr, /out-marker/);
  // .output is the combined view, for logging only.
  assert.match(result.output, /out-marker/);
  assert.match(result.output, /err-marker/);
});

test("runCommand() never blocks on stdin — a command that would otherwise wait for input exits instead", () => {
  const result = runCommand("node", ["-e", "process.stdin.on('data', () => {}); process.stdin.on('end', () => console.log('stdin-ended'));"], process.cwd(), 5000);
  assert.equal(result.timedOut, false, "a command reading stdin must see immediate EOF (stdio: ignore), not hang waiting for input that will never come in an unattended run");
  assert.match(result.stdout, /stdin-ended/);
});

test("runCommand() kills a command that exceeds its timeout", () => {
  const result = runCommand("node", ["-e", "setTimeout(() => {}, 10000)"], process.cwd(), 300);
  assert.equal(result.ok, false);
  assert.equal(result.timedOut, true);
});

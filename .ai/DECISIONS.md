# Architecture Decision Records

Only decisions supported by the repository (its docs, tests, or code) or clearly marked initial-framework decisions belong here. When a decision is revisited, add a new dated entry rather than editing history — link back with `Supersedes: ADR-000N`.

Numbering follows `docs/ARCHITECTURE_DECISIONS.md`, the primary source for ADR-0001 through ADR-0010. Consult that file for full rationale; this is an index, not a replacement.

## ADR-0001 — Tenant scoping via `*ForUser` / `*ForCurrentUser`
Every tenant-scoped data access takes an explicit `userId` (`*ForUser(userId, supabaseClient?)`) or resolves the current session (`*ForCurrentUser()`). Enforced additionally by Postgres RLS. Source: `docs/ARCHITECTURE_DECISIONS.md`.

## ADR-0002 — `patchContentApprovalForUser` as the single authoritative mutation
Content approval state changes go through exactly one function, not scattered ad-hoc writes. Source: `docs/ARCHITECTURE_DECISIONS.md`.

## ADR-0003 — Two separate signed-token families
Weekly-package "open" links and email-action tokens are deliberately separate token families with different scope/lifetime, not one generalized token system. Source: `docs/ARCHITECTURE_DECISIONS.md`.

## ADR-0004 — `ATTACH_DECLARATIVE_PRODUCTION_CRONS` as the production-activation gate
Flipping this flag is "a real production decision requiring its own sign-off, not a refactor." No PR, feature, or automated agent may flip it. Source: `docs/ARCHITECTURE_DECISIONS.md`; enforced further by this repo's `.ai/queue/` safety validator (see `ARCHITECTURE.md`).

## ADR-0005 — Two live job/queue systems, not yet merged
`background_jobs` (Postgres, polled) and Trigger.dev (v4 SDK) co-exist. Acknowledged as unmerged, not accidental duplication. Source: `docs/ARCHITECTURE_DECISIONS.md`.

## ADR-0006 — `lib/google-business` vs. `lib/google-business-profile`
A real split (auth vs. operations) kept as two folders. Flagged as friction in `docs/ARCHITECTURE_REVIEW_2026.md` §3.2, not defended as correct — recorded so a future refactor knows the *intent* even though the *execution* needs cleanup. Source: `docs/ARCHITECTURE_DECISIONS.md`.

## ADR-0007 — Three parallel "what should this business do" systems
Marketing Recommendations, Tasks, and Marketing Plan currently compete as separate answers to the same underlying customer question. **Status: unresolved as of 2026-07-31** — see `OPEN_ITEMS.md`. Source: `docs/ARCHITECTURE_DECISIONS.md`.

### Sub-decision (2026-07-16, One Head of Marketing)
`lib/head-of-marketing` → `/dashboard` is the authoritative customer-facing answer among these competing systems, at least for the primary dashboard surface. Source: `docs/ARCHITECTURE_DECISIONS.md`.

## ADR-0008 — Admin/ops as a separate, un-productized console
Internal operator tooling is deliberately kept out of the customer-facing product surface. Source: `docs/ARCHITECTURE_DECISIONS.md`.

## ADR-0009 — Assisted Pilot as an autonomy on-ramp, not a fifth decision system
Assisted Pilot exists to build trust toward more autonomous execution — it composes existing systems' outputs, it does not add its own competing "what to do" logic. Source: `docs/ARCHITECTURE_DECISIONS.md`.

## ADR-0010 — Documentation-first product definition
`docs/` (especially `docs/project-magic/`) is treated as authoritative product design ahead of implementation. Source: `docs/ARCHITECTURE_DECISIONS.md`. **Caveat added 2026-07-31**: this repo's own investigation found `docs/project-magic/IMPLEMENTATION_ROADMAP.md` has drifted out of sync with shipped work (see `OPEN_ITEMS.md`) — documentation-first does not mean documentation-is-infallible; verify against code and Git history per `AGENTS.md`.

## ADR-0011 — Shared AI project memory + overnight task queue (2026-07-31)
**Status:** Initial framework decision, this build.

**Decision:** Introduce `.ai/` as the repository's shared, versioned memory for every AI coding tool (Claude Code, ChatGPT via manual upload, Grok/Cursor, future tools), plus a sequential, file-based task queue (`.ai/queue/`) that can run multiple pre-approved prompts through Claude Code non-interactively, with a hard safety validator that rejects any task requesting merge, deploy, production migrations, secret changes, or production-schedule activation.

**Why:** Prior to this, project context lived only in chat history (lost between sessions/tools) and in `docs/*.md` (rich, but not structured for machine consumption or fast agent orientation, and prone to drifting stale — see ADR-0010's caveat above). Multiple AI tools working on this repo need one shared, low-ceremony source of truth, and any automation that can run overnight needs an explicit, auditable safety boundary rather than relying on each tool's own judgment every time.

**Alternatives considered:** Rely solely on `docs/`. Rejected — not structured for a "read this before starting" workflow, and this build's own research found it already drifting (ADR-0010 caveat). Rely solely on chat-history continuity. Rejected — explicitly the problem being solved (per this task's own primary objective).

**Consequences:** Every agent (per `AGENTS.md`) must now read `.ai/` before starting work and update it before finishing, in the same branch/PR as the implementation. The queue's Claude adapter (`scripts/ai/adapters/claude.ts`) is implemented against documented Claude Code CLI conventions but has **not been end-to-end verified in this build's sandbox**, because no `claude` CLI binary was present on `PATH` here — see `OPEN_ITEMS.md` and `docs/AI_OVERNIGHT_QUEUE.md` for the required first daytime dry run before any unattended overnight use. The Cursor/Grok adapter is an explicit placeholder (`scripts/ai/adapters/cursor-placeholder.ts`) that reports itself unavailable — it makes no functionality claim.

## ADR-0012 — Queue v2: baseline-aware quality gates (2026-08-01)
**Status:** Implemented, this build.

**Decision:** `scripts/ai/run-queue.ts` no longer requires a task's post-change quality-gate run to be perfectly clean. It captures one `QualitySnapshot` of the repository (TypeScript, ESLint errors/warnings, unit tests, Playwright, build) before a run's first eligible task begins, persists it to `.ai/runs/<run-id>/baseline.json`, and compares every task's own after-state against that same baseline (`scripts/ai/qualityGates.ts`). A task passes if it introduces no new regressions relative to the baseline, regardless of how much pre-existing debt the baseline already carried. Unit-test and Playwright comparisons are identity-aware (by failing-test name), not just count-based, so a coincidentally-fixed old failure can't mask a genuinely new one. A task whose comparison fails gets up to `queue.max_repair_attempts` (default 3) automatic repair invocations, each scoped narrowly to the specific new regressions found, before the task is marked failed and the queue stops.

**Why:** ADR-0011's v1 queue ran a fixed lint/typecheck/unit-test command list and required it to pass cleanly. This repository intentionally carries a small number of documented, pre-existing baseline issues (`OPEN_ITEMS.md`'s "Pre-existing type-check debt"), so v1's gate evaluated repository-wide quality rather than task-specific quality — it stopped the queue's first real daytime run even on a task that introduced zero regressions of its own. That made unattended execution practically impossible, since almost any real task would otherwise be judged against a bar the repository itself doesn't currently clear.

**Alternatives considered:** Fix the pre-existing debt first, then keep v1's "must be clean" gate. Rejected — conflates two unrelated concerns (this queue's job is to judge a task's own diff, not to opportunistically fix unrelated debt as a side effect of unblocking automation) and doesn't generalize: new debt could appear from work outside the queue at any time. Compare only raw counts (baseline count vs. current count). Rejected as the sole mechanism — a naive count comparison can't distinguish "the same historical failure" from "a different, new one that happens to net out to the same total," so identity-aware (by test name) comparison is used for unit tests and Playwright specifically, with counts kept only as a human-readable summary alongside it.

**Consequences:** A queue run now costs one extra full quality-suite invocation up front (the baseline capture) plus one per task-completion-attempt (and one more per repair attempt) — meaningfully slower than v1's single gate pass, accepted as the cost of correctness. `.ai/runs/<run-id>/` now also contains `baseline.json` and one `task-<id>-quality.json` per attempted task (both committed; raw logs remain gitignored). See `docs/AI_OVERNIGHT_QUEUE.md`'s "Queue v2" section for the full walkthrough and `scripts/ai/qualityGates.ts` for the implementation.

## ADR-0013 — Claude CLI invocations run with `--dangerously-skip-permissions` (2026-08-02)
**Status:** Implemented, this build. Security-relevant — read in full before changing.

**Decision:** `scripts/ai/adapters/claude.ts` now invokes `claude -p --output-format json --dangerously-skip-permissions` for every queue task, instead of omitting the permission flag. `checkAvailability()` also verifies the installed CLI's `--help` output mentions a permission-bypass flag before reporting the agent available at all. As a second, independent layer, the adapter now parses the JSON response body and treats a non-empty `permission_denials` array or `is_error: true` as a real failure regardless of exit code — it no longer trusts exit code 0 alone.

**Why:** The queue's first real, live unattended run (2026-08-02, run id `2026-08-02T065749882Z`, evidence preserved under `.ai/runs/2026-08-02T065749882Z/`) invoked `claude -p` with no permission flag. Claude correctly tried to use its Write/Edit/Bash tools, correctly triggered the CLI's normal interactive per-tool-call approval flow, and — with no human present in an unattended session to approve anything — every approval sat pending until Claude gave up. It then exited 0 with a text explanation of what happened, having made zero file changes. The adapter's old logic checked only the exit code, saw 0, and reported success; `run-queue.ts`'s own auto-repair loop (ADR-0012) then burned a second, identical, equally-blocked invocation before a human had to read the raw log by hand to find the real cause. An unattended queue that silently does nothing while reporting success is worse than one that visibly fails — this is the single largest reliability gap `.ai/OPEN_ITEMS.md`'s "This build's own limitation" entry had flagged as unverified, and it's exactly what happened.

**Alternatives considered:** A narrower permission mode (e.g. `--permission-mode acceptEdits`, which typically only auto-accepts file-edit tool calls, not Bash). Rejected — the live incident's log shows Bash tool calls were *also* permission-denied (`git diff`/exploratory reads the agent attempted), so a mode that leaves Bash gated would still block on real, ordinary task work (running tests, reading multiple files via a single command, etc.). Do nothing and rely on a human to notice a silent no-op run each time. Rejected — directly defeats this task's own purpose ("enable reliable unattended overnight execution"); an unattended run with no one watching needs the failure to be *detected*, not just theoretically diagnosable after the fact from a raw log.

**Why this is an acceptable tradeoff, not a safety regression:** the thing that actually keeps an unattended queue run safe was never "a human approves each individual tool call" — that requirement is fundamentally incompatible with "unattended." The real safety boundary is, and remains, `scripts/ai/validate-queue.ts` (rejects any task or safety-block setting requesting merge, deploy, a production migration, a secret change, or production-schedule activation, cross-checked against the real code-level `ATTACH_DECLARATIVE_PRODUCTION_CRONS` gate) plus the simple fact that `run-queue.ts`'s own code never calls any of those operations — there is no flag to bypass because the capability isn't present in the orchestrator's code path at all. Skipping *interactive tool-call approval* removes a layer that could never function unattended in the first place; it does not remove the layer that actually enforces this repository's safety boundaries. A human still reviews and merges every PR the queue opens — nothing about this decision changes that.

**Consequences:** Every queue task's Claude invocation now runs with full tool access (no per-call approval prompts) inside this repository's checkout. This is scoped to `scripts/ai/adapters/claude.ts`'s own invocations only — it is not a global CLI setting, and it does not change how any human runs `claude` interactively. The fix's *failure-detection* path (permission-denial parsing) was proven correct against the real incident's actual response shape (see `unit-tests/ai-queue-claude-adapter.test.ts`). Its *success* path — a real `claude --dangerously-skip-permissions` invocation actually completing a real task end-to-end — has **not yet been verified**, because no `claude` binary was on `PATH` in the sandbox this fix was built in either. See `.ai/OPEN_ITEMS.md` and `docs/AI_OVERNIGHT_QUEUE.md`'s daytime dry run requirement before trusting this for a real unattended overnight run.

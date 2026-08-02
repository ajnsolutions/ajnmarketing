# Project Memory — AJN Marketing

Generated 2026-08-02T16:01:21.851Z by `scripts/ai/export-memory.ts`. This file combines every `.ai/` memory doc into one upload-friendly document for AI tools without direct repository access. It is a snapshot — for anything time-sensitive, prefer reading the repository directly if you can.


---

## Current Status

# Current Status

> Machine-readable twin: [`STATUS.json`](./STATUS.json). If the two ever disagree, `STATUS.json` is stale and needs a fix — this file and that one must be updated together.

**Project name:** AJN Marketing ("Project Magic")

**Current product mission:** Make AJN Marketing feel like a small business hired the best Head of Marketing it could ever have — not like it bought another marketing tool. The product is evolving from an AI marketing platform into a broader "AI Growth Engine" for small businesses (Project Magic 2.0), with marketing as the first application of that intelligence.

**Current development phase:** Project Magic 2.0 (AI Growth Engine). Of the four planned waves in `docs/project-magic/IMPLEMENTATION_ROADMAP.md`:
- **Wave I** (Free Marketing Snapshot + Business Brain foundation) — shipped: public pre-auth Snapshot, secure SSRF-hardened backend contract, DNS-pinned continuation bridge, First Impression customer-facing UI, internal-alpha intelligence pass.
- **Wave II** (Connector Framework + Smart Uploads) — shipped: Business Connections foundation, Smart Uploads (PDF/DOCX/TXT/MD), Google Search Console as the first live Website & Search connector.
- **Wave III** (Customer Voice, Market Radar, Seasonal Intelligence) — partially shipped: Goals & Strategy shipped, Customer Voice Phase 1 + 2 shipped (Google Reviews + Website Testimonials providers). Market Radar's owner-managed persistence foundation shipped this session (`lib/market-radar/`, migration `037_market_radar.sql`, branch `ai-queue/001-market-radar-foundation` — persistence and types only, no UI yet). Seasonal Intelligence is **not yet started**.
- **Wave IV** (Business Pulse + Autopilot) — not started as originally scoped, but several features that read like an organic continuation of it have shipped outside the formal wave numbering (see below).

The 1.0 roadmap (`docs/IMPLEMENTATION_ROADMAP.md`, Phases A–H) runs in parallel and still governs marketing-specific delivery: Phases A–C are largely shipped; **Phases D, E, F, G, H remain scope-only, not shipped.**

**Major completed systems:**
- Authenticated marketing loop: Marketing Director orchestration, recommendations, campaigns, experiments, decision intelligence, strategic calendar, marketing memory (4-layer model), guided onboarding, Assisted Pilot — collectively validated through Release Candidate 1.
- Business Brain intelligence layer (shipped, but **not named in the 2.0 wave roadmap document** — see Open Items): Business Knowledge Graph, Business Learning Engine, Business Brain Inspector, External Intelligence foundation, Business Connections, Opportunity Detection Engine.
- Growth Advisor experience (replaces the previous `/dashboard` composition) and Autonomous Growth Planner (recommend-only, no auto-execution).
- Head of Marketing Orchestrator — the newest merge (PR #96): a daily Executive Review composing Weekly Growth Plan + Executive Brief + Opportunity Engine into one view, at `/dashboard/executive-review` (customer) and `/dashboard/admin/executive-overview` (admin).
- Publishing pipeline with atomic job claiming (background_jobs table + Trigger.dev, two systems not yet merged — see `DECISIONS.md`).

**Current active initiative:** Dependency-base resolution fix (branch `fix/queue-merged-dependency-base-resolution`). This is the direct sequel to the completion-state fix (PR #102, merged): once Task 001's `QUEUE_STATUS.json` entry was corrected, `npm run ai:queue` correctly selected Task 002 — and then failed trying to branch it, because Task 001's local branch had been (correctly) deleted after PR #101 merged: `git checkout -b ai-queue/002-... ai-queue/001-market-radar-foundation` → `fatal: 'ai-queue/001-market-radar-foundation' is not a commit`. **Root cause:** the old `determineBranchBase()` unconditionally reused a completed dependency's *recorded branch name* forever, with no check for whether it still existed — silently requiring every merged dependency branch to survive indefinitely. Fixed (see `DECISIONS.md` ADR-0015): `scripts/ai/reconcile.ts`'s new `resolveDependencyBase()` resolves a merged dependency to its real, GitHub-verified merge target (normally `origin/main`), independently verifying the merge commit's ancestry before trusting it — a merged dependency's branch is never required to still exist. An open (unmerged) dependency still uses its own branch; an unverifiable dependency stops the run with an actionable error rather than guessing. This now runs as a cheap preflight step, before the expensive quality-gate baseline is captured — directly motivated by the real failed run's own evidence (`.ai/runs/2026-08-02T151115309Z/`), which shows a full baseline was captured before the cheap failure was discovered. Task 002's `QUEUE_STATUS.json` entry was reset from `"failed"` back to `"pending"` in this PR (Task 001's `"completed"` entry untouched) — **Task 002 is confirmed eligible again**, and `resolveDependencyBase()` was independently verified against this repo's real, live `gh`/`git` state to correctly resolve its base to `origin/main`. See `HANDOFF.md` for full details and exact next-step commands.

**Known safety gates (must not be silently changed by any agent):**
- `ATTACH_DECLARATIVE_PRODUCTION_CRONS` — the Trigger.dev production-schedule activation gate. **Must remain `false`.** Canonical source: `lib/trigger/scheduleActivation.ts`. Referenced/enforced across ~10+ tests, most `docs/` files, and this repo's own `RUNBOOKS.md` (which treats an accidentally-`true` gate as a severe production-safety incident).
- No automatic merges, no automatic deploys, no automatic production migrations, no automatic secret changes — enforced by process (`AGENTS.md`) and by the queue's `safety:` block (`.ai/queue/RUN_QUEUE.yaml`), not by any code-level lock.

**Current blockers:** see `STATUS.json.current_blockers` and `OPEN_ITEMS.md` (security gap, architecture decision debt, production launch blockers, missing recommendation-engine trigger).

**Recommended next step:** Resolve the three-competing-"what should this business do"-systems architecture question (`docs/ARCHITECTURE_REVIEW_2026.md`) before adding further recommendation/decision surface area. In parallel, patch the spoofable `x-forwarded-for` rate-limit key on the public interactive-demo endpoint (§3.9 of that same review) — it is an active, unbounded-cost-abuse security gap, not a hypothetical one.

**Date last verified:** 2026-08-02

**Branch/commit used for verification:** `fix/queue-merged-dependency-base-resolution`, based on `origin/main` at `952df6e` (merge of PR #102).


---

## Roadmap

# Roadmap

This file summarizes two companion roadmap documents that both remain in force:
- `docs/IMPLEMENTATION_ROADMAP.md` — Project Magic **1.0**, Phases A–H, still governs marketing-specific delivery.
- `docs/project-magic/IMPLEMENTATION_ROADMAP.md` — Project Magic **2.0** (AI Growth Engine), Waves I–IV.

Do not treat either source doc as replaced by this summary — this file is a synthesis for quick agent orientation, not the authoritative text. When in doubt, read the source doc.

## Completed

**1.0, Phases A–C** (public experience, onboarding, customer dashboard) — largest concentration of shipped work: One Head of Marketing, Weekly Briefing, HoM Journal, Executive Briefing Engine, Campaign Intelligence Engine, Interactive HoM, Strategic Marketing Calendar, Marketing Experimentation Engine, Decision Intelligence & Learning Impact, Customer Experience Polish, Guided Onboarding & Setup, Assisted Pilot Readiness, Pilot Validation & Go-Live Readiness (RC-1), Monthly Focus, Great Simplification, Proactive HoM, Product Readiness (UX polish pass), Marketing Director Intelligence Foundation. Marketing Memory sub-track: Phases 1–4 (through Marketing Director consumption) implemented.

**2.0, Wave I** (Free Marketing Snapshot + Business Brain foundation) — AI Business Discovery orchestration, secure public/pre-auth Snapshot backend (SSRF-hardened, DNS-pinned, rate-limited, 15-min TTL cache), First Impression customer-facing UI, snapshot continuation (resolve/claim/confirm + onboarding prefill), internal-alpha intelligence pass.

**2.0, Wave II** (Connector Framework + Smart Uploads) — Business Connections foundation, Smart Uploads (PDF/DOCX/TXT/Markdown → "I learned..." pipeline), Google Search Console as the first live Website & Search connector.

**2.0, Wave III (partial)** — Goals & Strategy (goal model, strategy-layer relevance, Goal Progress, goal-aware Growth Advisor briefing), Customer Voice Phase 1 (provider-agnostic intelligence engine, Google Reviews) and Phase 2 (customer-facing experience; Website Testimonials as the second provider).

**Shipped outside the formal wave sequence** (not named in `docs/project-magic/IMPLEMENTATION_ROADMAP.md` — see Open Items for the reconciliation flag): Business Connections foundation, Business Knowledge Graph & cross-source reasoning, Business Learning Engine, External Intelligence foundation, Growth Advisor Experience, Autonomous Growth Planner, Business Brain Inspector, Opportunity Detection Engine, Project Magic Phase 2 (experience simplification), Head of Marketing Orchestrator (newest merge, PR #96).

## In progress

Nothing is currently mid-flight on the product track: no open PR, no unmerged product branch tied to an active doc (verified 2026-07-31). Two unmerged remote branches exist but are not confirmed active work — see `OPEN_ITEMS.md`.

## Next

Per `docs/project-magic/IMPLEMENTATION_ROADMAP.md`, Wave III's remaining scope:
- **Market Radar** — owner-facing add/remove/prioritize/benchmark controls over the existing `lib/market-context/` competitor provider (expansion, not a rebuild, per `EXISTING_SYSTEM_AUDIT.md`). Persistence foundation shipped (`lib/market-radar/`, migration `037_market_radar.sql`, branch `ai-queue/001-market-radar-foundation`); the owner-facing view (Task 002) is next.
- **Seasonal Intelligence** — forward-looking, lead-time-aware forecasts on top of the existing `lib/marketing-memory/seasonality.ts` recurrence classification (expansion, not a rebuild).

Per `docs/ARCHITECTURE_REVIEW_2026.md`, the highest-priority non-feature work: resolve the three-competing-decision-systems question (Marketing Recommendations vs. Tasks vs. Marketing Plan, plus Assisted Pilot as a fourth adjacent layer) before shipping further recommendation surface area.

## Later

**2.0, Wave IV** (Business Pulse + Autopilot) — Growth Momentum composed from Marketing Health + Customer Voice + Market Radar + Seasonal Intelligence; monthly Business Pulse report; broadened Trust Model gating from marketing-only to Growth-Engine-wide; Autopilot framing at the top of the existing trust ceiling. Explicitly depends on Waves I–III shipping with **real production signal** first (per that wave's own anti-padding rule), and does **not** itself flip the production-schedule gate.

**1.0, Phases D–H** — still scope-only in the source roadmap doc, not shipped: further marketing workflow, results & Marketing Health, admin operating console, trust progression, and Phase H's "Autonomous Head of Marketing." Some of this scope may already be substantially covered by the out-of-sequence Business Brain / Orchestrator work above — recommend a human reconcile before treating Phases D–H as fully open.

## Pre-launch requirements

From `docs/LAUNCH_CHECKLIST.md` and `docs/PRODUCTION_READINESS.md` (dated 2026-07-14, status "Launch-ready with conditions"):
1. Confirm Supabase service-role key rotation.
2. Decide assisted-vs-scheduled pilot operating mode.
3. Provision production environment variables (Supabase, Trigger.dev, OpenAI, GBP OAuth, email).
4. **Do not flip `ATTACH_DECLARATIVE_PRODUCTION_CRONS`** — remains a separate, explicit, ops-approved decision, not a side effect of any feature work.
5. Run migrations, smoke tests, verify monitoring/alerting, confirm rollback plan, obtain sign-off (full checklist in `LAUNCH_CHECKLIST.md`).

Known remaining risk items from `docs/RELEASE_CANDIDATE_END_TO_END_AUDIT.md`: Opportunity/Decision Engine has no trigger anywhere in the product; `GET /api/publishing` executes due jobs as a page-load side effect; Approval Center overstates automation in its copy; GBP Disconnect is a no-op; Regenerate silently severs the recommendation link; the analytics→opportunities feedback loop is dead in production. See `OPEN_ITEMS.md` for the full list with severities.


---

## Architecture

# Architecture

High-level orientation only. For subsystem depth, follow the `docs/*.md` and `docs/project-magic/*.md` links cited inline — this file summarizes, it does not replace them.

**Read this warning before writing any code:** per root `AGENTS.md`, this repo runs a Next.js version with breaking changes from training-data conventions (`16.2.9`). Consult `node_modules/next/dist/docs/` before assuming any API.

## Application framework

Next.js 16.2.9, App Router (`app/`), React 19.2.4, TypeScript 5 (`strict: true`, `noEmit: true`, path alias `@/*` → repo root), Tailwind CSS 4. Top-level `app/` routes: `about, ai-demo, api, auth, contact, dashboard, demo, features, for-agencies, forgot-password, how-it-works, industries, login, onboarding, pricing, signup, snapshot`. `lib/` holds ~70 subsystem folders (see groupings below); almost no business logic lives directly in `app/`.

## Database and authentication

Supabase (`@supabase/supabase-js`, `@supabase/ssr`). Sequential numbered SQL migrations in `supabase/migrations/` (currently `001_business_profiles.sql` through `036_opportunity_detection_engine.sql`), one file per feature, applied via Supabase CLI — **never apply migrations automatically as part of any agent task.** Tenant isolation is enforced via Postgres RLS (verified live in `scripts/audit/rls-tenant-isolation.ts`) and, at the code layer, via the `*ForUser(userId, supabaseClient?)` + `*ForCurrentUser()` calling convention (`DECISIONS.md` #1).

Auth gating: root `middleware.ts` calls `lib/supabase/middleware.ts`'s `updateSession()` on every request except static assets, and only actually redirects for `/dashboard` and `/onboarding` — `/snapshot` and all public marketing pages are intentionally ungated. Next.js middleware runs on the **Edge runtime by default**; this repo does not configure the Node middleware experimental flag, so `middleware.ts` is the one Edge-runtime surface in the app. **There is no dedicated Edge-runtime test suite** — this behavior is exercised only indirectly, via Playwright specs asserting redirect behavior on protected routes. No `app/**/route.ts` declares `export const runtime = "edge"` anywhere in the codebase (verified by grep); all API routes run on the Node.js runtime.

## AI systems

OpenAI (`openai` SDK) powers: website-analysis extraction (`lib/website-analysis/`), the AI Marketing Profile pipeline, and the Business Brain's synthesis layer. Every AI call site follows a graceful-degradation convention — timeout-wrapped, falling back to a deterministic placeholder generator with an honest `degraded: true` flag rather than crashing or hanging (see `docs/BUSINESS_DISCOVERY_SNAPSHOT_TROUBLESHOOTING.md` for the canonical example). `OPENAI_API_KEY` is read lazily per-request, never validated at startup, and is never fatal if absent.

Business Brain intelligence layer: `lib/business-brain/`, `lib/business-brain-inspector/`, `lib/business-knowledge-graph/` (cross-source reasoning), `lib/business-learning-engine/` (learns from real recommendation outcomes), `lib/business-discovery/` (orchestration — both authenticated and public/pre-auth variants), `lib/external-intelligence/`. Marketing Director (`lib/marketing-director/`) remains the sole marketing decision-maker composing these inputs — see `DECISIONS.md` for the open question of competing decision surfaces.

## Background jobs and scheduling

**Two parallel job systems co-exist, not yet merged** (`DECISIONS.md` #5): a `background_jobs` Postgres table (polled) and Trigger.dev v4 SDK (`@trigger.dev/sdk`, `trigger/` directory, `trigger.config.ts`). Trigger.dev tasks (`trigger/publishingDue.ts`, `trigger/analyticsCapture.ts`, `trigger/recommendationPipeline.ts`) are written but **deliberately omit declarative cron attachment** behind the `ATTACH_DECLARATIVE_PRODUCTION_CRONS` gate.

**This is the repo's single most important safety boundary.** Canonical definition: `lib/trigger/scheduleActivation.ts`. Consumed/re-checked in `lib/config/validate.ts`, `lib/production-health/`, `lib/ops-dashboard/`, `lib/production-alerts/`, `lib/production-readiness/`, `lib/failure-injection/`, every `lib/assisted-pilot/*` scheduling path, and 10+ tests. Flipping it to `true` is documented as "a real production decision requiring its own sign-off, not a refactor" (`DECISIONS.md` #4) — no agent, human or AI, should flip it as a side effect of unrelated work. The `.ai/queue/` system in this repo adds a second, independent enforcement layer: the queue validator rejects any task or queue config that requests production-schedule activation, regardless of what the code-level gate currently says.

## Publishing

`lib/publishing/`, `lib/publishing-queue/`. Publishing uses atomic job claiming (fixed in PR #23, "no page-load execution") — however `docs/RELEASE_CANDIDATE_END_TO_END_AUDIT.md` records that `GET /api/publishing` still executes due jobs as a live side effect of a page load as of that audit; treat this as an open, documented risk (see `OPEN_ITEMS.md`), not a resolved contradiction.

## Analytics

`lib/market-context/` (competitor/market signal, feeds Market Radar's planned expansion), analytics-feedback capture feeding recommendation outcomes. `docs/RELEASE_CANDIDATE_END_TO_END_AUDIT.md` notes the analytics→opportunities feedback loop is currently dead in production.

## Recommendations / decisions

`lib/marketing-opportunities/`, `lib/opportunity-engine/` (Opportunity Detection Engine), `lib/marketing-decisions/`, `lib/recommendation-execution/`, `lib/recommendation-outcomes/`, `lib/recommendation-pipeline/`, `lib/recommendation-presentation/`, `lib/recommendation-learning/`. **Architecturally unresolved**: `docs/ARCHITECTURE_REVIEW_2026.md` identifies three competing "what should this business do" systems here (Marketing Recommendations, Tasks, Marketing Plan) plus Assisted Pilot as a fourth adjacent layer — called the single biggest prerequisite decision for further Magic work. Also unresolved as of the RC audit: the Opportunity/Decision Engine has no trigger anywhere in the product.

## Approval workflows

`lib/content-approval/` (`patchContentApprovalForUser` as the single authoritative mutation, `DECISIONS.md` #2), `lib/email-actions/` (two separate signed-token families — weekly-package "open" links vs. email-action tokens, `DECISIONS.md` #3), `lib/weekly-approval-package/`.

## Testing

- **Unit**: Node's built-in test runner, `unit-tests/*.test.ts`, invoked via `node --import ./unit-tests/support/register.mjs --test unit-tests/*.test.ts` (`npm run test:unit`). `register.mjs` resolves the `@/*` path alias and stubs `server-only`/`next/headers`/`next/server` for plain-Node execution outside the Next.js runtime.
- **E2E**: Playwright, `tests/*.spec.ts` (`npm run test:e2e`). CI (`.github/workflows/e2e.yml`) runs Playwright only, on `pull_request`, against Chromium. CI does **not** currently run lint, typecheck, or unit tests — those are run manually/locally as quality gates (see `docs/AI_QUEUE_TROUBLESHOOTING.md` for the full gate list this repo's AI tooling now enforces before opening a PR).
- **One-off audit scripts**: `scripts/audit/*.ts`, run via `node --experimental-strip-types scripts/audit/<name>.ts`, excluded from the main `tsconfig.json`'s type-checking (`scripts/**/*` is in `exclude`) and from `test:unit`/`test:e2e` — standalone verification tools, not part of the committed test suite. The `.ai/queue/` tooling (`scripts/ai/`) follows this same run convention. The queue's own per-task quality gate (`scripts/ai/qualityGates.ts`, "Queue v2") is baseline-aware — see `DECISIONS.md` ADR-0012 and `docs/AI_OVERNIGHT_QUEUE.md` — so it never blocks on this repository's own pre-existing debt, only on regressions a queue task itself introduces. Every subprocess the queue shells out to (git, `gh`, quality gates, the `claude` CLI itself) goes through `scripts/ai/subprocess.ts`, which requires an explicit timeout at every call site — added after the queue's first live run showed nothing had one. The `claude` CLI invocation runs with `--dangerously-skip-permissions` (`DECISIONS.md` ADR-0013) — a deliberate, documented tradeoff, not an oversight; the queue's actual safety boundary is `validate-queue.ts` plus the fact that no merge/deploy/migration/secret-change/schedule-activation call exists anywhere in `run-queue.ts`'s code, not per-tool-call human approval (which cannot function in an unattended run by definition).

## Deployment

Vercel (implied by prior production-URL investigation; no `vercel.json` in the repo — Vercel's zero-config Next.js detection is relied on). Production branch is `main`. No AI agent workflow in this repo may trigger, configure, or alter a deployment — that remains an explicit, human, Vercel-console action.

## Major architectural boundaries

- **Tenant scoping**: `*ForUser(userId, supabaseClient?)` / `*ForCurrentUser()` calling convention, enforced additionally by Postgres RLS (`DECISIONS.md` #1).
- **Admin/ops vs. customer-facing**: admin/ops is a deliberately un-productized console, never exposed to customers (`DECISIONS.md` #8).
- **`lib/google-business` vs. `lib/google-business-profile`**: a real, acknowledged naming/execution split (auth vs. operations) — flagged as friction in `ARCHITECTURE_REVIEW_2026.md` §3.2, not defended as correct, recorded so a future refactor knows the original intent (`DECISIONS.md` #6).
- **Three competing decision systems** (see Recommendations/decisions above) — the largest currently-open architectural boundary question in the codebase.
- **Documentation-first product definition**: `docs/` (especially `docs/project-magic/`) is treated as authoritative product design, not just after-the-fact notes (`DECISIONS.md` #10) — but this repo's own investigation found the 2.0 wave roadmap doc has drifted out of sync with actually-shipped work (see `OPEN_ITEMS.md`). Treat code and Git history as the source of truth when a doc and the code disagree.


---

## Decisions

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

**Consequences:** A queue run now costs one extra full quality-suite invocation up front (the baseline capture) plus one per ta[REDACTED] (and one more per repair attempt) — meaningfully slower than v1's single gate pass, accepted as the cost of correctness. `.ai/runs/<run-id>/` now also contains `baseline.json` and one `task-<id>-quality.json` per attempted task (both committed; raw logs remain gitignored). See `docs/AI_OVERNIGHT_QUEUE.md`'s "Queue v2" section for the full walkthrough and `scripts/ai/qualityGates.ts` for the implementation.

## ADR-0013 — Claude CLI invocations run with `--dangerously-skip-permissions` (2026-08-02)
**Status:** Implemented, this build. Security-relevant — read in full before changing.

**Decision:** `scripts/ai/adapters/claude.ts` now invokes `claude -p --output-format json --dangerously-skip-permissions` for every queue task, instead of omitting the permission flag. `checkAvailability()` also verifies the installed CLI's `--help` output mentions a permission-bypass flag before reporting the agent available at all. As a second, independent layer, the adapter now parses the JSON response body and treats a non-empty `permission_denials` array or `is_error: true` as a real failure regardless of exit code — it no longer trusts exit code 0 alone.

**Why:** The queue's first real, live unattended run (2026-08-02, run id `2026-08-02T065749882Z`, evidence preserved under `.ai/runs/2026-08-02T065749882Z/`) invoked `claude -p` with no permission flag. Claude correctly tried to use its Write/Edit/Bash tools, correctly triggered the CLI's normal interactive per-tool-call approval flow, and — with no human present in an unattended session to approve anything — every approval sat pending until Claude gave up. It then exited 0 with a text explanation of what happened, having made zero file changes. The adapter's old logic checked only the exit code, saw 0, and reported success; `run-queue.ts`'s own auto-repair loop (ADR-0012) then burned a second, identical, equally-blocked invocation before a human had to read the raw log by hand to find the real cause. An unattended queue that silently does nothing while reporting success is worse than one that visibly fails — this is the single largest reliability gap `.ai/OPEN_ITEMS.md`'s "This build's own limitation" entry had flagged as unverified, and it's exactly what happened.

**Alternatives considered:** A narrower permission mode (e.g. `--permission-mode acceptEdits`, which typically only auto-accepts file-edit tool calls, not Bash). Rejected — the live incident's log shows Bash tool calls were *also* permission-denied (`git diff`/exploratory reads the agent attempted), so a mode that leaves Bash gated would still block on real, ordinary task work (running tests, reading multiple files via a single command, etc.). Do nothing and rely on a human to notice a silent no-op run each time. Rejected — directly defeats this task's own purpose ("enable reliable unattended overnight execution"); an unattended run with no one watching needs the failure to be *detected*, not just theoretically diagnosable after the fact from a raw log.

**Why this is an acceptable tradeoff, not a safety regression:** the thing that actually keeps an unattended queue run safe was never "a human approves each individual tool call" — that requirement is fundamentally incompatible with "unattended." The real safety boundary is, and remains, `scripts/ai/validate-queue.ts` (rejects any task or safety-block setting requesting merge, deploy, a production migration, a secret change, or production-schedule activation, cross-checked against the real code-level `ATTACH_DECLARATIVE_PRODUCTION_CRONS` gate) plus the simple fact that `run-queue.ts`'s own code never calls any of those operations — there is no flag to bypass because the capability isn't present in the orchestrator's code path at all. Skipping *interactive tool-call approval* removes a layer that could never function unattended in the first place; it does not remove the layer that actually enforces this repository's safety boundaries. A human still reviews and merges every PR the queue opens — nothing about this decision changes that.

**Consequences:** Every queue task's Claude invocation now runs with full tool access (no per-call approval prompts) inside this repository's checkout. This is scoped to `scripts/ai/adapters/claude.ts`'s own invocations only — it is not a global CLI setting, and it does not change how any human runs `claude` interactively. The fix's *failure-detection* path (permission-denial parsing) was proven correct against the real incident's actual response shape (see `unit-tests/ai-queue-claude-adapter.test.ts`). Its *success* path — a real `claude --dangerously-skip-permissions` invocation actually completing a real task end-to-end — has **not yet been verified**, because no `claude` binary was on `PATH` in the sandbox this fix was built in either. See `.ai/OPEN_ITEMS.md` and `docs/AI_OVERNIGHT_QUEUE.md`'s daytime dry run requirement before trusting this for a real unattended overnight run.

## ADR-0014 — Queue completion state must land on the task's own branch, plus GitHub-verified reconciliation as a backstop (2026-08-02)
**Status:** Implemented, this build.

**Decision:** `attemptTask()` (`scripts/ai/run-queue.ts`) now pushes a second, final commit — `finalizeCompletionState()` — that records the task's completed `QUEUE_STATUS.json` state onto its own branch, immediately after `gh pr create` succeeds. Separately, every `npm run ai:queue` invocation now reconciles any task still marked `"in_progress"` against real GitHub state (`scripts/ai/reconcile.ts`'s `reconcileQueueState`) before selecting a new task, using a `gh pr list --head <branch>` lookup as ground truth — never guessed, never fabricated. A run-lock file (`scripts/ai/reconcile.ts`'s `RUN_LOCK_PATH`, gitignored, local-machine-only) distinguishes a genuinely active queue process from a stale leftover, so reconciliation never interferes with a run that's actually still in progress.

**Why:** Task 001 (PR #101) completed successfully, but merged into `main` with `QUEUE_STATUS.json` still recording it as `"in_progress"` — which incorrectly blocked Task 002 (`depends_on: ["001"]`) from ever becoming eligible, since `selectNextEligibleTask` requires a dependency's status to be exactly `"completed"`. Root cause, found by direct git archaeology (`git show 4db450f -- .ai/queue/QUEUE_STATUS.json`): the old `attemptTask()` flipped the in-memory `stateEntry.status` to `"completed"` only *after* `git add -A && git commit` had already run — but that `git add -A` staged QUEUE_STATUS.json in whatever shape it was on disk at that point, which was still `"in_progress"` (the only prior `saveQueueState()` call had written the *start* of the task, not its end). The "completed" update then only ever existed in the local working tree's file, never in any commit that reached the branch — so the PR that got reviewed and merged permanently carried the lie.

**Alternatives considered:** Exclude `QUEUE_STATUS.json` from the task's own `git add -A` entirely (e.g. commit it separately from the start, outside the task's diff). Rejected — this would hide the queue's own bookkeeping from PR reviewers entirely, when the point of tracking it in git is exactly so a reviewer *can* see it; the real fix is correct ordering and content, not omission. Rely solely on the reconciliation backstop, without also fixing the ordering bug directly. Rejected as the *only* fix — reconciliation is valuable defense-in-depth (and the only thing that can heal a state that's *already* stale, like Task 001's), but leaving the ordering bug in place would mean every future successful task keeps producing a stale-then-silently-reconciled PR instead of a correct one from the start, and reconciliation depends on network access (`gh`) and a findable PR — it should not be load-bearing for the common case.

**Consequences:** A successful task now makes two pushes to its own branch instead of one (the real work, then the completion-state record) — a small, deliberate cost for correctness. If the second push fails (network blip, etc.), the task is still reported as succeeded (the PR is real) but the discrepancy is logged loudly in the task's own log, and the next `npm run ai:queue` invocation's automatic reconciliation pass will correct `QUEUE_STATUS.json` from verified GitHub state regardless. Reconciliation only ever moves a task **out of** `"in_progress"` — it never touches `pending`/`completed`/`failed`/`disabled`/`skipped` tasks, and every field it fills in (`pr`, `commit`, `completed_at`) comes directly from a real `gh pr list` response, never invented. A task with no PR evidence at all, or a PR closed without merging, is reconciled to `"failed"` with an explicit blocker — never silently resumed or guessed complete. `npm run ai:queue:status` and the new standalone `npm run ai:queue:reconcile` both surface this classification (`RUNNING` / `STALE, but PR merged` / `STALE, no PR found` / `STALE, PR open`) so a human can immediately tell which situation an `"in_progress"` task is actually in — previously indistinguishable. See `docs/AI_OVERNIGHT_QUEUE.md`'s "Completion-state reconciliation" section.

## ADR-0015 — Dependency-base resolution: verify a merged dependency's actual merge target, never require its branch to outlive the merge (2026-08-02)
**Status:** Implemented, this build.

**Decision:** `scripts/ai/reconcile.ts`'s new `resolveDependencyBase()` replaces the old `determineBranchBase()` with three explicit, verified cases instead of one unconditional assumption: (1) a dependency whose PR is confirmed **MERGED** (via a real `gh pr view` lookup, not the locally-recorded branch) resolves to the PR's actual merge target — normally `origin/main` — with the recorded merge commit's ancestry independently checked (`git merge-base --is-ancestor`) before it's trusted; a merged dependency's branch is never required to still exist. (2) A dependency whose PR is still **OPEN** uses its own branch (preferring the remote-tracking ref over a possibly-stale local one) for a genuinely stacked build, failing clearly if that branch can't be resolved either way. (3) A dependency marked `"completed"` with neither a verifiably merged PR nor a resolvable branch stops the run with an actionable error — **never** falls back to guessing `origin/main`. This resolution now runs as a cheap preflight step in `run-queue.ts`, before the expensive quality-gate baseline is captured, so a resolution failure surfaces in seconds, not minutes.

**Why:** Task 001 completed and merged as PR #101, and its local branch was (correctly) deleted afterward — completely normal PR hygiene. Task 002 (`depends_on: ["001"]`) then failed outright: `git checkout -b ai-queue/002-... ai-queue/001-market-radar-foundation` → `fatal: 'ai-queue/001-market-radar-foundation' is not a commit`. The old `determineBranchBase()` unconditionally reused a completed dependency's recorded branch name forever, regardless of whether it had since been merged and cleaned up — meaning the queue silently required every merged dependency branch to survive indefinitely, a guarantee no normal PR workflow (including this repository's own habit of deleting merged branches) makes. This wasn't a one-off mistake; it would recur on every single dependent task after every single merge, forever, until fixed.

**Alternatives considered:** Just check whether the dependency's recorded branch still resolves locally, and fall back to `origin/main` if not. Rejected — a silent fallback to `main` without verifying the dependency's work actually reached it would be worse than the crash it replaces: a dependent task could silently build on a base that doesn't contain its dependency's changes at all (e.g. if the PR was never actually merged, or merged into a different target branch), producing confusing, hard-to-diagnose downstream failures instead of a clear, immediate one. Trust the locally-recorded `commit` field directly for ancestry, without an independent `gh` lookup. Rejected — the whole point is verifying against GitHub as ground truth, since the local `QUEUE_STATUS.json` is exactly the thing that was proven unreliable by the completion-state bug (ADR-0014) two fixes earlier the same day; a local-only check would just re-trust the same class of data that already caused problems.

**Consequences:** Every stacked task with a dependency now costs one extra `gh pr view` lookup and a `git fetch origin --prune` before it can even start — a small, deliberate latency cost for correctness, and one that happens before (not after) the expensive baseline capture, so a resolution failure is now detected in seconds rather than after several minutes of wasted quality-gate work (this is exactly what happened in the real incident's own run: `.ai/runs/2026-08-02T151115309Z/` shows a full baseline captured before the cheap branch-checkout failure was ever discovered). The resolved ref and the reasoning behind it are recorded in the task's own log, `RUN_SUMMARY.md`, and `RUN_STATUS.json`'s new `base_resolution` field — never left implicit. Task 002's `QUEUE_STATUS.json` entry was reset from `"failed"` back to `"pending"` in this same PR (Task 001's own `"completed"` entry was untouched) — the failed run's evidence (`.ai/runs/2026-08-02T151115309Z/`) is preserved, not deleted, per this repository's log policy.


---

## Open Items

# Open Items

Verified 2026-08-02 against `origin/main` @ `952df6e` (merge of PR #102). Update this file whenever an item is resolved, deferred further, or a new one is discovered — do not let it silently go stale (see `ADR-0010`'s caveat in `DECISIONS.md` for why that matters).

## Active blockers

1. **Unpatched security gap (High)** — the public interactive-demo endpoint's rate limit key is derived from a spoofable `x-forwarded-for` header, allowing unbounded OpenAI cost abuse. Source: `docs/ARCHITECTURE_REVIEW_2026.md` §3.9. Explicitly noted there as **not fixed**. This should be prioritized ahead of new feature work touching that endpoint.
2. **Three competing "what should this business do" systems** — Marketing Recommendations, Tasks, and Marketing Plan, plus Assisted Pilot as a fourth adjacent layer. Called "the single biggest prerequisite decision for Magic" in `docs/ARCHITECTURE_REVIEW_2026.md`. One narrow resolution exists (`/dashboard` → `lib/head-of-marketing`, ADR-0007 sub-decision) but the underlying multi-system question is not resolved.
3. **Production launch blockers** (`docs/PRODUCTION_READINESS.md`, 2026-07-14): Supabase service-role key rotation unconfirmed; assisted-vs-scheduled pilot mode undecided; production environment variables not yet provisioned. `ATTACH_DECLARATIVE_PRODUCTION_CRONS` must stay `false` until a fourth, separate, explicit ops sign-off — this is a gate, not a blocker to resolve.
4. **Opportunity/Decision Engine has no trigger anywhere in the product** (`docs/RELEASE_CANDIDATE_END_TO_END_AUDIT.md`) — `/dashboard/marketing-recommendations` stays empty without manual admin invocation.

## Deferred work

- Approve/edit/comment/correct feedback loop that converts Assumed → Known insights on the Snapshot (Wave I, "still open" per `docs/project-magic/IMPLEMENTATION_ROADMAP.md`).
- A durable, cross-24h-window store for the 7 snapshot-confirmation fields without an existing column (`docs/BUSINESS_DISCOVERY_CONTINUATION.md`, Recommended Phase 2B2).
- Wave III: Market Radar and Seasonal Intelligence (scoped, not started).
- Wave IV: Business Pulse + Autopilot (scoped, explicitly blocked on Waves I–III producing real signal first).
- P2/P3 items from `docs/RC1_AUTHENTICATED_PILOT_VALIDATION.md`: Approved/Published badge color parity, an unreachable legacy `/dashboard/[section]` route, SMS Approval Preview remains a mockup.

## Known risks

- `GET /api/publishing` executes due jobs as a live side effect of a page load (`docs/RELEASE_CANDIDATE_END_TO_END_AUDIT.md`) — despite PR #23's "atomic claim + no page-load execution" fix, this specific route was found still doing it at RC audit time. Needs re-verification, not assumed-fixed.
- Approval Center UI copy overstates automation ("From AI draft to published — automatically") when the actual flow requires human approval.
- GBP Disconnect button is a no-op (does nothing when clicked).
- "Regenerate" on a recommendation silently severs its link to the original recommendation.
- Analytics → opportunities feedback loop is dead in production (recorded in the RC audit; current state not re-verified in this build).
- `lib/google-business` vs. `lib/google-business-profile` naming/execution split is real friction, not yet cleaned up (ADR-0006).

## Unresolved decisions

- Whether `docs/project-magic/IMPLEMENTATION_ROADMAP.md` (2.0 Wave I–IV) is stale: it does not mention Business Knowledge Graph, Business Learning Engine, Business Brain Inspector, Business Connections, Opportunity Detection Engine, or Head of Marketing Orchestrator, all of which are shipped (verified via `**Status:** Shipped` lines in their own `docs/project-magic/*.md` files and via `git log`/`gh pr list`). Recommend a human decide whether to update that roadmap doc to reflect actual delivery, or whether these features belong to an untracked third initiative.
- `origin/publishing-concurrency-verification` (commit `4e4a3de`, 2026-07-13, "Add real-DB publishing claim concurrency verification script") — unmerged, no associated PR found in `gh pr list --state all`. Unclear whether this was intentionally left as a manual one-off tool or is abandoned work-in-progress. Do not delete without human confirmation.
- `origin/project-magic/strategic-marketing-calendar` (commit `0631bfb`, 2026-07-19) — unmerged, but its commit message ("Fix calendar dedupe/nav/a11y bugs found in PR #59 review") is identical to PR #60's title, whose head branch (`project-magic/strategic-marketing-calendar-fixes`) *was* merged. Likely a stale duplicate branch pushed to the wrong ref and safe to delete — but confirm with a human before deleting any branch, per this repo's own safety posture.

## Pre-launch requirements

See `ROADMAP.md`'s "Pre-launch requirements" section and `docs/LAUNCH_CHECKLIST.md` in full before any production cutover discussion. Non-negotiable constant across all of them: `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains `false`.

## Pre-existing type-check debt (discovered by this build, not caused by it)

This build added the first `typecheck` script (`tsc --noEmit`) this repository has ever had — none existed before, since `test:unit` runs `unit-tests/*.test.ts` through Node's type-*stripping* (which discards type annotations without checking them), not real type-checking. Running it for the first time surfaces **18 pre-existing type errors across 10 unrelated unit-test files**, none touched by this build: `ai-marketing-profile-errors.test.ts`, `campaign-intelligence-engine.test.ts`, `decision-intelligence-core.test.ts`, `decision-intelligence-persistence.test.ts`, `executive-briefing-engine.test.ts`, `marketing-decisions-ui.test.ts`, `project-magic-proactive-head-of-marketing.test.ts`, `recommendation-outcomes.test.ts`, `recommendation-pipeline-orchestrator.test.ts`, `recommendation-presentation-service.test.ts`. All of `scripts/ai/*` and the new `unit-tests/ai-queue-*.test.ts` files typecheck cleanly. Recommend a human triage and fix these in a dedicated follow-up — fixing 10 unrelated feature test files was out of scope for this build.

**Update (2026-08-01, Queue v2):** this debt no longer blocks the AI overnight queue — `scripts/ai/qualityGates.ts`'s baseline-aware comparison treats an unchanged pre-existing count as a PASS (see `DECISIONS.md` ADR-0012). It's still real debt worth fixing eventually; it's just no longer conflated with "did this queue task introduce a regression."

## Known limitation of Queue v2's identity-aware test comparison (2026-08-01)

`compareQualitySnapshots` (`scripts/ai/qualityGates.ts`) distinguishes a historical unit-test/Playwright failure from a new one by matching failing-test **name** between baseline and current. If a task legitimately renames or restructures a test (even without changing its underlying behavior), the comparator has no way to know the "new-named" failure is the same one — it would be classified as a new regression and could trigger an unnecessary auto-repair attempt or task failure. This is a known, accepted trade-off (matching by name is far more correct than matching by raw count alone — see ADR-0012's "alternatives considered") rather than a bug; a human resolving such a failure should recognize this pattern (a renamed test showing up as "new") rather than assume the repair loop's diagnosis is always literal.

## Live dry-run incident (2026-08-02) and its fix — read before trusting an overnight run

The queue's first real, live, unattended run (run id `2026-08-02T065749882Z`) actually executed — meaning a `claude` binary genuinely was available in whatever environment ran it, unlike every sandbox this project's own build/fix sessions have had access to. It surfaced the exact risk `OPEN_ITEMS.md` had previously only flagged as *unverified*: `scripts/ai/adapters/claude.ts` invoked `claude -p` with no permission-bypass flag, every Write/Edit/Bash tool call silently blocked on an approval no one was present to give, and Claude exited 0 having done zero work. The adapter reported success anyway (it only checked exit code). The queue's auto-repair loop (ADR-0012) then burned a second, identically-blocked invocation before self-diagnosing the true cause in its own response text (evidence preserved: `.ai/runs/2026-08-02T065749882Z/RUN_SUMMARY.md`, `RUN_STATUS.json`, `baseline.json`, `task-001-quality.json`; the raw `task-001.log` containing the full diagnostic transcript is local-only per this repo's log policy, not committed).

**Fixed this session** (see `DECISIONS.md` ADR-0013 for full reasoning): the adapter now passes `--dangerously-skip-permissions` and independently inspects the JSON response body (`permission_denials`, `is_error`) rather than trusting exit code 0 alone. Also hardened for reliability more broadly: every subprocess call across `run-queue.ts`/`qualityGates.ts` now has an explicit timeout (`scripts/ai/subprocess.ts`), `QUEUE_STATUS.json` writes are now atomic, an unexpected crash mid-task still produces a normal `RUN_SUMMARY.md`/`RUN_STATUS.json`, and the whole run now has a wall-clock ceiling (`queue.max_run_duration_minutes`, default 360 minutes).

**Still true after this fix, and still the main reason not to trust a fully-unattended *overnight* run yet:** the fix's *failure-detection* path was proven correct against the real incident's actual response shape (unit-tested directly). The fix's *success* path — a real `claude --dangerously-skip-permissions` invocation actually completing a task end-to-end — has now been observed once: PR #100 (the fix itself) merged to `main` at `5d60a07`, and this same environment then ran Task 001 (`ai-queue/001-market-radar-foundation`, 2026-08-02) as an attended daytime dry run, producing real file changes (`supabase/migrations/037_market_radar.sql`, `lib/market-radar/`, `unit-tests/market-radar-foundation.test.ts`) and passing quality gates — not another silent no-op. This is one successful data point on one task, attended, not yet a fully unattended multi-task overnight run; Task 002 and a genuinely unattended (no human watching) run are still open verification steps. **Drift note:** the `.ai/` snapshot this session started from still described PR #100 as unmerged/open — it was already merged; treat this as confirmation that `.ai/` can drift even within the same day and must be checked against `git log`, per `AGENTS.md` rule 3.

## Queue completion-state bug (2026-08-02) and its fix — Task 001's real, previously-undetected failure mode

Task 001 (above) genuinely succeeded, but PR #101 merged into `main` with `.ai/queue/QUEUE_STATUS.json` still recording it as `"in_progress"` — `current_task: "001"`, `resume_eligible: false`. This silently blocked Task 002 (`depends_on: ["001"]`) from ever becoming eligible, since `selectNextEligibleTask` requires a dependency's status to be exactly `"completed"`.

**Root cause** (found by direct git archaeology, not speculation — `git show 4db450f -- .ai/queue/QUEUE_STATUS.json`): `attemptTask()` in `scripts/ai/run-queue.ts` used to flip the in-memory task status to `"completed"` only *after* `git add -A && git commit` had already run for the task's real deliverable work — but `git add -A` staged `QUEUE_STATUS.json` exactly as it stood on disk at that moment, which was still `"in_progress"` (the only prior `saveQueueState()` call in the function recorded the task *starting*, not finishing). The "completed" update then only ever existed in the local working tree's file, never in any commit that reached the branch — so the PR a human reviewed and merged permanently carried the stale snapshot into `main`'s history.

**Fixed this session** (see `DECISIONS.md` ADR-0014 for full reasoning): (1) `attemptTask()` now pushes a second, final commit — `finalizeCompletionState()` — recording the true completed state onto the task's own branch immediately after `gh pr create` succeeds, so the PR's own diff is correct from the start; (2) every `npm run ai:queue` invocation now reconciles any stale `"in_progress"` task against real GitHub state (`scripts/ai/reconcile.ts`) before selecting a new task — using only verified `gh pr list` data, never fabricated — as a defense-in-depth backstop that self-heals even if fix (1) is ever bypassed (a hand-edited state file, a manually-completed task, a future bug); (3) `npm run ai:queue:status` now distinguishes an actively-running task (via a local run-lock file + live PID check) from a stale-with-merged-PR task from a stale-with-no-evidence (crashed) task — previously all three rendered identically as `[in_progress]`. A new standalone `npm run ai:queue:reconcile` command applies the same fix without also starting a new task run.

**Task 001's actual `QUEUE_STATUS.json` entry was corrected by hand** in this same PR, using only verified data: `branch: ai-queue/001-market-radar-foundation`, `commit: 79f23901a431da39b41dd0f226976de40f4bcd76` (the real tip commit of the merged PR #101 branch — confirmed via `git cat-file -t`), `pr: https://github.com/ajnsolutions/ajnmarketing/pull/101`, `completed_at: 2026-08-02T13:53:18Z` (the PR's own `createdAt`, matching the field's existing semantic meaning elsewhere in this codebase — "when the task's own work finished and the PR was opened," not when a human later merged it), `tests` summarized from PR #101's own merged `HANDOFF.md` (1745/1745 unit, lint clean, typecheck unchanged, build succeeded, Playwright not run — persistence/types-only scope). Nothing here was guessed — every value is independently verifiable via `git`/`gh`. **Task 002 is now correctly eligible** (verified: `selectNextEligibleTask` returns it against the corrected state).

**Not yet verified:** the new `finalizeCompletionState()` ordering fix has real end-to-end test coverage against an actual git repository (`unit-tests/ai-queue-completion-state.test.ts`), but — same limitation as ADR-0013 — has not been exercised by a real unattended `npm run ai:queue` run, since no `claude` binary was available in this fix's own build sandbox either. The next real queue run (starting with Task 002) is the first live test of this fix.

## Dependency-base resolution bug (2026-08-02, same day) — the predicted "next real queue run" test, and what it found

The previous entry's own closing line ("the next real queue run — starting with Task 002 — is the first live test of this fix") turned out to be exactly right, and that live test found a second, real bug: `npm run ai:queue` correctly selected Task 002, but attempting to branch it failed outright:

```
git checkout -b ai-queue/002-market-radar-view ai-queue/001-market-radar-foundation
fatal: 'ai-queue/001-market-radar-foundation' is not a commit and a branch 'ai-queue/002-market-radar-view' cannot be created from it
```

**Root cause:** the old `determineBranchBase()` (`scripts/ai/run-queue.ts`) unconditionally reused a completed dependency's *recorded branch name* as the next task's git base, forever — with no check for whether that branch still existed. Task 001's local branch had been (correctly) deleted after PR #101 merged, which is completely normal PR hygiene, not an error condition. The queue was silently requiring every merged dependency branch to survive indefinitely — a guarantee this repository's own workflow (and most others) doesn't make.

**Fixed this session** (see `DECISIONS.md` ADR-0015): `scripts/ai/reconcile.ts`'s new `resolveDependencyBase()` replaces the single unconditional assumption with three explicit, GitHub-verified cases — merged (use the real, verified merge target, normally `origin/main`, with the merge commit's ancestry independently checked, never requiring the branch to still exist), open (use the dependency's own branch, preferring the remote-tracking ref), or unverifiable (stop with an actionable error, never guess `origin/main`). This resolution now runs as a cheap preflight step in `run-queue.ts`, before the expensive quality-gate baseline is captured — directly motivated by this real run's own evidence (`.ai/runs/2026-08-02T151115309Z/`), which shows a full baseline (TypeScript/ESLint/unit/Playwright/build, ~2 minutes) was captured before the cheap branch-checkout failure was ever discovered.

**Task 002's `QUEUE_STATUS.json` entry was reset from `"failed"` back to `"pending"` in this same PR** (all fields cleared: branch/commit/pr/started_at/tests/blocker all `null`, matching a task that has never run). Task 001's own `"completed"` entry was left completely untouched. The failed run's evidence (`.ai/runs/2026-08-02T151115309Z/RUN_SUMMARY.md`, `RUN_STATUS.json`, `baseline.json`, `task-002.log`) is preserved, not deleted — `RUN_SUMMARY.md`/`RUN_STATUS.json`/`baseline.json` are committed in this PR as evidence; the raw `task-002.log` remains local-only per this repo's log policy. Verified live against the real repository (not just unit tests): `resolveDependencyBase()`, run against this repo's actual `gh`/`git` state, independently resolves Task 002's base to `origin/main` with PR #101's real merge commit confirmed as an ancestor — reproducing the fix's intended behavior exactly, not just its unit-test fakes.

**Not yet verified:** same standing limitation as every fix in this file today — the ordering/preflight change has real end-to-end test coverage (including two tests against an actual git repository, not mocks — `unit-tests/ai-queue-base-resolution.test.ts`), and was independently confirmed against this repo's real, live GitHub state, but has not yet been exercised by an actual `npm run ai:queue` invocation completing Task 002 end-to-end (no `claude` binary was available in this fix's own build sandbox either). The next real queue run, in an environment with a working `claude` CLI, is the first live test of this specific fix.


---

## Handoff

# Handoff

This file is the most recent agent-to-agent handoff. **Overwrite it wholesale on your next task** — it is a snapshot of "what the last agent did and what the next one should know," not a growing log. If you need history, use Git (`git log -- .ai/HANDOFF.md`).

## Branch

`fix/queue-merged-dependency-base-resolution` (based on `origin/main` @ `952df6e`, the merge of PR #102)

## Task status

**Complete.** This is the direct sequel to PR #102 (completion-state reconciliation): once that fix landed and Task 001's `QUEUE_STATUS.json` entry was corrected, `npm run ai:queue` correctly selected Task 002 — and immediately failed trying to branch it, because Task 001's local branch had been (correctly) deleted after PR #101 merged. This branch fixes that.

## Root cause

`git checkout -b ai-queue/002-market-radar-view ai-queue/001-market-radar-foundation` failed: `fatal: 'ai-queue/001-market-radar-foundation' is not a commit`. The old `determineBranchBase()` (`scripts/ai/run-queue.ts`) unconditionally reused a completed dependency's *recorded branch name* as the next task's git base, forever, with no check for whether that branch still existed. It required every merged dependency branch to survive indefinitely — a guarantee no normal PR workflow (including this repository's own habit of deleting merged branches) makes. This wasn't a one-off; it would have recurred on every dependent task after every merge.

## What was built

1. **`scripts/ai/reconcile.ts`**: new `resolveDependencyBase()` — replaces the single unconditional assumption with three explicit, GitHub-verified cases:
   - **Merged** (verified via a real `gh pr view` lookup, not the locally-recorded branch): resolves to the PR's actual merge target (normally `origin/main`), with the recorded merge commit's ancestry independently checked (`git merge-base --is-ancestor`) before it's trusted. A merged dependency's branch is never required to still exist.
   - **Open** (unmerged): uses the dependency's own branch, preferring the remote-tracking ref (`origin/<branch>`) over a possibly-stale local one. Fails clearly if that branch can't be resolved either way.
   - **Unverifiable** (neither a merged PR nor a resolvable branch for a `"completed"` dependency): stops with an actionable error. Never falls back to guessing `origin/main`.
   - Also added: `lookupPrByUrl()` (exact PR lookup by number, more reliable than a branch-name search when the branch itself may be gone), `resolveGitRef()`/`isAncestorRef()` (real git ref/ancestry checks), extended `PrLookupResult` with `baseRefName`.
2. **`scripts/ai/run-queue.ts`**: retired `determineBranchBase()` entirely. `main()`'s loop now does a cheap preflight per selected task — `git fetch origin --prune` then `resolveDependencyBase()` — **before** the expensive quality-gate baseline is captured (moved from an unconditional pre-loop capture to a lazy, first-successful-preflight capture). A resolution failure is now recorded via a new `failPreflight()` helper (mirrors `attemptTask()`'s own in_progress→failed bookkeeping) without ever touching the baseline or invoking the agent. `attemptTask()` now receives the already-resolved `baseResolution` instead of computing its own; the resolved ref and reasoning are recorded in the task's own log (prepended before any other content), `RUN_SUMMARY.md` (a `Base:` line per task), and `RUN_STATUS.json` (a `base_resolution` field per task) — every `fail()` call site and the success path all carry it through.
3. **`.ai/queue/QUEUE_STATUS.json`**: Task 002 reset from `"failed"` back to `"pending"` (branch/commit/pr/started_at/tests/blocker all `null`) — never fabricated as completed. Task 001's own `"completed"` entry was left completely untouched. `resume_eligible` corrected to `true`. **Verified: `selectNextEligibleTask` returns Task 002 against this state**, and — more importantly — `resolveDependencyBase()` run against this repo's real, live `gh`/`git` state independently resolves Task 002's base to `origin/main`, with PR #101's real merge commit confirmed as a real ancestor (not a unit-test fake).
4. Preserved the failed run's evidence: `.ai/runs/2026-08-02T151115309Z/{RUN_SUMMARY.md,RUN_STATUS.json,baseline.json}` committed (the raw `task-002.log` stays local-only per this repo's log policy). That evidence is itself part of what motivated the preflight-before-baseline ordering — it shows a full ~2-minute baseline was captured before the cheap branch-checkout failure was ever discovered.
5. Docs: `docs/AI_OVERNIGHT_QUEUE.md` gained a "Dependency-base resolution" section and an updated daytime-dry-run step 4; `docs/AI_QUEUE_TROUBLESHOOTING.md` gained an "'... is not a commit' when a task tries to branch" section. `.ai/DECISIONS.md` gained ADR-0015. `.ai/OPEN_ITEMS.md`, `.ai/CURRENT_STATUS.md`, `.ai/STATUS.json` updated with the incident and fix.

## Tests

- **`unit-tests/ai-queue-base-resolution.test.ts`** (new, 14 tests) — every required scenario explicitly: a merged dependency with a deleted local *and* remote branch resolves to `origin/main` (the exact real incident, reproduced); a merged dependency's commit must be verified as an ancestor of the chosen base (including two **real-git** tests — one proving `isAncestorRef`/`resolveGitRef` against an actual merge commit vs. an orphan/unrelated commit, one proving an actual `git checkout -b` from the resolved ref lands on the right commit with the dependency's real files present); an open dependency PR uses its own branch for a stacked build; a missing/unresolvable branch for an open PR fails clearly; a stale local dependency branch that still happens to exist does **not** override verified merged-PR state; Task 002 becomes eligible once Task 001 is correctly recorded completed; plus the trivial no-dependency and `independent`-strategy cases.
- `unit-tests/ai-queue-run.test.ts`: the 3 obsolete `determineBranchBase` tests removed (one of them literally asserted the buggy behavior — a bare, un-prefixed branch name as the base); replaced by the new file above.
- `unit-tests/ai-queue-reconcile.test.ts` / `ai-queue-status.test.ts`: fixture helpers updated for `PrLookupResult`'s new `baseRefName` field — no behavioral changes, all still passing.
- **A real, verified end-to-end check beyond unit tests**: `resolveDependencyBase()` was run directly against this repository's actual `.ai/queue/RUN_QUEUE.yaml` and (corrected) `QUEUE_STATUS.json`, using the real `lookupPrByUrl`/`resolveGitRef`/`isAncestorRef` (real `gh`/`git` calls, not fakes) — confirmed it resolves Task 002's base to `origin/main`, verified via PR #101's actual merge commit.
- **Full unit suite** (`npm run test:unit`): **1787/1787 passing.**
- **Lint** (`npm run lint`): clean — 0 errors, 7 pre-existing warnings in files this branch never touched.
- **Typecheck** (`npm run typecheck`): 18 pre-existing errors, identical set to before this branch — none touched by it.
- **Build** (`npm run build`): succeeds.
- **Playwright** (`npx playwright test`): **302/302 passing**, run serially (`--workers=1`) for a clean count. A first `--workers=2` run showed 17 failures, all clustered in `tests/first-impression.spec.ts` (a file this branch's changes cannot affect — this branch touches only `scripts/ai/`, `unit-tests/`, `.ai/`, and docs); re-running that file alone (`--workers=1`) passed 22/22, and a full serial re-run passed 302/302, confirming parallel-worker resource contention in this sandbox, not a regression.
- **`npm run ai:queue:validate`**: valid.

## PR

Opened against `main` from this branch — see this repository's PR list for the number/URL (`gh pr list --head fix/queue-merged-dependency-base-resolution`). Not merged. Not deployed.

## Blockers

None blocking this task's own completion. One carried-forward limitation, consistent with every fix in this file today:

**The preflight/resolution change has real end-to-end test coverage (including two tests against an actual git repository) and was independently verified against this repo's real, live GitHub/git state — but has not yet been exercised by an actual `npm run ai:queue` invocation completing Task 002 end-to-end.** No `claude` binary was available in this fix's own build sandbox either (same standing limitation as every queue fix so far).

Unrelated, pre-existing, not touched by this branch: the product-track blockers in `OPEN_ITEMS.md` (spoofable rate-limit key, three-competing-decision-systems question, production launch blockers, missing recommendation-engine trigger) and the pre-existing TypeScript debt (18 errors, unchanged).

## Recommended next step

1. Review this PR (root cause, `resolveDependencyBase()`'s three cases, the corrected `QUEUE_STATUS.json`, the tests — especially the two real-git ones) before doing anything else.
2. Once merged, in an environment where `claude --version`/`claude --help` (mentioning `--dangerously-skip-permissions`) actually work:
   ```bash
   npm run ai:queue:validate
   git checkout main && git pull
   npm run ai:queue:status   # confirm: 001 completed, 002 pending, resume_eligible: true
   npm run ai:queue          # attended, in the foreground — runs Task 002
   ```
3. Watch for: the preflight log line (`Task 002: base resolved to origin/main — ...`) appearing *before* "Capturing repository quality baseline," confirming the ordering fix; a real PR opening for Task 002; and — per the completion-state fix (ADR-0014) — `QUEUE_STATUS.json` on `002`'s own branch correctly showing `"completed"` before the run ends.
4. If a dependency-base resolution failure is ever seen again, `npm run ai:queue:status`'s blocker text and `RUN_SUMMARY.md`'s new `Base:` line will now state exactly which of the three cases failed and why — see `docs/AI_QUEUE_TROUBLESHOOTING.md`.
5. Separately, unrelated to this queue-tooling fix: the product-track recommendations in `OPEN_ITEMS.md` remain the highest-priority carried-forward items.


---

## Machine-readable status (STATUS.json)

```json
{
  "project": "AJN Marketing (Project Magic)",
  "repository": "ajnsolutions/ajnmarketing",
  "current_phase": "Project Magic 2.0 (AI Growth Engine) — Wave I and Wave II shipped; Wave III partially shipped (Goals & Strategy, Customer Voice); several Business Brain intelligence features shipped outside the originally-documented wave sequence",
  "active_initiative": "Dependency-base resolution fix, branch fix/queue-merged-dependency-base-resolution, based on origin/main @ 952df6e (merge of PR #102, the completion-state fix). Direct sequel: once Task 001's QUEUE_STATUS.json was corrected, npm run ai:queue correctly selected Task 002 -- then failed branching it, because Task 001's local branch was (correctly) deleted after PR #101 merged: git checkout -b ai-queue/002-... ai-queue/001-market-radar-foundation -> fatal: 'ai-queue/001-market-radar-foundation' is not a commit. Root cause: the old determineBranchBase() unconditionally reused a completed dependency's recorded branch name forever, with no check whether it still existed. Fixed: scripts/ai/reconcile.ts's new resolveDependencyBase() resolves a merged dependency to its real, GitHub-verified merge target (normally origin/main), independently verifying merge-commit ancestry before trusting it -- a merged dependency's branch is never required to still exist; an open dependency still uses its own branch; an unverifiable dependency stops with an actionable error, never guesses main. Runs as a cheap preflight before the expensive quality-gate baseline capture. Task 002's QUEUE_STATUS.json entry reset from failed back to pending (Task 001's completed entry untouched) -- Task 002 confirmed eligible, and resolveDependencyBase() independently verified against this repo's real gh/git state. See DECISIONS.md ADR-0015.",
  "status": "active",
  "last_verified_at": "2026-08-02T00:00:00Z",
  "last_verified_branch": "fix/queue-merged-dependency-base-resolution",
  "last_verified_commit": "952df6e",
  "last_completed_task": "PR #102 -- Fix stale queue completion state, add GitHub-verified reconciliation (merged into main); this branch fixes the dependency-base resolution bug that PR #102's own first real queue run (Task 002) surfaced immediately afterward",
  "current_blockers": [
    "Unpatched High-severity security finding (ARCHITECTURE_REVIEW_2026.md §3.9): the public interactive-demo endpoint's rate limit key is derived from a spoofable x-forwarded-for header, allowing unbounded OpenAI cost abuse.",
    "Three competing 'what should this business do' systems (Marketing Recommendations, Tasks, Marketing Plan) plus Assisted Pilot as a fourth adjacent layer — called out in ARCHITECTURE_REVIEW_2026.md as the single biggest prerequisite decision before further Magic work, not yet resolved.",
    "Production launch blockers per PRODUCTION_READINESS.md: (1) Supabase service-role key rotation unconfirmed, (2) assisted-vs-scheduled pilot mode decision not made, (3) production environment variables not yet provisioned, (4) ATTACH_DECLARATIVE_PRODUCTION_CRONS must stay false pending explicit ops sign-off.",
    "Opportunity Detection and Decision Engine have no trigger anywhere in the product (RELEASE_CANDIDATE_END_TO_END_AUDIT.md) — /dashboard/marketing-recommendations stays empty without manual invocation."
  ],
  "open_items": [
    "docs/project-magic/IMPLEMENTATION_ROADMAP.md (2.0 Wave I-IV) does not mention several shipped features (Business Knowledge Graph, Business Learning Engine, Business Brain Inspector, Business Connections, Opportunity Detection Engine, Head of Marketing Orchestrator) — recommend a human reconcile whether this roadmap doc is stale.",
    "origin/publishing-concurrency-verification (commit 4e4a3de, 2026-07-13) is an unmerged branch with a real-DB concurrency verification script and no associated PR — status unclear.",
    "origin/project-magic/strategic-marketing-calendar has an unmerged commit (0631bfb) that appears to duplicate content already merged via PR #60 (project-magic/strategic-marketing-calendar-fixes) — likely a stale leftover branch, safe-to-delete candidate pending human confirmation.",
    "GET /api/publishing executes due jobs as a live side effect of a page load (RELEASE_CANDIDATE_END_TO_END_AUDIT.md) — architectural smell, not yet fixed.",
    "Approval Center UI copy falsely claims full automation ('From AI draft to published — automatically'); GBP Disconnect button is a no-op; Regenerate silently severs the recommendation link; analytics-to-opportunities feedback loop is dead in production (all from RELEASE_CANDIDATE_END_TO_END_AUDIT.md).",
    "The AI queue's Claude adapter fix (permission-bypass flag + response-body inspection, PR #100) has now completed one real task (Task 001, PR #101) end-to-end, but only as an attended single-task run, not a genuinely unattended multi-task overnight run. See OPEN_ITEMS.md's 'Live dry-run incident' entry for the updated status.",
    "The dependency-base resolution fix (this branch) has real end-to-end test coverage including two tests against an actual git repository, and was independently verified against this repo's real, live gh/git state resolving Task 002's actual base correctly -- but has not yet been exercised by a real npm run ai:queue invocation completing Task 002 end-to-end. See OPEN_ITEMS.md's 'Dependency-base resolution bug' entry."
  ],
  "recommended_next_task": "Task 002 (Market Radar owner-facing tracked competitors & benchmarks view, depends on Task 001) is ready to run once this PR is reviewed and merged -- run npm run ai:queue:validate then npm run ai:queue (attended, in an environment with a working claude CLI). Separately and unrelated: resolve the three-competing-decision-systems architecture question (ARCHITECTURE_REVIEW_2026.md) before adding further recommendation/decision surface area, and patch the spoofable rate-limit key (§3.9) since it is an active, unbounded-cost-abuse security gap.",
  "production_deploy_allowed": false,
  "automatic_merge_allowed": false,
  "automatic_migrations_allowed": false,
  "production_schedules_enabled": false
}
```

---

## Latest overnight queue run

# Run 2026-08-02T151115309Z

Started: 2026-08-02T15:11:15.310Z
Finished: 2026-08-02T15:13:30.481Z
Stop reason: task 002 failed: could not create branch

## Repository baseline (captured before this run's first task)

Baseline: TypeScript 18 error(s), ESLint 0 error(s)/7 warning(s), unit tests 0 failure(s), Playwright 0 failure(s), build succeeded.

## Tasks attempted this run

- **002 — Market Radar: owner-facing tracked competitors & benchmarks view**: failed — blocker: git checkout -b ai-queue/002-market-radar-view ai-queue/001-market-radar-foundation failed:
fatal: 'ai-queue/001-market-radar-foundation' is not a commit and a branch 'ai-queue/002-market-radar-view' cannot be created from it




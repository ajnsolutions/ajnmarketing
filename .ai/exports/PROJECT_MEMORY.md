# Project Memory — AJN Marketing

Generated 2026-08-02T08:15:04.036Z by `scripts/ai/export-memory.ts`. This file combines every `.ai/` memory doc into one upload-friendly document for AI tools without direct repository access. It is a snapshot — for anything time-sensitive, prefer reading the repository directly if you can.


---

## Current Status

# Current Status

> Machine-readable twin: [`STATUS.json`](./STATUS.json). If the two ever disagree, `STATUS.json` is stale and needs a fix — this file and that one must be updated together.

**Project name:** AJN Marketing ("Project Magic")

**Current product mission:** Make AJN Marketing feel like a small business hired the best Head of Marketing it could ever have — not like it bought another marketing tool. The product is evolving from an AI marketing platform into a broader "AI Growth Engine" for small businesses (Project Magic 2.0), with marketing as the first application of that intelligence.

**Current development phase:** Project Magic 2.0 (AI Growth Engine). Of the four planned waves in `docs/project-magic/IMPLEMENTATION_ROADMAP.md`:
- **Wave I** (Free Marketing Snapshot + Business Brain foundation) — shipped: public pre-auth Snapshot, secure SSRF-hardened backend contract, DNS-pinned continuation bridge, First Impression customer-facing UI, internal-alpha intelligence pass.
- **Wave II** (Connector Framework + Smart Uploads) — shipped: Business Connections foundation, Smart Uploads (PDF/DOCX/TXT/MD), Google Search Console as the first live Website & Search connector.
- **Wave III** (Customer Voice, Market Radar, Seasonal Intelligence) — partially shipped: Goals & Strategy shipped, Customer Voice Phase 1 + 2 shipped (Google Reviews + Website Testimonials providers). Market Radar and Seasonal Intelligence are **not yet started**.
- **Wave IV** (Business Pulse + Autopilot) — not started as originally scoped, but several features that read like an organic continuation of it have shipped outside the formal wave numbering (see below).

The 1.0 roadmap (`docs/IMPLEMENTATION_ROADMAP.md`, Phases A–H) runs in parallel and still governs marketing-specific delivery: Phases A–C are largely shipped; **Phases D, E, F, G, H remain scope-only, not shipped.**

**Major completed systems:**
- Authenticated marketing loop: Marketing Director orchestration, recommendations, campaigns, experiments, decision intelligence, strategic calendar, marketing memory (4-layer model), guided onboarding, Assisted Pilot — collectively validated through Release Candidate 1.
- Business Brain intelligence layer (shipped, but **not named in the 2.0 wave roadmap document** — see Open Items): Business Knowledge Graph, Business Learning Engine, Business Brain Inspector, External Intelligence foundation, Business Connections, Opportunity Detection Engine.
- Growth Advisor experience (replaces the previous `/dashboard` composition) and Autonomous Growth Planner (recommend-only, no auto-execution).
- Head of Marketing Orchestrator — the newest merge (PR #96): a daily Executive Review composing Weekly Growth Plan + Executive Brief + Opportunity Engine into one view, at `/dashboard/executive-review` (customer) and `/dashboard/admin/executive-overview` (admin).
- Publishing pipeline with atomic job claiming (background_jobs table + Trigger.dev, two systems not yet merged — see `DECISIONS.md`).

**Current active initiative:** AI overnight queue reliability hardening (branch `harden-ai-queue-unattended-execution`). The queue's first real, *live, unattended* run (2026-08-02, run id `2026-08-02T065749882Z`, evidence preserved under `.ai/runs/2026-08-02T065749882Z/`) surfaced a real bug: `scripts/ai/adapters/claude.ts` invoked `claude -p` with no permission-bypass flag, so every Write/Edit/Bash tool call silently blocked on an approval no one was present to give — Claude exited 0 having done zero work, and the adapter reported success anyway (it only checked exit code). Fixed this session: the adapter now passes `--dangerously-skip-permissions` and independently inspects the JSON response body (`permission_denials`, `is_error`) instead of trusting exit code alone (see `DECISIONS.md` ADR-0013 for the full safety reasoning). Also hardened more broadly for reliability: every subprocess call now has an explicit timeout (`scripts/ai/subprocess.ts`), `QUEUE_STATUS.json` writes are atomic, a crash mid-task still produces a normal run summary, and the whole run now has a wall-clock ceiling (`queue.max_run_duration_minutes`, default 360 min). **The fix's success path is still unverified** — no `claude` binary was on `PATH` in this fix's own build sandbox either; see `OPEN_ITEMS.md`'s "Live dry-run incident" entry before trusting an unattended overnight run. Both Market Radar tasks in `RUN_QUEUE.yaml` (`001` persistence foundation, `002` owner-facing view, depends on `001`) are unaffected in content — still `status: pending`, ready to retry once the fix is verified. Otherwise, main is caught up through PR #99 with no other open product-track PR or unmerged product branch. See `recommended_next_task` below and `OPEN_ITEMS.md` for what a human should prioritize next on the product/intelligence track.

**Known safety gates (must not be silently changed by any agent):**
- `ATTACH_DECLARATIVE_PRODUCTION_CRONS` — the Trigger.dev production-schedule activation gate. **Must remain `false`.** Canonical source: `lib/trigger/scheduleActivation.ts`. Referenced/enforced across ~10+ tests, most `docs/` files, and this repo's own `RUNBOOKS.md` (which treats an accidentally-`true` gate as a severe production-safety incident).
- No automatic merges, no automatic deploys, no automatic production migrations, no automatic secret changes — enforced by process (`AGENTS.md`) and by the queue's `safety:` block (`.ai/queue/RUN_QUEUE.yaml`), not by any code-level lock.

**Current blockers:** see `STATUS.json.current_blockers` and `OPEN_ITEMS.md` (security gap, architecture decision debt, production launch blockers, missing recommendation-engine trigger).

**Recommended next step:** Resolve the three-competing-"what should this business do"-systems architecture question (`docs/ARCHITECTURE_REVIEW_2026.md`) before adding further recommendation/decision surface area. In parallel, patch the spoofable `x-forwarded-for` rate-limit key on the public interactive-demo endpoint (§3.9 of that same review) — it is an active, unbounded-cost-abuse security gap, not a hypothetical one.

**Date last verified:** 2026-08-02

**Branch/commit used for verification:** `harden-ai-queue-unattended-execution`, based on `origin/main` at `dc537d2` (merge of PR #99).


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
- **Market Radar** — owner-facing add/remove/prioritize/benchmark controls over the existing `lib/market-context/` competitor provider (expansion, not a rebuild, per `EXISTING_SYSTEM_AUDIT.md`).
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


---

## Open Items

# Open Items

Verified 2026-08-02 against `origin/main` @ `dc537d2` (merge of PR #99). Update this file whenever an item is resolved, deferred further, or a new one is discovered — do not let it silently go stale (see `ADR-0010`'s caveat in `DECISIONS.md` for why that matters).

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

**Still true after this fix, and still the main reason not to trust an unattended overnight run yet:** the fix's *failure-detection* path was proven correct against the real incident's actual response shape (unit-tested directly). The fix's *success* path — a real `claude --dangerously-skip-permissions` invocation actually completing Task 001 or 002 end-to-end — has **not been verified**, because no `claude` binary was on `PATH` in the sandbox this fix was built in either. Run the daytime dry run in `docs/AI_OVERNIGHT_QUEUE.md` in an environment where `claude --version` actually works before trusting this for a real overnight run.


---

## Handoff

# Handoff

This file is the most recent agent-to-agent handoff. **Overwrite it wholesale on your next task** — it is a snapshot of "what the last agent did and what the next one should know," not a growing log. If you need history, use Git (`git log -- .ai/HANDOFF.md`).

## Branch

`harden-ai-queue-unattended-execution` (based on `origin/main` @ `dc537d2`, the merge of PR #99)

## Task status

**Complete.** This task's explicit goal was "enable reliable unattended overnight execution" of `.ai/queue/`. It fixes a real bug this queue's own first live, unattended run just found, plus a broader class of reliability gaps that same incident's investigation surfaced.

## What happened, and what was built

1. On starting this task, the working checkout was sitting on branch `ai-queue/001-market-radar-foundation` with uncommitted `QUEUE_STATUS.json` changes and a new `.ai/runs/2026-08-02T065749882Z/` directory — evidence that **the queue's first real, live, unattended run had actually executed** (in an environment with a working `claude` CLI, unlike every sandbox this project's build sessions have had access to). That run failed at the "no project-memory update" safety check — correctly, but for a deeper underlying reason: the task's `claude -p` invocation never did any real work at all.
2. Investigated the run's own logs (`task-001.log`, not committed — see `.ai/runs/README.md`'s log policy) and found the root cause directly in Claude's own JSON response: it tried to use Write/Edit/Bash tools, each triggered the CLI's normal interactive permission-approval flow, and with no human present in the unattended session, every approval sat pending until Claude gave up and exited 0 with a text explanation — having made zero file changes. The old adapter (`scripts/ai/adapters/claude.ts`) checked only the exit code and reported success.
3. Preserved the run's safe artifacts (`RUN_SUMMARY.md`, `RUN_STATUS.json`, `baseline.json`, `task-001-quality.json`) as committed evidence, reset to a clean `origin/main` checkout, and built the fix on a fresh branch rather than on top of the contaminated one.
4. **Fixed** `scripts/ai/adapters/claude.ts`: now invokes `claude -p --output-format json --dangerously-skip-permissions`; `checkAvailability()` verifies the CLI supports a permission-bypass flag before reporting available; and — as an independent second layer — the adapter now parses the JSON response body and treats a non-empty `permission_denials` array or `is_error: true` as a real failure regardless of exit code. Full reasoning: `.ai/DECISIONS.md` ADR-0013.
5. **Hardened more broadly for reliability**, since the same investigation showed nothing in the queue had a timeout: added `scripts/ai/subprocess.ts` (every git/gh/quality-gate subprocess call now has an explicit timeout and bounded buffer; stdin is never inherited so nothing can block on input that will never come); made `QUEUE_STATUS.json` writes atomic (`queueIO.ts`, write-temp-then-rename); wrapped each task attempt so an unexpected crash is recorded as that task's failure instead of silently losing the run's artifacts; added a run-level wall-clock ceiling (`queue.max_run_duration_minutes`, default 360 min); added timeout-awareness to `qualityGates.ts`'s snapshots (`timedOutGates`) so a killed gate is always treated as a regression, never silently read as "0 errors."
6. Updated `.ai/queue/RUN_QUEUE.yaml`'s header comment and added `max_run_duration_minutes: 360` explicitly. `QUEUE_STATUS.json` already reflected both Market Radar tasks (`001`, `002`) as `pending` on the fresh `origin/main` checkout — no reset needed.

## Tests

- `unit-tests/ai-queue-*.test.ts`: **112 tests, all pass** (67 pre-existing + 45 new/added this branch, across two new files — `ai-queue-subprocess.test.ts`, `ai-queue-claude-adapter.test.ts` — plus additions to `ai-queue-run.test.ts`, `ai-queue-validate.test.ts`, and `ai-queue-quality-gates.test.ts`). New coverage specifically: `buildClaudeArgs()` includes `--dangerously-skip-permissions`; `detectSilentPermissionFailure()` correctly flags the exact 2026-08-02 incident's response shape (`is_error: false` + non-empty `permission_denials`) and correctly passes a clean response; `subprocess.ts`'s `sh()`/`runCommand()` actually kill a real slow process at its timeout, correctly separate stdout/stderr, and never block on stdin; `runExceedsWallClockBudget()`; `compareQualitySnapshots()`'s new timeout-regression handling (including backward-compatibility with a baseline snapshot from before `timedOutGates` existed); `max_run_duration_minutes` validation.
- Full unit suite (`npm run test:unit`): **1740/1740 passing.**
- Lint (`npm run lint`): clean — 0 errors, 7 pre-existing warnings in files this branch never touched.
- Typecheck (`npm run typecheck`): 18 pre-existing errors, identical set to before this branch — none touched by this branch (confirmed: a real typecheck bug in this branch's own new `subprocess.ts` was found and fixed during this session — `SpawnSyncReturns<string>` needed an explicit type annotation, `ReturnType<typeof spawnSync>` alone resolved to a `string | Buffer` union — see git history on this branch for the fix).
- Build (`npm run build`): succeeds, isolated (no dev server running concurrently). Route manifest unaffected by this branch's changes (none of it touches `app/`).
- Playwright (`npx playwright test`): **302/302 passing**, run in isolation on a clean checkout.
- **A real bug was found and fixed during this session's own work**, not just the incident being fixed: the first draft of `subprocess.ts` merged stdout+stderr into one `output` field, which would have silently broken `qualityGates.ts`'s ESLint JSON parsing (`--format json` writes clean JSON to stdout only; any stderr content would have corrupted the parse). Caught before it shipped by reasoning through the exact call site, not by a failing test — fixed by keeping stdout/stderr separate in `SubprocessResult`, with `.output` as a combined view for logging only. Now has direct test coverage.

## PR

Opened against `main` from this branch — see this repository's PR list for the number/URL (`gh pr list --head harden-ai-queue-unattended-execution`). Not merged. Not deployed.

## Blockers

None blocking this task's own completion. One carried-forward limitation, now narrower than before:

**The fix's failure-detection path is verified; its success path is not.** `detectSilentPermissionFailure()` is unit-tested directly against the real incident's actual response shape — that part is solid. But a real `claude --dangerously-skip-permissions` invocation actually completing a real task end-to-end has still never been observed in any sandbox available to this project's build/fix sessions — no `claude` binary was on `PATH` here either. The next environment with a working `claude` CLI should run the daytime dry run below before this is trusted for a real unattended overnight run.

Unrelated, pre-existing, not touched by this branch: the product-track blockers in `OPEN_ITEMS.md` (spoofable rate-limit key, three-competing-decision-systems question, production launch blockers, missing recommendation-engine trigger) and the pre-existing TypeScript debt (18 errors, unchanged).

## Recommended next step

1. In an environment where `claude --version` and `claude --help` actually work, run the daytime dry run: `npm run ai:queue:validate` → confirm clean `git status` on `main` → `npm run ai:queue` attended, in the foreground → confirm both Market Radar tasks (`001`, `002`) actually produce real file changes (a migration, `lib/market-radar/`, tests, docs) and real PRs, not another silent no-op.
2. If task 001 succeeds, its PR should be reviewed and merged before 002's (per `branch_strategy: stacked`) — `npm run ai:morning-brief` states this explicitly once a run completes.
3. If the same silent-no-op pattern recurs even with `--dangerously-skip-permissions`, inspect the raw `claude -p` JSON response directly (`is_error`, `permission_denials`, `result` fields) — `detectSilentPermissionFailure()` in `scripts/ai/adapters/claude.ts` may need updating for a changed CLI response shape rather than the underlying approach being wrong.
4. Separately, unrelated to this queue-reliability task: the product-track recommendations in `OPEN_ITEMS.md` remain the highest-priority carried-forward items.


---

## Machine-readable status (STATUS.json)

```json
{
  "project": "AJN Marketing (Project Magic)",
  "repository": "ajnsolutions/ajnmarketing",
  "current_phase": "Project Magic 2.0 (AI Growth Engine) — Wave I and Wave II shipped; Wave III partially shipped (Goals & Strategy, Customer Voice); several Business Brain intelligence features shipped outside the originally-documented wave sequence",
  "active_initiative": "AI overnight queue reliability hardening (branch harden-ai-queue-unattended-execution). The queue's first real, LIVE, unattended run (2026-08-02, run id 2026-08-02T065749882Z, evidence under .ai/runs/2026-08-02T065749882Z/) surfaced a real bug: scripts/ai/adapters/claude.ts invoked claude -p with no permission-bypass flag, so every Write/Edit/Bash tool call silently blocked on an approval no one was present to give -- Claude exited 0 having done zero work and the adapter reported success anyway (exit-code-only check). Fixed: the adapter now passes --dangerously-skip-permissions and inspects the JSON response body (permission_denials, is_error) instead of trusting exit code alone (DECISIONS.md ADR-0013). Also hardened: every subprocess call now has an explicit timeout (scripts/ai/subprocess.ts), QUEUE_STATUS.json writes are atomic, a crash mid-task still produces a normal run summary, and the whole run now has a wall-clock ceiling (queue.max_run_duration_minutes, default 360 min). The fix's SUCCESS path is still unverified -- no claude binary was on PATH in this fix's own sandbox either. Both Market Radar tasks (001, 002) remain status: pending, unchanged in content, ready to retry once verified. No other feature branch or PR is in progress on the product/intelligence track -- main is caught up through PR #99.",
  "status": "active",
  "last_verified_at": "2026-08-02T00:00:00Z",
  "last_verified_branch": "harden-ai-queue-unattended-execution",
  "last_verified_commit": "dc537d2",
  "last_completed_task": "PR #99 — Add Queue v2: baseline-aware quality gates for the AI overnight queue (merged into main); this branch fixes the permission-bypass bug that PR #99's own first live run surfaced, plus broader subprocess/state reliability hardening",
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
    "The AI queue's Claude adapter fix (permission-bypass flag + response-body inspection, this branch) has not been verified end-to-end against a real claude invocation -- no claude CLI was available in this branch's own build sandbox. See OPEN_ITEMS.md's 'Live dry-run incident' entry."
  ],
  "recommended_next_task": "Resolve the three-competing-decision-systems architecture question (ARCHITECTURE_REVIEW_2026.md) before adding further recommendation/decision surface area; in parallel, patch the spoofable rate-limit key (§3.9) since it is an active, unbounded-cost-abuse security gap. Separately, on the AI-tooling track: run the attended daytime dry run of .ai/queue/RUN_QUEUE.yaml's two real tasks (npm run ai:queue) in an environment where the claude CLI is actually installed and authenticated -- confirm the permission-bypass fix actually lets a task complete real work end-to-end, not just that it fails safely when claude is absent.",
  "production_deploy_allowed": false,
  "automatic_merge_allowed": false,
  "automatic_migrations_allowed": false,
  "production_schedules_enabled": false
}
```

---

## Latest overnight queue run

# Run 2026-08-02T065749882Z

Started: 2026-08-02T06:57:49.883Z
Finished: 2026-08-02T07:14:42.110Z
Stop reason: task 001 failed: no project-memory update

## Repository baseline (captured before this run's first task)

Baseline: TypeScript 18 error(s), ESLint 0 error(s)/7 warning(s), unit tests 0 failure(s), Playwright 0 failure(s), build succeeded.

## Tasks attempted this run

- **001 — Market Radar: owner-managed competitor & benchmark persistence foundation**: failed — blocker: task completed and passed quality gates, but did not update any .ai/ memory file — AGENTS.md requires this before completing work.

### Quality gate — 001 — Market Radar: owner-managed competitor & benchmark persistence foundation: PASS

Auto-repair attempts used: 1.

| Gate | Baseline | Current | Result |
|---|---|---|---|
| typescript | 18 error(s) | 18 error(s) | PASS |
| eslint_errors | 0 error(s) | 0 error(s) | PASS |
| eslint_warnings | 7 warning(s) | 7 warning(s) | PASS |
| unit_tests | 0 failure(s) | 0 failure(s) | PASS |
| playwright | 0 failure(s) | 0 failure(s) | PASS |
| build | succeeded | succeeded | PASS |

**New regressions:** none
**Fixed regressions:** none
**Remaining historical debt:** 18 pre-existing TypeScript error(s), unchanged; 7 pre-existing ESLint warning(s), unchanged



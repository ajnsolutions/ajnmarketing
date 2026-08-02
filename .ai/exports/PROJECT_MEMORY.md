# Project Memory — AJN Marketing

Generated 2026-08-02T06:01:47.015Z by `scripts/ai/export-memory.ts`. This file combines every `.ai/` memory doc into one upload-friendly document for AI tools without direct repository access. It is a snapshot — for anything time-sensitive, prefer reading the repository directly if you can.


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

**Current active initiative:** Queue v2 — baseline-aware quality gates (branch `ai-queue-v2-baseline-aware`). The first real daytime dry run of `.ai/queue/RUN_QUEUE.yaml`'s two real tasks (Market Radar persistence foundation, id `001`; Market Radar owner-facing view, id `002`, depends on `001`) surfaced a design flaw: v1's quality gate required a perfectly clean lint/typecheck/unit-test run, so this repository's own documented, pre-existing baseline issues stopped the queue even when a task introduced zero regressions. `scripts/ai/qualityGates.ts` now captures one `QualitySnapshot` (TypeScript, ESLint errors/warnings, unit tests, Playwright, build) before a run's first task begins, persists it to `.ai/runs/<run-id>/baseline.json`, and compares every task's after-state against that same baseline — pre-existing debt that stays unchanged never fails a task; a genuine new regression always does, and gets up to `max_repair_attempts` (default 3) automatic repair tries before the task fails and the queue stops. See `DECISIONS.md` ADR-0012 and `docs/AI_OVERNIGHT_QUEUE.md`'s "Queue v2" section. Both Market Radar tasks in `RUN_QUEUE.yaml` are unaffected in content — still `status: pending`, not yet actually run to completion end-to-end. Otherwise, main is caught up through PR #98 with no other open product-track PR or unmerged product branch. See `recommended_next_task` below and `OPEN_ITEMS.md` for what a human should prioritize next on the product/intelligence track.

**Known safety gates (must not be silently changed by any agent):**
- `ATTACH_DECLARATIVE_PRODUCTION_CRONS` — the Trigger.dev production-schedule activation gate. **Must remain `false`.** Canonical source: `lib/trigger/scheduleActivation.ts`. Referenced/enforced across ~10+ tests, most `docs/` files, and this repo's own `RUNBOOKS.md` (which treats an accidentally-`true` gate as a severe production-safety incident).
- No automatic merges, no automatic deploys, no automatic production migrations, no automatic secret changes — enforced by process (`AGENTS.md`) and by the queue's `safety:` block (`.ai/queue/RUN_QUEUE.yaml`), not by any code-level lock.

**Current blockers:** see `STATUS.json.current_blockers` and `OPEN_ITEMS.md` (security gap, architecture decision debt, production launch blockers, missing recommendation-engine trigger).

**Recommended next step:** Resolve the three-competing-"what should this business do"-systems architecture question (`docs/ARCHITECTURE_REVIEW_2026.md`) before adding further recommendation/decision surface area. In parallel, patch the spoofable `x-forwarded-for` rate-limit key on the public interactive-demo endpoint (§3.9 of that same review) — it is an active, unbounded-cost-abuse security gap, not a hypothetical one.

**Date last verified:** 2026-08-01

**Branch/commit used for verification:** `ai-queue-v2-baseline-aware`, based on `origin/main` at `44d6db1` (merge of PR #98).


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
- **One-off audit scripts**: `scripts/audit/*.ts`, run via `node --experimental-strip-types scripts/audit/<name>.ts`, excluded from the main `tsconfig.json`'s type-checking (`scripts/**/*` is in `exclude`) and from `test:unit`/`test:e2e` — standalone verification tools, not part of the committed test suite. The `.ai/queue/` tooling (`scripts/ai/`) follows this same run convention. The queue's own per-task quality gate (`scripts/ai/qualityGates.ts`, "Queue v2") is baseline-aware — see `DECISIONS.md` ADR-0012 and `docs/AI_OVERNIGHT_QUEUE.md` — so it never blocks on this repository's own pre-existing debt, only on regressions a queue task itself introduces.

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


---

## Open Items

# Open Items

Verified 2026-08-01 against `origin/main` @ `44d6db1` (merge of PR #98). Update this file whenever an item is resolved, deferred further, or a new one is discovered — do not let it silently go stale (see `ADR-0010`'s caveat in `DECISIONS.md` for why that matters).

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

## This build's own limitation (self-reported)

The Claude Code CLI adapter (`scripts/ai/adapters/claude.ts`) is implemented against documented Claude Code CLI non-interactive conventions but **could not be end-to-end tested in this build's sandbox** — no `claude` binary was present on `PATH` here. The adapter's capability probe (`isAvailable()`) correctly detects this and fails with an actionable message; that specific failure path *was* verified live in this sandbox. The success path (an actual non-interactive `claude` invocation completing a real task) has not been. See `docs/AI_OVERNIGHT_QUEUE.md` for the required first daytime dry run before trusting this for unattended overnight runs.


---

## Handoff

# Handoff

This file is the most recent agent-to-agent handoff. **Overwrite it wholesale on your next task** — it is a snapshot of "what the last agent did and what the next one should know," not a growing log. If you need history, use Git (`git log -- .ai/HANDOFF.md`).

## Branch

`ai-queue-v2-baseline-aware` (based on `origin/main` @ `44d6db1`, the merge of PR #98)

## Task status

**Complete.** Fixed the design flaw the first real daytime dry run of the queue surfaced: v1's quality gate compared each task's lint/typecheck/unit-test run against a hard "must be perfectly clean" bar, so this repository's own documented, pre-existing baseline issues stopped the queue even when a task introduced zero regressions of its own. Queue v2 makes the gate baseline-aware.

## What was built

- **`scripts/ai/qualityGates.ts`** (new) — the core of Queue v2:
  - `QualitySnapshot` type + `captureQualitySnapshot(repoRoot)`: runs TypeScript (`tsc --noEmit`), ESLint (`eslint . --format json`, errors and warnings tracked separately), unit tests (`test:unit`, TAP output), Playwright (`test:e2e --reporter=json`), and the production build, returning one structured snapshot.
  - Pure parsing functions (unit-tested with canned sample output): `parseTypescriptErrorCount`, `parseEslintJson`, `parseNodeTestFailures` (count + failing-test **names**, not just count), `parsePlaywrightJson` (same, recursively walking suites).
  - `compareQualitySnapshots(baseline, current)`: TypeScript/ESLint errors/ESLint warnings pass if the count didn't increase (existing debt is never a failure); unit tests/Playwright are **identity-aware** — a currently-failing test only passes if the *same test by name* was already failing in the baseline, which catches a regression a naive count comparison would miss (an old failure gets fixed while a different new one appears, netting to the same count); build must succeed unless the baseline build was itself already broken. Returns `overallStatus`, per-gate `gates[]`, and `newRegressions`/`fixedRegressions`/`remainingHistoricalDebt` lists.
  - `buildRepairPrompt(comparison, attempt, maxAttempts)`: a narrow follow-up prompt naming exactly the new regressions and explicitly forbidding scope expansion or "fixing" historical debt.
  - `formatQualityComparisonMarkdown(...)`: renders a comparison as a Markdown table for `RUN_SUMMARY.md`.
- **`scripts/ai/run-queue.ts`** (modified):
  - Captures one baseline via `captureQualitySnapshot` before this run's first eligible task begins (skipped entirely if no task is eligible — nothing to compare against), persisted to `.ai/runs/<run-id>/baseline.json`.
  - Replaced the old fixed `["npm run lint", "npm run typecheck", "npm run test:unit"]` gate loop with: capture current snapshot → `compareQualitySnapshots` against the baseline → if it fails, invoke the agent again with `buildRepairPrompt` (up to `queue.max_repair_attempts`, default 3) → re-capture → re-compare, repeating until it passes or attempts are exhausted. Only then does the task fail and the queue stop.
  - Persists `.ai/runs/<run-id>/task-<id>-quality.json` (baseline, current, comparison, repair attempt count) per attempted task, and `RUN_SUMMARY.md`/`RUN_STATUS.json` now include the repository baseline plus a per-task quality-gate table (baseline/current/result per gate, new regressions, fixed regressions, remaining historical debt).
  - The PR body `run-queue.ts` writes now states the Queue v2 result (pass + any remaining historical debt + repair attempts used) instead of the old fixed gate-command list.
- **`scripts/ai/queueTypes.ts`** — added optional `queue.max_repair_attempts` (defaults to `DEFAULT_MAX_REPAIR_ATTEMPTS = 3` when absent, so an older queue file without this field stays valid).
- **`scripts/ai/validate-queue.ts`** — validates `max_repair_attempts` if present (non-negative integer, capped at 10 so an unattended queue can't loop indefinitely on one task).
- **`.ai/queue/RUN_QUEUE.yaml`** — sets `max_repair_attempts: 3` explicitly; header comments explain Queue v2. The two Market Radar tasks (`001`, `002`) are otherwise unchanged in content.
- **Docs**: `docs/AI_OVERNIGHT_QUEUE.md` gained a full "Queue v2 — baseline-aware quality gates" section; `docs/AI_QUEUE_TROUBLESHOOTING.md`'s failed-task guidance updated to describe the new blocker message and where to find the comparison; `.ai/queue/README.md` and `.ai/runs/README.md` updated to mention `baseline.json`/`task-<id>-quality.json`; `scripts/ai/generate-morning-brief.ts`'s "Quality gates" section text updated for accuracy.
- **`.ai/DECISIONS.md`** — added ADR-0012 documenting this decision (what changed, why, alternatives considered, consequences). **`.ai/ARCHITECTURE.md`** and **`.ai/OPEN_ITEMS.md`** cross-reference it; `OPEN_ITEMS.md`'s pre-existing type-check debt entry now notes the queue no longer blocks on it, and a new "Known limitation of Queue v2's identity-aware test comparison" entry documents the test-rename edge case honestly.

## Tests

- New: `unit-tests/ai-queue-quality-gates.test.ts` (24 tests) — every parsing function with canned sample output, every `compareQualitySnapshots` rule (including this task's own worked example: 0→2 unit failures is a hard FAIL, and 18→18 TypeScript errors is a PASS), the identity-vs-count distinction specifically, `buildRepairPrompt`, `formatQualityComparisonMarkdown`. **All pass.**
- `unit-tests/ai-queue-*.test.ts` (all four files together, 63 tests total) — **all pass**, including the pre-existing `ai-queue-run.test.ts` (`selectNextEligibleTask`/`determineBranchBase`, unaffected by this change) and the self-check that validates the real `.ai/queue/RUN_QUEUE.yaml`.
- Full unit suite (`npm run test:unit`): **1718/1718 passing** (1694 prior + 24 new).
- Lint (`npm run lint`): clean — 0 errors, 7 pre-existing warnings in files this branch never touched.
- Typecheck (`npm run typecheck`): 18 pre-existing errors, same baseline as before — none touched by this branch (see `OPEN_ITEMS.md`).
- `npm run ai:queue:validate`: valid.
- Build (`npm run build`): succeeds.
- Playwright (`npx playwright test`): full suite run — see this PR's own quality-gate results for the exact count at merge time.
- **The queue itself was not run** (`npm run ai:queue`) — this is a code change to the queue's own quality-gate mechanism, not a queue execution. The next real daytime dry run (per `docs/AI_OVERNIGHT_QUEUE.md`) is the actual end-to-end verification that Queue v2 behaves as designed against a live agent invocation.

## PR

Not yet created at the time this file was written — will be `ai-queue-v2-baseline-aware` → `main`. Not merged. Not deployed. The queue itself was not executed.

## Blockers

None blocking this task's own completion. Two things carried forward, unchanged by this work:

1. **The Claude CLI adapter's live success path is still unverified** (unchanged since PR #97/#98 — see `OPEN_ITEMS.md`). Queue v2 changes what happens *after* the agent invocation (the quality gate), not the invocation itself — that verification gap is orthogonal to this fix and still open.
2. **Queue v2's identity-aware test comparison has a known, accepted limitation** around test renames — see the new `OPEN_ITEMS.md` entry. Not a bug, but worth a human's awareness when reading a repair-loop diagnosis.

## Recommended next step

1. Review this PR (the new `scripts/ai/qualityGates.ts` module, the `run-queue.ts` integration, the schema addition, the docs, and ADR-0012).
2. Retry the attended daytime dry run per `docs/AI_OVERNIGHT_QUEUE.md`: confirm `gh --version`/`claude --version` are ready, confirm `git status` is clean on `main`, then run `npm run ai:queue` attended and watch it — this time, confirm Task 001 (which should introduce zero regressions if implemented as scoped) actually completes instead of being blocked by this repository's own pre-existing debt, and that `.ai/runs/<run-id>/baseline.json` and `task-001-quality.json` are written and look correct.
3. If Task 001 genuinely does introduce a regression this time, confirm the auto-repair loop actually attempts a fix and that the eventual PR (or failure) correctly reflects what happened.
4. Only after that succeeds should an unattended/overnight run be trusted.
5. Separately, unrelated to this queue-tooling fix: the product-track recommendations in `OPEN_ITEMS.md` (the three-competing-decision-systems architecture question, the spoofable rate-limit key) remain the highest-priority carried-forward items.


---

## Machine-readable status (STATUS.json)

```json
{
  "project": "AJN Marketing (Project Magic)",
  "repository": "ajnsolutions/ajnmarketing",
  "current_phase": "Project Magic 2.0 (AI Growth Engine) — Wave I and Wave II shipped; Wave III partially shipped (Goals & Strategy, Customer Voice); several Business Brain intelligence features shipped outside the originally-documented wave sequence",
  "active_initiative": "Queue v2 — baseline-aware quality gates (branch ai-queue-v2-baseline-aware). The first real daytime dry run of .ai/queue/RUN_QUEUE.yaml's two real tasks (001 Market Radar persistence foundation, 002 Market Radar owner-facing view) surfaced a design flaw: v1's quality gate required a perfectly clean lint/typecheck/unit-test run, so this repository's own pre-existing baseline issues stopped the queue even when a task introduced zero regressions. scripts/ai/qualityGates.ts now captures one QualitySnapshot before a run's first task begins, persists it to .ai/runs/<run-id>/baseline.json, and compares every task's after-state against that same baseline (identity-aware for unit/Playwright failures, count-based for TypeScript/ESLint, unconditional for build) — pre-existing debt never fails a task; a new regression always does, with up to max_repair_attempts (default 3) automatic repair tries first. See DECISIONS.md ADR-0012. The two Market Radar tasks themselves are unchanged in content and still status: pending, not yet run to completion end-to-end. No other feature branch or PR is in progress on the product/intelligence track — main is caught up through PR #98.",
  "status": "active",
  "last_verified_at": "2026-08-01T00:00:00Z",
  "last_verified_branch": "ai-queue-v2-baseline-aware",
  "last_verified_commit": "44d6db1",
  "last_completed_task": "PR #98 — Prepare the first real controlled AI overnight queue run (Market Radar foundation + view) (merged into main); this branch adds Queue v2's baseline-aware quality gates on top of it",
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
    "Approval Center UI copy falsely claims full automation ('From AI draft to published — automatically'); GBP Disconnect button is a no-op; Regenerate silently severs the recommendation link; analytics-to-opportunities feedback loop is dead in production (all from RELEASE_CANDIDATE_END_TO_END_AUDIT.md)."
  ],
  "recommended_next_task": "Resolve the three-competing-decision-systems architecture question (ARCHITECTURE_REVIEW_2026.md) before adding further recommendation/decision surface area; in parallel, patch the spoofable rate-limit key (§3.9) since it is an active, unbounded-cost-abuse security gap. Separately, on the AI-tooling track: retry the attended daytime dry run of .ai/queue/RUN_QUEUE.yaml's two real tasks (npm run ai:queue) now that Queue v2's baseline-aware quality gate is in place, and confirm end-to-end that a task with zero regressions completes without being blocked by pre-existing debt.",
  "production_deploy_allowed": false,
  "automatic_merge_allowed": false,
  "automatic_migrations_allowed": false,
  "production_schedules_enabled": false
}
```

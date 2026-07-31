# Project Memory — AJN Marketing

Generated 2026-07-31T14:01:32.783Z by `scripts/ai/export-memory.ts`. This file combines every `.ai/` memory doc into one upload-friendly document for AI tools without direct repository access. It is a snapshot — for anything time-sensitive, prefer reading the repository directly if you can.


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

**Current active initiative:** None on the product/intelligence track — main is caught up through PR #96 with no open PR or unmerged product branch. See `recommended_next_task` below and `OPEN_ITEMS.md` for what a human should prioritize next.

**Known safety gates (must not be silently changed by any agent):**
- `ATTACH_DECLARATIVE_PRODUCTION_CRONS` — the Trigger.dev production-schedule activation gate. **Must remain `false`.** Canonical source: `lib/trigger/scheduleActivation.ts`. Referenced/enforced across ~10+ tests, most `docs/` files, and this repo's own `RUNBOOKS.md` (which treats an accidentally-`true` gate as a severe production-safety incident).
- No automatic merges, no automatic deploys, no automatic production migrations, no automatic secret changes — enforced by process (`AGENTS.md`) and by the queue's `safety:` block (`.ai/queue/RUN_QUEUE.yaml`), not by any code-level lock.

**Current blockers:** see `STATUS.json.current_blockers` and `OPEN_ITEMS.md` (security gap, architecture decision debt, production launch blockers, missing recommendation-engine trigger).

**Recommended next step:** Resolve the three-competing-"what should this business do"-systems architecture question (`docs/ARCHITECTURE_REVIEW_2026.md`) before adding further recommendation/decision surface area. In parallel, patch the spoofable `x-forwarded-for` rate-limit key on the public interactive-demo endpoint (§3.9 of that same review) — it is an active, unbounded-cost-abuse security gap, not a hypothetical one.

**Date last verified:** 2026-07-31

**Branch/commit used for verification:** `build-ai-project-memory-and-queue`, based on `origin/main` at `16795b6` (merge of PR #96).


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
- **One-off audit scripts**: `scripts/audit/*.ts`, run via `node --experimental-strip-types scripts/audit/<name>.ts`, excluded from the main `tsconfig.json`'s type-checking (`scripts/**/*` is in `exclude`) and from `test:unit`/`test:e2e` — standalone verification tools, not part of the committed test suite. The `.ai/queue/` tooling (`scripts/ai/`) follows this same run convention.

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


---

## Open Items

# Open Items

Verified 2026-07-31 against `origin/main` @ `16795b6`. Update this file whenever an item is resolved, deferred further, or a new one is discovered — do not let it silently go stale (see `ADR-0010`'s caveat in `DECISIONS.md` for why that matters).

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

## This build's own limitation (self-reported)

The Claude Code CLI adapter (`scripts/ai/adapters/claude.ts`) is implemented against documented Claude Code CLI non-interactive conventions but **could not be end-to-end tested in this build's sandbox** — no `claude` binary was present on `PATH` here. The adapter's capability probe (`isAvailable()`) correctly detects this and fails with an actionable message; that specific failure path *was* verified live in this sandbox. The success path (an actual non-interactive `claude` invocation completing a real task) has not been. See `docs/AI_OVERNIGHT_QUEUE.md` for the required first daytime dry run before trusting this for unattended overnight runs.


---

## Handoff

# Handoff

This file is the most recent agent-to-agent handoff. **Overwrite it wholesale on your next task** — it is a snapshot of "what the last agent did and what the next one should know," not a growing log. If you need history, use Git (`git log -- .ai/HANDOFF.md`).

## Branch

`build-ai-project-memory-and-queue` (based on `origin/main` @ `16795b6`)

## Task status

**Complete.** Built the first version of the shared AI project memory (`.ai/`), the root-level agent rules (`AGENTS.md`, `CLAUDE.md`), the Cursor rule (`.cursor/rules/project-memory.mdc`), and the overnight task queue (`.ai/queue/`, `scripts/ai/`), plus documentation (`docs/AI_*.md`) and automated tests.

## What was built

- `.ai/CURRENT_STATUS.md`, `ROADMAP.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `OPEN_ITEMS.md`, `STATUS.json` — populated from verified repository facts (docs, git history, code), not invented. See each file's own content for sourcing.
- `.ai/queue/` — `RUN_QUEUE.yaml` (schema + two disabled example tasks), `QUEUE_STATUS.json`, `prompts/`.
- `.ai/runs/` — run-log directory, currently empty (no queue run has executed yet).
- `.ai/exports/` — `PROJECT_MEMORY.md`, `MORNING_BRIEF.md`, generated by `scripts/ai/export-memory.ts` / `generate-morning-brief.ts`.
- `scripts/ai/*.ts` — queue types/IO, validator, sequential runner, status reporter, reset command, memory export, morning brief, and the Claude/Cursor-placeholder adapters.
- `docs/AI_PROJECT_MEMORY.md`, `AI_OVERNIGHT_QUEUE.md`, `AI_AGENT_WORKFLOW.md`, `AI_QUEUE_TROUBLESHOOTING.md`.
- Root `AGENTS.md` extended with permanent cross-agent rules; `CLAUDE.md` rewritten as a thin pointer; new `.cursor/rules/project-memory.mdc`.
- Unit tests: `unit-tests/ai-queue-*.test.ts` covering the validator (valid queue, duplicate IDs, missing deps, cycles, missing prompt file, unsafe migration/deployment/secret/schedule requests, unsupported agent, invalid status), queue ordering/selection, status persistence, memory export, and morning brief generation.

## Tests

- **Lint**: clean — 0 errors, 7 pre-existing warnings in files this branch never touched.
- **Typecheck** (`tsc --noEmit`, newly added — no such script existed before this branch): 18 pre-existing errors across 10 unrelated `unit-tests/*.test.ts` files, none touched by this branch and none in any new file this branch adds. See `.ai/OPEN_ITEMS.md`'s "Pre-existing type-check debt" entry — recommend a human triage separately.
- **Unit** (`npm run test:unit`): 1694/1694 passing, including 39 new tests in `unit-tests/ai-queue-*.test.ts`.
- **Build** (`npm run build`): succeeds. Route manifest confirmed to include `/snapshot`, `/dashboard`, `/api/business-discovery/snapshot`, and all 3 continuation routes.
- **Playwright** (`npx playwright test`): 302/302 passing, run in isolation on a freshly-restarted dev server. No dedicated Edge-runtime test suite exists in this repo (see `.ai/ARCHITECTURE.md`) — `middleware.ts`'s Edge-runtime behavior is exercised indirectly via the redirect-behavior specs within this same 302, which all passed.

## PR

[#97](https://github.com/ajnsolutions/ajnmarketing/pull/97) — `build-ai-project-memory-and-queue` → `main`. Not merged. Not deployed.

## Blockers

None blocking this task's own completion. Carried-forward, pre-existing blockers unrelated to this build are tracked in `.ai/OPEN_ITEMS.md` (the unpatched rate-limit security gap, the three-competing-decision-systems question, production launch blockers, etc.) — this build did not touch any product code and did not attempt to fix those.

One self-reported limitation of this build itself: the Claude CLI adapter (`scripts/ai/adapters/claude.ts`) could not be end-to-end verified in this sandbox because no `claude` binary was on `PATH` here — see `.ai/OPEN_ITEMS.md`'s "This build's own limitation" entry and `docs/AI_OVERNIGHT_QUEUE.md`'s required first daytime dry run.

## Recommended next step

1. Run the first daytime dry run per `docs/AI_OVERNIGHT_QUEUE.md` (validate → enable the two example tasks → `npm run ai:queue` → confirm two real PRs open correctly) before ever relying on this for an unattended overnight run.
2. Separately, product-track: resolve the three-competing-decision-systems architecture question and patch the spoofable rate-limit key (`.ai/OPEN_ITEMS.md`, items 1–2) — unrelated to this build but the highest-priority carried-forward items.


---

## Machine-readable status (STATUS.json)

```json
{
  "project": "AJN Marketing (Project Magic)",
  "repository": "ajnsolutions/ajnmarketing",
  "current_phase": "Project Magic 2.0 (AI Growth Engine) — Wave I and Wave II shipped; Wave III partially shipped (Goals & Strategy, Customer Voice); several Business Brain intelligence features shipped outside the originally-documented wave sequence",
  "active_initiative": "No feature branch or PR is currently in progress on the product/intelligence track as of this verification — main is caught up through PR #96 (Head of Marketing Orchestrator). This branch (build-ai-project-memory-and-queue) is infrastructure/tooling, not a product feature.",
  "status": "active",
  "last_verified_at": "2026-07-31T00:00:00Z",
  "last_verified_branch": "build-ai-project-memory-and-queue",
  "last_verified_commit": "16795b6",
  "last_completed_task": "PR #96 — Add Head of Marketing Orchestrator: one daily Executive Review composed from existing systems (merged into main)",
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
  "recommended_next_task": "Resolve the three-competing-decision-systems architecture question (ARCHITECTURE_REVIEW_2026.md) before adding further recommendation/decision surface area; in parallel, patch the spoofable rate-limit key (§3.9) since it is an active, unbounded-cost-abuse security gap.",
  "production_deploy_allowed": false,
  "automatic_merge_allowed": false,
  "automatic_migrations_allowed": false,
  "production_schedules_enabled": false
}
```

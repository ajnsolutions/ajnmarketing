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

# Architecture Review 2026 — Foundation Assessment Before Project Magic

**Branch:** `architecture-foundation-review` (from latest `main`, post–PR #39)
**Date:** 2026-07-16
**Scope:** All architecture added roughly PR #25 → PR #39 — Recommendation Engine, Recommendation Execution, Outcome Feedback Loop, Adaptive Learning, Recommendation Presentation, Weekly Approval Package, One-Click Email Approval, Operations Dashboard, Production Readiness, Assisted Pilot, Public Website, Interactive AI Demo, Project Magic First Five Minutes, Trigger.dev integration.
**Framing:** This is **not** a feature review. It is a Chief-Software-Architect-style assessment of whether the current codebase is the right long-term foundation for Project Magic and the next 2–5 years of development. See [`ARCHITECTURE_DECISIONS.md`](./ARCHITECTURE_DECISIONS.md) for the "why" behind each major system.

---

## 1. Executive Summary

The backend is **well-engineered at the seams that matter most**: tenant isolation, the `*ForUser`/`*ForCurrentUser` dependency-injection convention, the single authoritative content-approval mutation, signed-link security, and the Trigger.dev cron gate are all deliberate, documented, and — critically — the code was verified to actually match what the docs claim. That is above average for a codebase this size and age.

The debt is not "bad code." It is **accumulated parallel infrastructure**: multiple systems that each solve a real problem correctly, built at different times, that were never consolidated once the second or third one arrived. The single largest risk to Project Magic is not a rewrite of any one system — it's that **three separate systems currently compete to answer "what should this business do next"** (Marketing Recommendations, Tasks, Marketing Plan), plus a fourth adjacent autonomy layer (Assisted Pilot), and Project Magic's simplified customer experience cannot ship without a consolidation decision here. That decision is product/architecture work that should happen *before* Magic UI work starts, not as a side effect of it.

Everything else in this document is secondary to that finding.

---

## 2. Architecture Strengths

- **Tenant isolation discipline is real, not just documented.** Every reviewed cluster showed explicit "defense in depth even under service-role" comments and filters (e.g. `lib/weekly-approval-package/collect.ts:65`), and no instance was found anywhere of a service-role query missing a tenant/userId filter.
- **The `*ForUser(userId, ..., supabaseClient?)` / `*ForCurrentUser()` convention** is followed consistently across the recommendation pipeline, Google Business, marketing-decisions, and most of content-approval/publishing — enabling unit testing without mocking `next/headers` and reuse from Trigger.dev/admin contexts.
- **`patchContentApprovalForUser` is a genuine single authoritative mutation.** Verified directly: the newer One-Click Email Approval feature (`lib/email-actions/service.ts`) calls it rather than reimplementing approve/reject logic — exactly the discipline the docs promise.
- **Signed-link security is solid and deliberately layered.** The weekly-package "open" tokens and email-action tokens are cryptographically domain-separated (`SIGNING_DOMAIN` in `lib/email-actions/tokens.ts:18`) with an automated test proving cross-family tokens never verify — this is a documented, tested design decision, not an accident.
- **OAuth, admin-route auth, and RLS/service-role discipline are above average.** State-based CSRF protection, AES-256-GCM token encryption with a versioned prefix, expiry-aware refresh, and consistent tenant filters were all confirmed by direct code reading, not just doc claims.
- **Trigger.dev's production-activation gate (`ATTACH_DECLARATIVE_PRODUCTION_CRONS`) is a single, well-reasoned boolean** (`lib/trigger/scheduleActivation.ts:13`) with a real ADR (`docs/ADR_AUTONOMOUS_SCHEDULER.md`) — flipping it is genuinely a one-line change, and Trigger.dev tasks are thin wrappers around the same `lib/*` services used elsewhere, not reimplemented logic.
- **Core types are defined once.** `ContentApproval`/`ContentApprovalStatus`, `RecommendationOutcomeEvent`, and the recommendation-pipeline domain types are each defined in exactly one place and imported everywhere else — no redefinition drift found.
- **Admin/ops surface is genuinely isolated from customer code**, and **server/client boundaries are clean** — a repo-wide grep of every `"use client"` file confirmed zero imports of server-only or service-role modules.
- **The target Project Magic IA/voice/trust documentation is unusually thorough and internally consistent** (`NAVIGATION_PHILOSOPHY.md`, `DASHBOARD_PHILOSOPHY.md`, `TRUST_MODEL.md`, `MARKETING_HEALTH.md`, `CUSTOMER_JOURNEYS.md`) — rare for a project at this stage to have this much of the target state already written down.

---

## 3. Architecture Weaknesses & Technical Debt

Organized by theme, since the same underlying pattern (parallel systems, scattered cross-cutting infra) recurs across clusters.

### 3.1 Competing "what should I do next" systems (highest priority)

Three independently-built systems all answer a version of "what should this business do," all live, all wired into `lib/command-center/context.ts:16-31`:

| System | Surface | Mechanism |
|---|---|---|
| `lib/marketing-opportunities` → `lib/marketing-decisions` → recommendation pipeline | Marketing Recommendations, Approval Center | Deterministic detectors + adaptive learning, persisted, outcome-tracked |
| `lib/marketing-agent` | Tasks page | OpenAI ad hoc task list |
| `lib/marketing-planner` | Marketing Plan page | OpenAI weekly plan |

A fourth, adjacent layer, `lib/assisted-pilot` (~1,559 lines), already triggers the recommendation pipeline and reconciliation directly (`lib/assisted-pilot/manualActions.ts:13,93,191`) and models "readiness" toward more autonomous action — it should be scoped explicitly against Project Magic's "autonomous workflows" concept rather than treated as unrelated.

**Why it matters:** Project Magic's simplified customer experience (a single "Marketing Health" surface, one relationship with a "Head of Marketing") cannot be built on top of three competing recommendation surfaces without deciding which one is authoritative, which are merged, and which are retired. This is the single biggest prerequisite decision for Magic.

### 3.2 Fragmented status/state models

- **Three independent "is this live" enums** in the content pipeline: `ContentApprovalStatus` (`lib/content-approval/types.ts:1`), `PublishingQueueStatus` (`lib/publishing-queue/types.ts:8`), `PublishingJobStatuses` (`lib/publishing/publishingTypes.ts:15-24`). Determining "is this content actually published" requires reasoning across three separate state machines with overlapping vocabulary.
- **`ContentApprovalStatus` includes a phantom `"published"` value** that no migration, trigger, or app code ever sets on a `content_approvals` row — yet `lib/email-actions/service.ts:73` defensively branches on it, coding around a state that can never occur.
- **Two parallel job/queue systems are both fully live**, not just historically transitional: `lib/background-jobs/worker.ts:170-199` still dispatches via the request-scoped `after()` path while `trigger/*.ts` does the same work via Trigger.dev, with different retry policies and different persistence. `docs/ADR_AUTONOMOUS_SCHEDULER.md` documents this as a conscious staged migration — but the migration hasn't been finished, and two systems must be kept mentally in sync in the meantime.
- **`lib/google-business` ↔ `lib/google-business-profile` are bidirectionally coupled**, not a clean layered split: `lib/google-business-profile/service.ts:24` imports from `lib/google-business/auth.ts`, while `lib/google-business/auth.ts:8-13` and `lib/google-business/service.ts:6-7` import back from `lib/google-business-profile/*`. Reads like one module artificially split by feature (OAuth vs. sync/publish) without a strict dependency direction.

### 3.3 Duplicated cross-cutting infrastructure

Each of these is small in isolation but compounds into real maintenance risk as the codebase grows:

- **Three independently-maintained secret-redaction blocklists**, overlapping but not identical: `lib/audit-log/persistence.ts` (`sanitizeMetadata`), `lib/background-jobs/persistence.ts:11-21` (`BLOCKED_PAYLOAD_KEYS`), `lib/observability/workflowLogger.ts:20-34` (`BLOCKED_KEYS`, the only one that includes `authorization`/`service_role`/`supabase_secret_key`). A leak-prevention fix in one place will not propagate to the others.
- **Three uncoordinated logging conventions**: `lib/observability/workflowLogger.ts`'s structured logger is used in only 2 call sites outside its own file; Trigger.dev tasks use `@trigger.dev/sdk`'s own `logger`; `lib/background-jobs/persistence.ts` uses raw `console.error` throughout.
- **Duplicated, incompletely-parameterized alert computation**: `app/api/admin/ops/route.ts` (`?view=alerts`) and `app/dashboard/admin/ops/page.tsx` each independently re-derive `evaluateOpsAlerts` inputs, both omitting fields (`recommendationExecutionFailures24h`, `analyticsBacklogCount`, `emailGenerationFailures24h`, `approvalFailures24h`) that `lib/ops-dashboard/service.ts:245-254`'s own internal call includes — so the `?view=alerts` JSON and the dashboard page can disagree with the summary endpoint's `alertCounts` for the same underlying state. Separately, `lib/ops-dashboard/service.ts:250` hardcodes `analyticsBacklogCount: 0`, so the `analytics-backlog` alert (`lib/production-alerts/evaluate.ts:89-98`) can never fire from the dashboard summary path despite the threshold logic existing.
- **`lib/workflow-validation/harness.ts`** is a hardcoded assertion tree (e.g. lines 137-238) that returns `ok: true` for most scenarios regardless of actual system state — it validates *documented intent*, not real behavior, and its green dashboard tile could give false confidence to someone who reads it as a live test result.
- **Dead/unwired observability**: `getAutonomousSchedulingHealth`/`getRecentScheduledSubsystemRuns`/`getRecommendationPipelineHealth` (`lib/trigger/recommendationPipelineStatus.ts:174-245`) query Trigger.dev's real runs/schedules API but have zero callers outside their own file and tests — the ops dashboard never surfaces this real visibility.
- **Duplicated `isOpenAIConfigured`-style checks** (identical one-line body `Boolean(process.env.OPENAI_API_KEY?.trim())`) independently exported from 4 modules (`lib/ai-marketing-profile/openai-generator.ts:274`, `lib/marketing-planner/openai-planner.ts:463`, `lib/website-analysis/openai-extractor.ts:382`, `lib/content-generator/openai-generator.ts:345`), plus separate inline checks in `lib/command-center/planner.ts:289` and `lib/marketing-agent/planner.ts:194`. Not consolidated in this pass — see §6.
- **No centralized rate-limiting utility.** `lib/interactive-demo/rate-limit.ts` is the only implementation in the repo, living inside a feature folder rather than a shared `lib/security`/`lib/rate-limit` location — nothing stops the next public endpoint from reimplementing its own.

### 3.4 Large files / god-files

- `lib/recommendation-outcomes/service.ts` (770 lines) mixes four concerns: 8 event recorders (lines 82-467), cross-table link resolution (475-554), lifecycle summarization (556-671), and aggregate stats (698-770). Works today; a natural split point before it grows further.
- `lib/publishing/publishingEngine.ts` (646 lines) is a genuine god-file: queueing, scheduling, retry, cancel, verify, execute, and outcome-recording all live in one module (7+ distinct responsibilities). Notably, it does **not** mix in provider-specific logic — that's cleanly isolated in `lib/publishing/providers/` — so splitting it is lower-risk than it looks at first glance.
- `lib/analytics/analyticsEngine.ts` (483 lines) and `lib/marketing-planner/openai-planner.ts` (477 lines) were flagged as large but not found to mix unrelated concerns — lower priority than the two above.

### 3.5 Frontend duplication (the biggest quick-win before Magic UI work)

- **17 independent `SectionCard` implementations** — nearly identical card chrome, one per dashboard page file, never extracted into `components/dashboard/ui/`.
- **10 independent `StatusBadge` implementations** across dashboard components with the same underlying pattern.
- Empty-state markup is inconsistent: some pages correctly use the shared `DashboardEmptyState` (`components/dashboard/ui/dashboard-states.tsx`), others (`approval-queue.tsx`, `command-center-page.tsx`, `gbp-connect-page.tsx`, `publishing-*-panel.tsx`) hand-roll `border-dashed` blocks locally.
- **Estimated 400-600 lines of duplicated JSX** across the 7 largest dashboard pages could be deleted by consolidating into a single `SectionCard`/`StatusBadge`/`EmptyState` primitive set — and Magic's new Dashboard/Marketing/Results/Business shell will need consistent primitives to compose regardless, making this a pure prerequisite, not optional polish.

### 3.6 Naming and vocabulary drift

- `RecommendedActionType` (`lib/marketing-decisions/types.ts`, 8 business actions) vs. `MarketingTaskRecommendedAction` (`lib/marketing-agent/types.ts:5`, 7 UI-navigation actions) — same phrase, unrelated meaning, in two modules a reader would reasonably assume are related.
- `lib/marketing-decisions` — nothing in the directory is actually called a "decision" except `decisionEngine.ts`; the persisted, exported concept throughout is `MarketingRecommendation`. Minor, but adds onboarding friction.
- Two independent, unrelated priority-scoring systems over the same underlying market-context data: `lib/marketing-decisions/scoring.ts` (severity/confidence/time-decay) and `lib/market-context/contextScoringService.ts` (`CATEGORY_PRIORITY` table) — not literal duplication, but a duplicated *concept* ("how important is this signal") that will confuse future unification attempts.

### 3.7 Dependency-injection stragglers

Most services correctly split into `*ForUser(userId, supabase)` + `*ForCurrentUser()` pairs. Two areas don't:

- `lib/content-approval/service.ts:31,41` — `getContentApprovalsForCurrentUser`/`getContentApprovalStatsForCurrentUser` call `createClient()` directly with no injectable counterpart.
- Nearly all of `lib/background-jobs/service.ts` — `queueBackgroundJobForCurrentUser`, `listBackgroundJobsForCurrentUser`, `patchBackgroundJobForCurrentUser`, `getBackgroundJobDashboardDataForCurrentUser` are all cookie-bound only.

**Why it matters:** these specific functions are untestable without mocking `next/headers`, and can't be called from Trigger.dev or admin/service-role contexts — a real constraint given background-jobs is exactly the kind of code that a Trigger.dev migration would want to call directly.

### 3.8 Speculative / premature abstraction

- `PublishingProviders` (`lib/publishing/publishingTypes.ts:4-10`) declares Facebook/Instagram/LinkedIn/Email; `getPublishingProvider` throws "not available yet" for all of them — only Google Business Profile is implemented. Not harmful, but built ahead of need.
- `MarketingPlanner` interface (`lib/marketing-planner/types.ts:130`) has exactly one implementation (`OpenAiMarketingPlanner`). Low-cost, fine for DI/testing, not currently exercised by any real swap.
- A whole "Phase 3" business-preference model (`lib/recommendation-learning/preferences.ts`, `BusinessPreferenceProfile` in `types.ts:60`) was built and tested but has zero callers anywhere outside its own file — never wired into scoring or presentation. Left in place (see §7) pending a decision on whether to finish wiring it in or remove it.

### 3.9 Security findings (only meaningful items)

- **High — spoofable rate-limit key on the public demo endpoint.** `app/api/interactive-demo/route.ts:15-21` and `app/api/interactive-demo/events/route.ts:14-20` derive the rate-limit key from the **first** comma-separated value of `x-forwarded-for`. A client can send its own `X-Forwarded-For` header with an arbitrary/rotating value, which is prepended ahead of the platform's trusted hop — defeating the 5-req/hour cap and enabling unbounded OpenAI cost abuse. The limiter itself (sliding window, `lib/interactive-demo/rate-limit.ts`) is real, not cosmetic; the bug is purely in IP derivation. **Not fixed in this PR** — see §7 and §8 for why, and the recommended follow-up.
- **Low-medium** — the same rate limiter is explicitly in-memory/per-instance by design; on multi-instance serverless this softens the cap further even for non-spoofed traffic.
- **Low** — `lib/google-business/sync.ts:41` constructs `error: error.message` directly instead of routing through `sanitizeUserErrorMessage`, unlike most other services in the codebase — an inconsistent gap, currently low-risk.
- **Low** — the legacy `enc:v1:` token format (`lib/security/token-encryption.ts:67-77`) is plain base64, not encryption. Only relevant if any DB rows still carry v1 tokens; worth confirming a migration ran.
- No findings on OAuth CSRF/state, token encryption/refresh, admin route auth, or signed-link construction — all confirmed solid by direct reading, not just doc trust.

### 3.10 Documentation drift

- `docs/PUBLIC_PAGE_INVENTORY.md` and `docs/PUBLIC_WEBSITE_UX_AUDIT.md` lagged the actual code by at least one redesign phase (claiming Features/About/Contact pages and the pre-redesign primary nav were current, when the Phase 1 homepage redesign had already shipped both). **Fixed in this PR** — see §6.

---

## 4. Project Magic Readiness

Assessed against: simplified navigation, progressive disclosure, multiple customer personas, trust progression, management styles, the Head of Marketing relationship, Marketing Health, and future autonomous workflows.

| Capability | Readiness | Notes |
|---|---|---|
| Simplified navigation / progressive disclosure | **Partial** | Target IA is fully designed (`NAVIGATION_PHILOSOPHY.md`) and the mechanism is real — `focusedDashboardNavHrefs` genuinely narrows nav for early customers (confirmed wired, not aspirational). But the full flat 17-item catalog nav (`components/dashboard/dashboard-nav.tsx`) is still what established customers see. |
| Multiple customer personas, trust progression, management styles | **Not started (by design)** | `management_style`, `trust_stage`, and related concepts have zero occurrences anywhere in `app`/`components`/`lib`. `TRUST_MODEL.md` is a target-state design doc; this is genuinely greenfield schema + backend work, not a rename or wiring task. |
| Head of Marketing relationship / Marketing Health | **Not started (by design)**, but **foundation exists** | `MarketingHealth` has zero code occurrences, but the recommendation pipeline already produces outcome data, adaptive scores, and lifecycle states that a Marketing Health rollup could be built from without re-architecting the pipeline itself. |
| Future autonomous workflows | **Strong primitive layer, execution-surface ambiguity** | Trigger.dev's scheduling/gating primitives (idempotency keys, concurrency keys, the cron gate) are genuinely reusable without a rewrite — the strongest part of this review. But three-plus systems (`recommendation-execution`, `assisted-pilot`, the two live job systems) already touch "autonomous action," and a new autonomous workflow risks being wired into the wrong one. |

**Overall verdict:** The functional core is solid enough to build Magic on top of. The real prerequisite work is **consolidation** (three recommendation surfaces → one; two job systems → one; card/badge UI primitives), not a rewrite of any single system. Trust Model and Marketing Health are correctly scoped as new work, not migration work.

---

## 5. Information Architecture — Page-by-Page Recommendation

Current authenticated IA is a flat, feature-catalog sidebar that accurately matches what `docs/AUTHENTICATED_UX_AUDIT.md` already describes (that audit is *not* stale — only the two public-site docs listed in §3.10 were). Recommended fate per page, following the already-written target constitution in `NAVIGATION_PHILOSOPHY.md`/`DASHBOARD_PHILOSOPHY.md`:

| Current page | Recommended fate |
|---|---|
| Command Center | Rename/merge → "Dashboard" home |
| Today's Tasks | Merge into Dashboard "needs your attention" |
| Approval Center | Keep → becomes the "Marketing" hub |
| Publishing | Fold under Marketing, advanced mode |
| Google Business Profile | Fold under "Business" |
| Website Analysis | Advanced mode under Business |
| Brand Voice | Rebuild (currently mock controls) or hide until real |
| AI Profile | Rename "Marketing Profile," fold under Business |
| Marketing Plan | Fold under Marketing — pending the §3.1 consolidation decision |
| Marketing Recommendations | Keep, feeds Marketing — pending the §3.1 consolidation decision |
| Content / Content Generator | Merge with each other (overlaps Approvals) |
| Reviews | Fold under Marketing/Results |
| Market Context | Advanced mode / hide under Business |
| Analytics | Subordinate to Marketing Health, under Results |
| Notifications | Placeholder — remove from nav until real |
| Billing | Placeholder — remove from nav until real |
| Settings | Fold into "Business"/Account |
| `/dashboard/[section]` catch-all | Delete once stray-link references are confirmed clear (see §6) |
| Admin Ops | Keep, admin-only, expand per `NAVIGATION_PHILOSOPHY.md` |
| Industries, For Agencies | Keep in footer/secondary — not primary customer or public nav |

---

## 6. Cleanup Performed In This PR

All items below are additive or subtractive-only with no behavior change for any real request path; each was individually verified to have zero external references before being touched.

- **Removed dead code:**
  - `components/dashboard/reviews-page.tsx` (superseded by `reviews-hub-page.tsx`, zero remaining imports)
  - `components/home/home-sections.tsx`, `components/feature-grid.tsx`, `components/ajn-header-logo.tsx` (orphaned — zero imports anywhere, including tests)
  - `BasePublishingProvider.buildInputFromQueueItem` (`lib/publishing/providers/basePublishingProvider.ts`) — unused; `publishingEngine.ts` builds the same shape inline instead
- **Consolidated the 7 `app/api/admin/**` routes' identical inline auth check** into a single shared `requireAdminUser()` helper (`lib/admin/requireAdminUser.ts`), returning the exact same 401/403 JSON shape every route already produced. Two routes (`ops`, `pilot`) had already grown their own local copy of this helper; the other five inlined it directly. No behavior change — same status codes, same JSON bodies.
- **Fixed stale public-site docs**: `docs/PUBLIC_PAGE_INVENTORY.md`'s page table claimed Features/About/Contact were "Missing" despite the same document's own banner noting they'd shipped, and despite the pages existing in code (`app/features`, `app/about`, `app/contact`) — corrected. `docs/PUBLIC_WEBSITE_UX_AUDIT.md` got a dated note clarifying its "Primary nav" section describes the pre-redesign site and pointing to the current source of truth (`lib/site-content.ts`).

### Deliberately NOT done in this pass (see §7 and §8)

- `components/home/hero-trust-bar.tsx` and `components/home/stats-strip.tsx` are **not** rendered by any page (superseded by `homepage-sections.tsx`), but `unit-tests/public-website-ux-audit-fixes.test.ts` directly reads their file content via `readFileSync` and asserts on it. Deleting them would break that test. This is real test/code drift worth fixing, but fixing it means changing what the verification suite asserts — out of scope for a review pass that must leave test behavior untouched. Flagged here for a dedicated follow-up.
- The `isOpenAIConfigured`-style one-liner duplicated across 4 modules (§3.3) was evaluated for consolidation and declined: each is an independently-meaningful "is OpenAI configured for *this* feature" flag with its own name; unifying 4 one-line function bodies behind a shared import adds a cross-module dependency for near-zero line-count benefit. Documented instead of executed.
- The interactive-demo rate-limit IP-spoofing bug (§3.9) was **not** patched here — see §8.

---

## 7. Items Intentionally Left Alone

- **The two live job/queue systems** (`background_jobs` + Trigger.dev) — already a documented, staged migration (`ADR_AUTONOMOUS_SCHEDULER.md`), not accidental drift. Finishing that migration is real, behavior-affecting work outside this review's scope.
- **`lib/recommendation-learning/preferences.ts`'s unused preference model** — large enough (a full "Phase 3" subsystem, not a stray function) that deleting it is a product decision (finish wiring it, or retire it), not a safe mechanical cleanup.
- **`getRecommendationOutcomeStatsForUser`/`summarizeRecommendationOutcomeForCurrentUser`** (`lib/recommendation-outcomes/service.ts`) — unused today, but explicitly documented in `RECOMMENDATION_OUTCOME_FEEDBACK_LOOP.md` §16 as "built for a future milestone." Intentional, not dead code.
- **The three secret-redaction blocklists, the alert-computation duplication, and the three logging conventions** (§3.3) — each individually low-risk to read, but reconciling them safely means verifying no observable log/alert output changes anywhere, which is a real verification effort belonging to its own PR, not a drive-by fix bundled into an architecture-review branch that promises no behavior changes.
- **The `google-business`/`google-business-profile` split and the three-tier publishing status model** (§3.2) — real architectural friction, but resolving either is a multi-file, behavior-affecting restructure, explicitly out of scope ("do NOT redesign major systems").
- **The speculative multi-provider publishing abstraction and single-implementation `MarketingPlanner` interface** (§3.8) — low ongoing cost, no urgency to remove.

---

## 8. Risk Assessment & Recommended Priorities

Ordered by (impact if ignored) × (how much harder it gets to fix later):

1. **Decide the fate of the three "what to do next" systems** (Recommendations/Approvals, Tasks, Marketing Plan) plus Assisted Pilot's relationship to them, *before* any Project Magic IA work starts. Highest impact, and the one item that gets structurally harder to unwind the longer all three stay live and accumulate more customer data/history tied to each.
2. **Patch the interactive-demo rate-limit IP-spoofing bug** (§3.9) in a dedicated, tested security PR. This is the one finding in this review that is an active, exploitable gap (unbounded OpenAI cost exposure on a public endpoint) rather than a maintainability concern — it should not wait for a broader security pass.
3. **Consolidate the dashboard `SectionCard`/`StatusBadge`/empty-state primitives** (§3.5). Pure prerequisite for Magic's new shell; doing it now is strictly cheaper than doing it while also reshaping the IA.
4. **Finish or retire the two-job-system migration** and the `google-business`/`google-business-profile` split — both real, both bounded, neither urgent enough to block Magic but both will cost more the longer new code is layered on top of either seam.
5. **Reconcile the duplicated ops/alerting/logging infrastructure** (§3.3) — lower urgency (internal-only surface), but the false-confidence risk from `workflow-validation`'s always-green harness and the silently-dead `analyticsBacklogCount` alert deserve a fix before anyone builds a new autonomous workflow that depends on trusting those signals.
6. **Split `recommendation-outcomes/service.ts` and `publishing/publishingEngine.ts`** along their already-visible seams (§3.4) — lowest urgency; do opportunistically the next time either file needs a real change.

---

## 9. Verification

Run against this branch (`architecture-foundation-review`) after the cleanup in §6:

- `npm run lint` — clean
- `npx tsc --noEmit` (production build's type check) — clean
- `npm run test:unit` — full suite passing (see PR for exact counts)
- `npm run build` (production build) — succeeds
- `npx playwright test` — passing

Confirmed:

- No customer-facing behavior changes.
- No authenticated UX changes.
- No public UX changes.
- `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains `false`.
- No Trigger.dev schedules activated; no Trigger.dev task definitions modified.

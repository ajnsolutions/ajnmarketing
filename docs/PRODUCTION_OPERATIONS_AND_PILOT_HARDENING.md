# Production Operations and Pilot Hardening

**Project Magic Phase 3C.** Makes the existing system observable, diagnosable, recoverable, and pilot-ready — without adding a second operations platform, a second readiness framework, or a second job system.

## Objective

Before this phase, an operator could not answer "is this specific tenant healthy," "which jobs are stuck," or "is the platform actually ready for a pilot" without hand-querying the database. This phase composes the **already-mature** production-readiness, assisted-pilot, ops-dashboard, background-job, publishing, and Trigger.dev systems into richer, actionable views, and adds the few genuinely missing capabilities (per-tenant health, stuck-job detection, tiered health endpoints, a centralized config validator, and a safe cross-tenant retry action) on top of them.

## Architecture audit summary

Everything below already existed before this phase and was extended, not replaced:

| System | Location | Status |
|---|---|---|
| Ops dashboard | `/dashboard/admin/ops`, `app/api/admin/ops/route.ts`, `lib/ops-dashboard/service.ts` | Extended with 3 new views |
| Assisted-pilot readiness/scoring/checklist/issues | `lib/assisted-pilot/*` | Untouched — remains the single pilot-launch scoring model |
| Background job system | `lib/background-jobs/*`, migration 011 | Untouched — new admin retry route reuses its existing safe primitives |
| Trigger.dev tasks + schedule gate | `trigger/*.ts`, `lib/trigger/scheduleActivation.ts` | Untouched — `ATTACH_DECLARATIVE_PRODUCTION_CRONS` still gates all 3 sweeps |
| Publishing queue/retry/history | `lib/publishing/*`, migration 013 | Untouched |
| Signed approval links | `lib/weekly-approval-package/signedLinks.ts` | Untouched |
| Google Business connection health | `lib/google-business-profile/service.ts` | Untouched — reused by tenant health |
| Failure injection | `lib/failure-injection/gate.ts` | Untouched |
| Runbooks | `docs/RUNBOOKS.md` | Extended with 9 new sections |

Real gaps found and filled:

1. **No per-tenant operational health view** — `buildOpsDashboardSummary` was aggregate-only across all tenants. Added `lib/ops-dashboard/tenantHealth.ts` + `tenantHealthClassify.ts`.
2. **No stuck-job detection** — `background_jobs` had status/attempts but nothing classified "queued too long." Added `lib/ops-dashboard/jobLifecycle.ts`.
3. **No cross-tenant admin retry** — the only existing retry paths were customer-self-service (`/api/jobs` PATCH, scoped to the caller) or pilot-tenant-scoped (`executePilotManualAction`, requires prior pilot registration). Added `POST /api/admin/ops/jobs/[id]/retry`.
4. **No tiered health endpoints** — `/api/health` was already liveness-appropriate (no DB call) but there was no readiness tier with a real, bounded DB probe. Added `GET /api/health/ready`.
5. **No centralized, allowlisted config validator** — env checks were correct but scattered across `production-health/service.ts`, `google-business-profile/config.ts`, and `weekly-approval-package/signedLinks.ts`. Added `lib/config/validate.ts` as a single typed reference (existing checks were left in place, not risked — see Configuration validation below).
6. **No richer readiness status vocabulary** — the existing health model is a flat healthy/warning/critical scale, which is correct but coarse. Added `lib/production-readiness/model.ts`, which **composes** (never re-derives) the existing checks into the richer status set the operator actually needs (Ready / Ready with warnings / Needs attention / Blocked / Not configured / Degraded / Unknown / Intentionally disabled), plus per-item impact/recovery/blocks-pilot/blocks-schedule-activation metadata.

## Authoritative readiness model

`lib/production-readiness/model.ts` → `buildProductionReadinessSummary()`. This is **not** a second score. It:

- Calls the existing `runProductionHealthChecks()` unchanged and maps its healthy/warning/critical checks onto the richer status vocabulary.
- Calls the new `validateServerConfig()` for allowlisted-key presence/malformed detection.
- Calls the new `checkMigration031Applied()` for a bounded, non-destructive schema probe.
- **Accepts, but never recomputes,** the assisted-pilot `aggregateReadiness.total` / `launchRecommendation` as a pass-through pointer (`pilotReadiness` field) — the pilot launch score remains solely owned by `lib/assisted-pilot/readiness.ts`.

Every item carries: `key`, `category`, `label`, `status`, `reason`, `impact`, `recoveryAction`, `blocksPilot`, `blocksScheduleActivation`, `lastCheckedAt`, `evidenceSource`, `severity`, optional `technicalDetail`, optional `runbookRef`. Categories: platform configuration, database, migrations, authentication, Google OAuth, connection storage/encryption, Trigger.dev, schedule attachment, analytics, publishing, recommendation pipeline, approval links, email delivery, customer setup, pilot operations.

Overall status is the worst status present, per a documented severity order (`READINESS_SEVERITY_ORDER` in `lib/production-readiness/types.ts`).

## Platform readiness

Surfaced via `GET /api/admin/ops?view=readiness` (admin-only) and the Ops Dashboard's "Production readiness" panel, with a "Revalidate now" button that re-runs the same composition on demand (no caching, no risk of stale-but-shown-fresh data).

## Tenant operational health

`lib/ops-dashboard/tenantHealth.ts` (I/O) + `lib/ops-dashboard/tenantHealthClassify.ts` (pure, unit-tested). Bounded and paginated (`?view=tenants&page=&pageSize=&q=`, default page size 20, max 50). For each tenant on the current page:

- **Setup** — from the Phase 3B `getCustomerSetupSnapshotForUser` snapshot (never re-derived).
- **Google Business connection** — from the existing `getGoogleBusinessProfileConnectionStatusForUser`. Never-connected is `intentionally_unused` (not a failure); globally unavailable (OAuth not configured) is `unavailable` (distinct from a customer simply not connecting); a connection that regressed from connected to expired/revoked/error is `warning`.
- **Publishing queue** — failed jobs block the dimension; retrying jobs warn; otherwise healthy.
- **Approvals** — pending-but-not-overdue is healthy; pending past `APPROVAL_OVERDUE_HOURS` (7 days, a documented constant) is a warning.
- **Background jobs** — any failure in the last 24h is a warning.

**Query shape:** one paginated `business_profiles` query, plus batched single `IN()` queries for publishing/approval/job-failure counts across the whole page, plus per-tenant calls to the two existing services that don't have batch equivalents (`getCustomerSetupSnapshotForUser`, `getGoogleBusinessProfileConnectionStatusForUser`) — bounded to page size, not the full tenant table.

## Job lifecycle

`lib/ops-dashboard/jobLifecycle.ts`. Stuck-job thresholds are documented constants, not tuned guesses: queued ≥ 30 minutes, running ≥ 15 minutes (`STUCK_QUEUED_THRESHOLD_MINUTES` / `STUCK_RUNNING_THRESHOLD_MINUTES`). Detection is bounded to the last 7 days and 200 rows.

**Retry-safety classification** (`classifyRetrySafety`):

- `safe_and_idempotent` — job types that only regenerate/refresh internal state (website analysis, marketing plan generation, AI task generation, GBP sync, content generation, review-reply generation, social syncs, analytics capture, opportunity detection, recommendation pipeline). No external side effect to duplicate.
- `requires_operator_review` — always for `publishing_execute` (a real external provider side effect — duplicate-publish risk), and for any job that has exhausted `MAX_BACKGROUND_JOB_ATTEMPTS` (3) even if otherwise idempotent.
- `not_retryable` — anything not currently `failed`/`cancelled`.

This classification is display/gating logic only — it never bypasses `resetBackgroundJobForRetry`'s own DB-level guard (`status in ('failed','cancelled')`).

## Retries and recovery

`POST /api/admin/ops/jobs/[id]/retry` — admin-only, cross-tenant. Reuses the **exact same** `resetBackgroundJobForRetry` primitive the existing customer-self-service `PATCH /api/jobs` endpoint uses (no new retry mechanism). Flow:

1. `requireAdminUser()` — 401/403 on failure.
2. Service-role lookup of the job by id (admin doesn't know the owning tenant in advance).
3. `classifyRetrySafety()` on the current record.
4. `not_retryable` → 409, no state change.
5. `requires_operator_review` without `confirmOperatorReview: true` in the body → 409 with an explanatory message; the UI requires an explicit second confirmation click.
6. Otherwise: `resetBackgroundJobForRetry` (idempotent — a second call after a status change is a no-op, returned as `{ retried: false }`, never an error), an `audit_logs` entry via the existing `logAuditEvent`, and `scheduleBackgroundJobProcessing` to actually re-run it through the normal worker path.

No "retry everything" action exists. No publishing retry can occur without the explicit operator-review confirmation step.

## Audit events

No migration was added for this. `audit_logs` (migration 010) already has `user_id` (tenant), `business_profile_id`, `action`, `entity_type`, `entity_id`, `status`, `metadata` (jsonb), `created_at` — sufficient to record actor (stored in `metadata.triggeredByAdmin`), before/after status (via `metadata`), and correlation. The new retry route writes one `BACKGROUND_JOB_QUEUED` event per retry with `retry: true, triggeredByAdmin: <admin user id>, retrySafety: <classification>`.

## Migration decision

**No new migration.** Every new capability in this phase reads existing tables (`business_profiles`, `customer_setup_preferences`, `publishing_jobs`, `content_approvals`, `background_jobs`, `audit_logs`) or calls existing services. Migration 031 remains the most recent migration; migrations 001–031 are unchanged.

## Health endpoints

Three tiers, matching what infrastructure actually needs:

- **Liveness** — `GET /api/health` (unchanged). Already correct for this tier: no database call, fast, public, safe for infra checks. Returns 503 only on `critical` (config-level) failures.
- **Readiness** — `GET /api/health/ready` (new). Public (infra readiness probes generally can't authenticate, and this endpoint exposes no sensitive data), bounded (2s timeout per probe), performs a real database reachability check plus the migration-031 schema probe. Returns `ready` / `degraded` (confirmed migration gap — 503) / `unknown` (ambiguous probe result — 200, to avoid a restart loop on transient uncertainty) / `unavailable` (DB unreachable — 503) / `not_configured`.
- **Deep diagnostics** — `GET /api/admin/ops?view=health` (existing, admin-only, includes a live DB probe) and the new `?view=readiness` / `?view=jobs` (includes best-effort live Trigger.dev subsystem health via the previously-unwired `getAutonomousSchedulingHealth`, only attempted when `TRIGGER_SECRET_KEY` is present, always wrapped so a Trigger.dev outage degrades to `null` rather than breaking the response).

## Configuration validation

`lib/config/validate.ts` — a single allowlisted list of every server config key this app actually reads, each tagged `required` / `optional` / `conditionally_required` and an environment scope. Reports presence and, for URL-shaped values, well-formedness — **never** the value itself. This does not replace or risk `lib/production-health/service.ts`'s existing (unit-tested, already-shipped) env checks; it is an additive, more structured view consumed by the new readiness model.

## Migration readiness

`lib/production-readiness/migrationCheck.ts` → `checkMigration031Applied()`. A single bounded `select ... limit(0)` against `customer_setup_preferences`, classifying `42P01`/`PGRST205`/"does not exist" as a confirmed-missing migration versus any other error as ambiguous ("unknown," never a false "not applied"). No schema is ever dumped or exposed beyond applied/not-applied.

## Google Business operational health

Unchanged (`lib/google-business-profile/service.ts` already fully distinguishes not-connected / connected / expired / revoked / error / globally-unavailable). Reused as-is for the new per-tenant health view; no new connection states were invented.

## Analytics freshness

Not separately re-modeled in this phase beyond what the existing `analytics_queue` ops section and per-tenant `background_jobs` failure count already surface — see **Known limitations** below.

## Recommendation pipeline health

Unchanged logic; visibility only. The new `?view=jobs`'s Trigger.dev subsystem data (when available) shows last-run/last-success/last-failure/next-scheduled-run for `recommendation-pipeline-sweep` and `recommendation-pipeline-for-tenant`, sourced from the pre-existing (previously unwired) `getAutonomousSchedulingHealth`.

## Publishing health

Unchanged retry/backoff logic (`lib/publishing/retryManager.ts`). The new retry-safety classification explicitly marks every `publishing_execute` background job as `requires_operator_review` so a duplicate-publish risk can never be one click away.

## Approval flow health

Unchanged (`lib/weekly-approval-package/signedLinks.ts` already has HMAC signing, expiry, and tamper protection). Approval-link configuration state is folded into the new readiness model's `approval_links` item.

## Failure injection

Unchanged (`lib/failure-injection/gate.ts` already triple-gates: `FAILURE_INJECTION_ENABLED`, non-production `NODE_ENV`/`VERCEL_ENV`, and the cron gate itself). No new endpoint was added to toggle it at runtime — deliberately: it is env-controlled by design, and adding an API to flip it would weaken the "unavailable in production" guarantee the existing triple-gate provides.

## Pilot activation checklist

Platform:
- [ ] `?view=readiness` shows no `blocked` items (`summary.blockers` empty)
- [ ] Migrations 001–031 applied (`migration_031` item Ready)
- [ ] `GET /api/health` and `GET /api/health/ready` both return a non-critical status
- [ ] `ADMIN_USER_IDS` set to the correct operator allowlist
- [ ] `ATTACH_DECLARATIVE_PRODUCTION_CRONS` is `false` in the deployed build
- [ ] CI green on the PR that will merge to `main`
- [ ] Production build verified locally (`npm run build`)

Tenant (per pilot candidate, via `?view=tenants` search):
- [ ] `setup` dimension healthy (required steps complete)
- [ ] `google_business` dimension is healthy or `intentionally_unused` (never treat disconnected-but-unused as a blocker)
- [ ] `publishing` dimension healthy (no failed jobs)
- [ ] `approvals` dimension has no overdue items
- [ ] `background_jobs` dimension has no recent failures

Operations:
- [ ] Ops Dashboard reviewed end-to-end by the on-call operator
- [ ] A manual job retry has been exercised at least once in a non-production environment
- [ ] Runbooks (`docs/RUNBOOKS.md`) reviewed by whoever is on support during the pilot
- [ ] A support owner and rollback owner are named
- [ ] Pilot tenant selected via the existing assisted-pilot registration flow
- [ ] Success criteria documented in the pilot issue tracker

Schedule activation (separate from pilot activation — do **not** bundle these):
- [ ] Manual triggering of all three sweep tasks has been exercised
- [ ] Idempotency and concurrency keys verified (already implemented in `trigger/*.ts` — confirm via a manual double-trigger test)
- [ ] Failure-recovery runbooks reviewed
- [ ] Explicit operator approval recorded (outside this codebase — e.g. a signed-off checklist or ticket)
- [ ] Rollback runbook (`docs/RUNBOOKS.md#rollback-after-schedule-activation`) reviewed
- [ ] A human still must change `ATTACH_DECLARATIVE_PRODUCTION_CRONS` to `true` in a reviewed commit and deploy it — **completing this checklist does not do this automatically, and nothing in this codebase can flip that constant on its own.**

## Schedule activation readiness

Audited in this phase, unchanged:

- `ATTACH_DECLARATIVE_PRODUCTION_CRONS = false` in `lib/trigger/scheduleActivation.ts` (verified — see Adversarial review below).
- All three sweep tasks (`analytics-capture-sweep`, `publishing-due-sweep`, `recommendation-pipeline-sweep`) spread `...declarativeProductionCron(taskId)`, which contributes `{}` (no `cron` field at all) while the gate is closed — confirmed no task bypasses this.
- Intended production cron values, unchanged: `analytics-capture-sweep` `0 6 * * *`, `publishing-due-sweep` `5 * * * *`, `recommendation-pipeline-sweep` `0 14 * * *`, all UTC.
- Manual triggering (`tasks.trigger(...)` from admin routes and assisted-pilot manual actions) remains available regardless of the gate — this is intentional and unchanged.
- No environment override, alternate schedule mechanism, Vercel cron, database cron, or GitHub Actions schedule exists anywhere in the repository (confirmed by grep — see Adversarial review).

## Manual pilot mode

Unchanged (`lib/assisted-pilot/manualActions.ts`'s `executePilotManualAction`, allowlisted to `PilotManualActionKeys`: website analysis, recommendation pipeline trigger, weekly package generation, a specific publishing job by id, analytics capture trigger, outcome reconciliation, health refresh). No new manual action keys were added in this phase. The new admin job-retry endpoint is a distinct, non-pilot-scoped capability for operators recovering any tenant's stuck job during support, not a replacement for pilot manual actions.

## Logging

Unchanged conventions (`lib/observability/workflowLogger.ts`'s `logWorkflow`/`sanitizeWorkflowMetadata`, already strips `access_token`/`prompt`/`content`/etc. from logged metadata). New code follows the same pattern — no new logging provider, no secrets logged.

## Alert conditions

Unchanged (`lib/production-alerts/evaluate.ts`'s `evaluateOpsAlerts` — publishing failures, OAuth disconnects, high-retry jobs, etc.). Not modified in this phase; the new readiness/tenant-health views are complementary, more granular signals, not a replacement alert system.

## Customer degraded-state behavior

Unaffected by this phase — all new code lives under `/dashboard/admin/*` and `/api/admin/*`, both admin-gated. No customer-facing page or component was modified.

## RLS and tenant isolation

All new I/O goes through either (a) the existing `requireAdminUser()` gate plus a service-role client (admin ops surfaces, which by design see across tenants), or (b) existing per-user-scoped service functions that already enforce RLS/ownership (`getCustomerSetupSnapshotForUser`, `getGoogleBusinessProfileConnectionStatusForUser`). No new client-supplied tenant/business ID is ever trusted — the retry endpoint resolves the job's owner server-side from the job record itself, never from client input.

## Accessibility

New panels use semantic lists, visible status text (never color-only — status pills always pair a color ring with a text label), `role="status"`/`role="alert"` for live feedback, `aria-live="polite"` on the retry-result message, associated `<label htmlFor>` (with `sr-only` visual hiding, not `aria-label` alone) on the tenant search input, and `min-h-11` touch targets throughout, reusing the Phase 3A/3B conventions.

## Mobile

All new panels use `flex-col gap-2 sm:flex-row` stacking and card-based (not wide-table) layouts, consistent with the existing dashboard patterns — verified via the Playwright assertions in `tests/production-operations.spec.ts`.

## Performance

Tenant health is paginated (default 20, max 50) with batched count queries; stuck-job detection is bounded to 7 days / 200 rows; the readiness model makes no new database queries beyond the existing health-check DB probe plus one bounded migration probe. No new caching was introduced (each admin request computes fresh data — safe, since these are low-traffic admin-only surfaces, and avoids any tenant-data cache-key bug).

## Non-goals confirmed

No changes to Marketing Director logic, recommendation ranking/scoring, Campaign Intelligence, Experimentation, Decision Intelligence (still read-only), Strategic Calendar (still read-only), Marketing Memory, OAuth architecture, billing, or the public marketing site. No LLM, ML, or provider was added. No autonomous action, campaign/experiment creation, auto-approval, or auto-publishing was added.

## Known limitations

- Analytics freshness is not separately modeled beyond the existing `analytics_queue` ops-summary counts and per-tenant job-failure signal — a dedicated freshness-threshold state machine (fresh/aging/stale/capture-failed) was judged out of scope for this pass given the size of everything else in this phase; flagged as deferred debt below.
- Tenant health's two per-tenant service calls (`getCustomerSetupSnapshotForUser`, `getGoogleBusinessProfileConnectionStatusForUser`) are not batched — bounded by pagination (≤50 tenants/page) but still O(page size) round trips, not O(1).
- No authenticated admin session was available in this environment — see the smoke checklist below; UI behavior beyond static source assertions is unverified live.
- `?view=jobs`'s Trigger.dev subsystem data requires `TRIGGER_SECRET_KEY`; without it, the field is `null` (not an error) and the panel shows no subsystem detail.

## Deferred operational debt

- Dedicated analytics-freshness state machine (never captured / fresh / aging / stale / capture pending / capture failed) with documented thresholds.
- Batch (single-query) tenant health for setup snapshots and GBP connection status, if the tenant list grows large enough for per-page latency to matter.
- A dedicated alert-deduplication/resolution-state layer (today's `evaluateOpsAlerts` is stateless per request).
- Richer multi-user/team role support once (if) team accounts ship — tracked already in `docs/GUIDED_ONBOARDING_AND_SETUP.md`.

## Authenticated smoke checklist

No authenticated admin session was available in this environment. Do not treat the UI as verified beyond the static-source Playwright assertions in `tests/production-operations.spec.ts`. An operator with real admin credentials should:

1. Sign in as an `ADMIN_USER_IDS` member; open `/dashboard/admin/ops`.
2. Confirm the "Production readiness" panel loads with a non-empty item list and a "Revalidate now" button that updates the timestamp on click.
3. Confirm the "Tenant operational health" panel loads, search works, and Previous/Next pagination is disabled/enabled correctly at the boundaries.
4. Confirm the "Stuck jobs" panel shows "No stuck jobs detected" on a clean environment (or real stuck jobs, if present).
5. If a real failed, idempotent-type job exists: click Retry, confirm it disappears from the list and a success message appears.
6. If a real failed `publishing_execute` job exists: click Retry, confirm the "requires operator review" confirmation step appears before the second click, and cannot be bypassed.
7. Confirm `GET /api/health` and `GET /api/health/ready` both respond correctly from a browser or curl.
8. Confirm `GET /api/admin/ops?view=jobs` includes `triggerSubsystems` data only when `TRIGGER_SECRET_KEY` is configured.
9. Resize to 768px, 390px, 375px, 320px — confirm no horizontal overflow on any new panel.
10. Confirm `ATTACH_DECLARATIVE_PRODUCTION_CRONS` is `false` in the deployed environment (via `?view=readiness`'s `schedule_attachment` item).

## Production deployment checklist

See **Pilot activation checklist** above (Platform section) — the same items apply before any production deploy of this branch. This phase adds no new environment variables and no migration, so the deployment surface area is limited to the new routes/components themselves.

## Rollback checklist

This phase is additive (new files + two extended existing files: `app/api/admin/ops/route.ts`, `components/dashboard/admin-ops-dashboard.tsx`, `app/dashboard/admin/ops/page.tsx`). To roll back:

1. Revert the merge commit for this PR.
2. No migration to reverse (none was added).
3. No environment variables to unset (none were added).
4. Confirm `/dashboard/admin/ops` still loads with the pre-Phase-3C section set.

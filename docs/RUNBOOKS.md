# Operational Runbooks

Internal procedures for AJN Marketing. Prefer the admin Ops Dashboard (`/dashboard/admin/ops`) and existing admin trigger APIs. Do **not** flip `ATTACH_DECLARATIVE_PRODUCTION_CRONS` from these runbooks.

Project Magic Phase 3C added: `/api/admin/ops?view=readiness` (platform readiness), `?view=tenants` (per-tenant health), `?view=jobs` (stuck-job detection), and `POST /api/admin/ops/jobs/[id]/retry` (admin-authorized retry). See `docs/PRODUCTION_OPERATIONS_AND_PILOT_HARDENING.md` for the full model.

---

## Publishing failures

1. Open Ops Dashboard → Publishing Failures / Retry Queue.
2. Note `last_error` (sanitized). Common causes: GBP locations missing, OAuth expired, provider rejection.
3. For a single tenant: open Publishing dashboard as that user (or impersonation process if available).
4. If OAuth-related → follow **OAuth reconnect**.
5. If content issue → reject/edit in Approval Center; cancel the job.
6. Retry only via explicit UI/API action — never by reloading pages (GET publishing is read-only).
7. If many failures: pause assisted publishes; check Google API status / quotas.

## OAuth reconnect

1. Ops Dashboard → OAuth Connection Health (non-connected count).
2. As the tenant: `/dashboard/google-business-profile/connect`.
3. Complete Google consent; confirm `connection_status = connected`.
4. Sync locations/reviews.
5. Re-attempt publish explicitly.
6. If refresh token revoked: disconnect (if working) / clear connection row via supported UI, then reconnect.

## Recommendation stuck

1. Check Marketing Recommendations UI for `open` / `in_progress` states.
2. Admin: `POST /api/admin/trigger-recommendation-execution` with target `userId` (allowlisted admin session).
3. Or run full pipeline: `POST /api/admin/trigger-recommendation-pipeline`.
4. If draft exists but recommendation stuck: inspect unique constraints / reused draft path (idempotent reuse is expected).
5. Do not duplicate-fire sweeps while a tenant run is in progress (concurrency keys exist).

## Analytics backlog

1. Ops → Analytics Queue notes / audit failures.
2. Admin: `POST /api/admin/trigger-analytics-capture` for the tenant.
3. Confirm snapshot upsert (one row per user+date).
4. If Google insights missing: ensure GBP connected and sync succeeded.

## Email / weekly package failures

1. Confirm signing secrets configured (`EMAIL_ACTION_TOKEN_SECRET` / fallbacks).
2. Use `/api/weekly-approval-package/preview` (authenticated) — never expect outbound send yet.
3. If open links fail: check expiry, tenant mismatch, login `next` redirect.
4. One-click execute failures: verify session user matches token `userId`; check approval still pending.

## Trigger.dev outage

1. Admin one-off triggers will fail if `TRIGGER_SECRET_KEY` / Trigger API is down.
2. Core domain logic can still be exercised via injectable services in controlled scripts (`scripts/audit/*`) when appropriate.
3. Keep cron gate closed — outage must not tempt emergency schedule flips without review.
4. Communicate assisted-mode delay to pilot operators.

## OpenAI outage

1. Draft generation / agents fail closed with sanitized errors.
2. Pause content generation; keep approvals/publishing of already-drafted content available.
3. Optional non-prod: `FAILURE_INJECTION_FAULTS=openai_outage` to rehearse UX.
4. Resume when provider recovers; re-run recommendation execution for affected tenants.

## Emergency disable

1. Ensure `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains false.
2. Remove/rotate `TRIGGER_SECRET_KEY` temporarily to stop new task triggers if needed.
3. Disable `ADMIN_USER_IDS` entries if admin triggers are abused (coordinate first).
4. Do **not** set `FAILURE_INJECTION_ENABLED=true` in production.
5. Vercel: rollback to last known-good deployment.

## Rollback

1. Identify prior deployment in Vercel.
2. Rollback frontend/app deploy.
3. Database: prefer forward-fix migrations; only roll back schema with an explicit plan.
4. Re-run `/api/health` and Ops Dashboard workflow validation.
5. Notify operators; re-run smoke tests from `LAUNCH_CHECKLIST.md`.

---

## Migration 031 not applied

**Symptoms:** Ops Dashboard → Production readiness shows `migration_031` as Blocked; `/dashboard/setup` redirects to `/onboarding` for users who should be past onboarding; `GET /api/setup/status` returns 404.
**Impact:** Guided setup, the dashboard setup card, and Head-of-Marketing readiness gating all depend on `customer_setup_preferences`. Blocks pilot and schedule activation.
**Confirm:** `GET /api/admin/ops?view=readiness` (admin) → `migration_031` item; or `GET /api/health/ready` → `migration031Applied: false`.
**Recovery:** Apply `supabase/migrations/031_customer_setup_preferences.sql` to the affected environment through the normal migration pipeline. Do not hand-edit the table; do not apply directly to production outside the deploy process.
**Verify:** Re-run readiness (`?view=readiness` or the dashboard's "Revalidate now" button) — `migration_031` should show Ready.
**Escalate:** If the migration fails to apply (constraint conflict), stop and involve someone with schema history context before retrying.

## Supabase unavailable

**Symptoms:** `/api/health` and `/api/health/ready` both report failure; most authenticated pages fail to load.
**Impact:** Full outage — nothing tenant-facing works without the database.
**Confirm:** `GET /api/health/ready` returns `status: "unavailable"`.
**Immediate containment:** Confirm this is not a Supabase-side incident (check Supabase status page) before assuming a config issue.
**Recovery:** If config-related, verify `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SECRET_KEY` are set correctly for this environment. If Supabase-side, wait and monitor; do not retry destructive operations during an upstream outage.
**Escalate:** Page whoever owns the Supabase project if the outage exceeds a few minutes.

## Secret key missing

**Symptoms:** Ops Dashboard shows "Ops summary unavailable"; `/api/admin/ops` (any view) returns 503; Trigger.dev tasks and admin triggers fail.
**Impact:** Admin ops tooling and Trigger.dev tasks lose cross-tenant database access. Customer-facing pages are unaffected (they use per-user RLS-scoped access, not service-role).
**Confirm:** `GET /api/admin/ops?view=readiness` → `database` item reason mentions `SUPABASE_SECRET_KEY`.
**Recovery:** Set `SUPABASE_SECRET_KEY` in the deployment environment from the Supabase project's service-role key. Never log or paste this value into a runbook, ticket, or chat.
**Verify:** Reload the Ops Dashboard; queue/subsystem sections should populate.

## Token encryption configuration missing

**Symptoms:** Google Business connect fails after OAuth consent; weekly approval links fail to mint (unless a dedicated `WEEKLY_APPROVAL_LINK_SECRET` is set).
**Impact:** Blocks Google Business token storage. Does not block core Head of Marketing usage.
**Confirm:** Ops Dashboard readiness → `encryption` item Needs attention.
**Recovery:** `openssl rand -hex 32`, set as `TOKEN_ENCRYPTION_KEY`.
**Verify:** Attempt a Google Business connection in a test account; confirm `connection_status = connected`.

## Trigger.dev unavailable

**Symptoms:** Admin trigger routes (`/api/admin/trigger-*`) return errors; `?view=jobs` shows `triggerSubsystems: null`.
**Impact:** Manual pipeline/analytics/publishing triggers stop working. Nothing in the customer-facing app depends on Trigger.dev being reachable at request time (schedules remain gated regardless).
**Confirm:** Ops readiness → `trigger_dev` item; or attempt any `/api/admin/trigger-*` route.
**Recovery:** Verify `TRIGGER_SECRET_KEY` and Trigger.dev platform status. This is not an emergency — no autonomous behavior depends on it while the cron gate is closed.
**Escalate:** Only if pilot operators need to run manual actions and are blocked.

## Schedule attached accidentally

**Symptoms:** Ops readiness → `schedule_attachment` shows Blocked; `ATTACH_DECLARATIVE_PRODUCTION_CRONS` reads `true` somewhere in a deployed environment.
**Impact:** Severe — autonomous production sweeps could begin executing without an approved activation.
**Immediate containment:** Set `ATTACH_DECLARATIVE_PRODUCTION_CRONS` back to `false` in `lib/trigger/scheduleActivation.ts` and deploy immediately. This is the one runbook step that intentionally touches the gate — only to restore it to `false`.
**Verify:** `GET /api/health` → `scheduleGateOpen: false`; confirm in the Trigger.dev dashboard that the three sweep schedules (`analytics-capture-sweep`, `publishing-due-sweep`, `recommendation-pipeline-sweep`) show no active cron.
**Escalate:** Immediately — this is a production-safety incident, not a routine fix. Document what caused the gate to open before considering re-activation.

## Rollback after schedule activation

**Symptoms:** Schedules were intentionally activated (`ATTACH_DECLARATIVE_PRODUCTION_CRONS = true`, deployed) and now need to be reversed.
**Recovery:**
1. Revert `ATTACH_DECLARATIVE_PRODUCTION_CRONS` to `false` in a new commit (never hotfix the constant directly in production without a code review).
2. Deploy the revert.
3. In the Trigger.dev dashboard, confirm the three sweep schedules show inactive/removed.
4. Re-run `GET /api/health` and `?view=readiness` to confirm `schedule_attachment` returns to Intentionally disabled.
5. Audit `background_jobs` and `publishing_jobs` created during the active window for any unexpected autonomous activity; record findings as a pilot issue if anything unexpected occurred.

## Tenant setup regression

**Symptoms:** A previously setup-complete tenant now shows incomplete required setup, or the setup card reappears for a mature account.
**Impact:** Confusing for the customer; does not itself indicate data loss (setup completion is always derived, never stored as a flag).
**Confirm:** `?view=tenants` (search by business name) → inspect the `setup` dimension; compare against `business_profiles` for that tenant (business name, marketing_goals, onboarding_completed).
**Recovery:** Since required completion derives from real fields (business name, marketing goals, onboarding_completed), a regression means one of those fields changed or was cleared — investigate the specific write path (Settings, Setup forms, or a migration) rather than "fixing" the setup table directly.

## Customer-visible degraded state

**Symptoms:** A customer reports a blank section, stuck spinner, or confusing error on a dashboard page.
**Confirm:** Check `?view=readiness` and `?view=tenants` for that tenant's business first — most degraded states map directly to a readiness or tenant-health item (Google disconnected, analytics stale, publishing failed, migration issue).
**Recovery:** Follow the specific runbook section matching the affected subsystem above. Never advise a customer to "just refresh repeatedly" — if a page is stuck, that is itself a bug to investigate (see Job lifecycle / stuck jobs below).

## Publishing job stuck / stuck jobs generally

**Symptoms:** Ops Dashboard → Stuck jobs panel lists a job queued 30+ minutes or running 15+ minutes.
**Confirm:** `GET /api/admin/ops?view=jobs`.
**Recovery:** Each stuck job is labeled with a retry-safety classification:
- **Safe to retry / Safe (deduplicated):** use the panel's Retry button directly.
- **Requires operator review:** this includes every `publishing_execute` job and any job that exhausted its automatic retry budget. Before confirming retry, check `publishing_history` for that job to rule out a duplicate post, then confirm explicitly in the panel.
- **Not retryable:** the job is not in `failed`/`cancelled` state — investigate why it's stuck (worker crash, timeout) rather than retrying.
**Escalate:** If jobs are stuck in bulk (not isolated to one tenant), suspect a worker-level issue (see Trigger.dev unavailable / Supabase unavailable above) rather than retrying individually.

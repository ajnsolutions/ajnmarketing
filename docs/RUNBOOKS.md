# Operational Runbooks

Internal procedures for AJN Marketing. Prefer the admin Ops Dashboard (`/dashboard/admin/ops`) and existing admin trigger APIs. Do **not** flip `ATTACH_DECLARATIVE_PRODUCTION_CRONS` from these runbooks.

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

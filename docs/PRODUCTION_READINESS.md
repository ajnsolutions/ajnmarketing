# Production Readiness Assessment — AJN Marketing

- **Status:** Launch-ready with conditions (pilot-operated, schedules still gated)
- **Date:** 2026-07-14
- **Branch:** `production-readiness-launch-validation`
- **Cron gate:** `ATTACH_DECLARATIVE_PRODUCTION_CRONS = false` (must remain false for this PR)

---

## 1. Executive verdict

Feature work through Weekly Approval Package + One-Click Email Approval is complete. This milestone does **not** add customer-facing marketing features. It adds operational validation, health checks, an admin ops dashboard, alert evaluation, failure-injection gates, structured workflow logging, and launch documentation.

**Production readiness status:** **Ready for a manually operated pilot** once launch blockers below are cleared. **Not ready** to claim fully autonomous scheduled operation until Trigger.dev schedules are intentionally activated in a separate, approved change.

---

## 2. Architecture strengths

- Strong tenant isolation patterns (RLS + application-level `user_id` / `business_profile_id` checks)
- Service-role client is `server-only` with an explicit trust-boundary comment
- Publishing claim/retry machinery and idempotent recommendation/draft paths
- Domain-separated signed tokens for weekly-package open links vs email-action mutations
- Email-action approve/reject reuses existing `patchContentApprovalForUser` (no second workflow)
- `GET /api/publishing` is read-only (no page-load publish side effect)
- Declarative production cron gate with unit-test lock

---

## 3. Remaining risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Service-role key rotation status historically unresolved | High | Confirm rotation before pilot; see LAUNCH_CHECKLIST |
| Opportunity detection / decision engine still need explicit ops/admin trigger until schedules activate | High (for "autonomous" claims) | Use admin trigger routes; document pilot as assisted |
| Outbound weekly email send not wired | Medium | Preview-only until provider integration |
| Trigger.dev project/runtime not exercised as always-on production | Medium | Admin one-off triggers + health checks |
| Ops dashboard uses service-role aggregation | Medium | Admin allowlist only; never expose to tenants |
| Failure injection misconfiguration | High if enabled in prod | Triple-gated; alert fires if enabled |

---

## 4. Technical debt (non-blocking)

- Audit log UI is still thin (ops dashboard aggregates counts; not a full audit browser)
- Some dashboard copy historically overstated automation (tracked in prior audit)
- Structured logging is being rolled out incrementally (workflow logger + email-actions); not every stage yet
- No external pager/Slack integration yet (alerts are in-dashboard only)

---

## 5. Launch blockers

1. Confirm Supabase service-role key was rotated (or document that it was never compromised in the current project).
2. Decide pilot operating mode: **assisted** (admin/manual pipeline triggers) vs wait for schedule activation PR.
3. Provision production env vars from `LAUNCH_CHECKLIST.md` (OpenAI, Google OAuth, signing secrets, `ADMIN_USER_IDS`).
4. Do **not** flip `ATTACH_DECLARATIVE_PRODUCTION_CRONS` in this release.

---

## 6. Recommended launch sequence

1. Merge this production-readiness PR (docs + ops tooling only).
2. Apply migrations / verify schema on the target Supabase project.
3. Configure secrets; set `ADMIN_USER_IDS` for operators.
4. Run `/api/health` + `/dashboard/admin/ops` checks.
5. Run `PILOT_VALIDATION.md` against MySafetyTeam / Sunspots / pilot business.
6. Operate recommendations via admin triggers; keep crons closed.
7. Separate future PR: schedule activation + outbound email send (explicit approval).

---

## 7. Monitoring & alerts

- Public: `GET /api/health` (no secrets)
- Admin: `/dashboard/admin/ops`, `GET /api/admin/ops?view=summary|health|alerts|workflow|failure-injection`
- Alerts evaluated in-process from queue/audit counters — no external notification provider yet
- Workflow logger fields: correlationId, tenant, business, stage, duration, result, retryCount, failureCategory

---

## 8. Failure recovery

- Controlled faults via `FAILURE_INJECTION_ENABLED` + `FAILURE_INJECTION_FAULTS` (non-production only)
- Publishing retries remain claim-safe
- Email-action replays return `already_done`
- Expired/forged approval tokens fail closed

---

## 9. Security review summary

Reviewed: signed tokens, replay, authz, tenant isolation, RLS posture, admin routes, service-role, OAuth storage, email links, redirects, CSRF (cookie session + same-site), open redirect, injection, object ownership.

**Fixed in this PR:** shared `safeInternalNextPath` applied to login form and OAuth auth callback (blocks protocol-relative, absolute, backslash, `@` userinfo, and control-character open redirects).

**Findings (non-blocking):** prefer dedicated `EMAIL_ACTION_TOKEN_SECRET` / `WEEKLY_APPROVAL_LINK_SECRET` before high-volume email send; keep service-role out of all client bundles (already `server-only`).

---

## 10. Performance review (measurement-informed)

Recommendations only where justified by prior live audit + code shape:

- Avoid Trigger.dev run polling on every ops page load (dashboard uses DB aggregates; Trigger health is config/gate based)
- Keep weekly package collection batched (existing recommendation package batching)
- Watch N+1 if ops dashboard is extended to per-tenant drill-down — paginate
- Large email HTML payloads: keep summaries truncated (existing `truncateSummary`)

No speculative micro-optimizations applied.

---

## 11. Confirmations

- `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains **false**
- No production schedules activated by this PR
- No auto-publishing introduced
- No auto-approval introduced
- Tenant isolation not weakened
- Service-role code remains server-only

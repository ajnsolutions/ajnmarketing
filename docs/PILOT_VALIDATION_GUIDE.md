# Pilot Validation Guide — Production Go-Live Readiness

**Phase 6.** Operator guide for validating that AJN Marketing can safely support a controlled assisted pilot.

Related docs: [`PILOT_RUNBOOK.md`](./PILOT_RUNBOOK.md), [`PRODUCTION_READINESS.md`](./PRODUCTION_READINESS.md), [`ASSISTED_PILOT.md`](./ASSISTED_PILOT.md), [`RUNBOOKS.md`](./RUNBOOKS.md).

**Hard rule:** `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains **false**. Phase 6 validates readiness; it does **not** activate schedules, deploy, or merge.

---

## Surfaces

| Surface | URL | Purpose |
|---|---|---|
| Pilot Validation | `/dashboard/admin/pilot-validation` | Audit, operational paths, journey checklist, readiness report, observability |
| Customer Success | `/dashboard/admin/customer-success` | Per-customer checklist, attention, recovery, feedback |
| Operations | `/dashboard/admin/ops` | Health, queues, stuck jobs, production readiness, assisted pilot console |

Access: signed-in users listed in `ADMIN_USER_IDS`. Service role required for multi-tenant composition.

---

## Pilot validation checklist

Use Pilot Validation as the single operator walkthrough:

1. Confirm cron gate **CLOSED** and overall readiness is not blocked for pilot tooling.
2. Review **Pilot readiness audit** — setup, Google, website, AI profile, Marketing Plan, Brand Voice, publishing, approvals, Trigger.dev.
3. Walk **Operational validation** paths (retry, recovery, approvals, publishing, Google reconnect, website re-analysis). Note any **Inconsistent** badges.
4. Complete **Customer journey validation** scenarios (new / returning / GBP connected & disconnected / website unavailable / approval / publish / recovery / completion).
5. Read the **Production readiness report** — blockers, warnings, recovered issues, healthy systems, required manual actions.
6. Triage **Admin observability** counts (attention, inactive, onboarded, blocked, recent publishes/approvals/recoveries).
7. Capture residual friction as pilot feedback issues on Customer Success.

---

## Daily validation

- [ ] Pilot Validation → observability strip has no unexpected spike in blocked / stuck jobs
- [ ] Cron gate still CLOSED
- [ ] Attention / Google / publishing warnings triaged or accepted
- [ ] Any inconsistent operational states investigated
- [ ] No schedule activation performed

---

## Weekly validation

- [ ] Full journey checklist walkthrough for at least one active pilot customer
- [ ] Production readiness report blockers cleared or explicitly accepted with notes
- [ ] Review open pilot issues; resolve or wont-fix with rationale
- [ ] Confirm publishing and approvals still require explicit human action
- [ ] Update known limitations below

---

## Known limitations

- Last-login is not always available from current tenant-health composition.
- “Recent publishes / approvals / recoveries” combine ops queue counters with customer milestone flags — they are directional, not a new analytics product.
- Trigger.dev tasks may still be manually invokable while schedules remain unattached.
- Pilot readiness / launch recommendation scores remain advisory; they do not flip the cron gate.
- Service-role misconfiguration blocks multi-tenant validation pages (Ops config probes may still load).

---

## Go-live checklist (assisted pilot)

- [ ] RC-1 through Phase 5 surfaces reviewed; Phase 6 validation page green or accepted
- [ ] At least one end-to-end assisted customer journey completed (setup → approval → publish)
- [ ] Google reconnect and website re-analysis recovery paths exercised
- [ ] Stuck-job retry safety understood; no unsafe mass retries
- [ ] Ops alerts understood; failure injection disabled
- [ ] Pilot runbook + this guide shared with operators
- [ ] Escalation path defined (see Pilot Runbook)

---

## Criteria before enabling schedules

Do **not** set `ATTACH_DECLARATIVE_PRODUCTION_CRONS=true` until **all** are true:

1. Explicit written approval for schedule activation (separate change).
2. Production readiness `scheduleActivationBlockers` is empty (or each blocker accepted in writing).
3. Publishing failures and stuck jobs are cleared or explained.
4. OAuth / Google health is acceptable for the pilot cohort.
5. Rollback owner and procedure identified (below).
6. Monitoring owner watching Ops + Pilot Validation for the first 48 hours after activation.

Phase 6 itself never opens the gate.

---

## Rollback considerations

If schedules were activated accidentally or behavior is unsafe:

1. Set `ATTACH_DECLARATIVE_PRODUCTION_CRONS` back to `false` and redeploy (separate approved deploy).
2. Confirm Ops cron gate shows CLOSED.
3. Pause new publishes; use existing Publishing controls for in-flight jobs only.
4. Capture a pilot issue with severity critical.
5. Review Trigger.dev run history for unexpected sweeps.
6. Follow [`RUNBOOKS.md`](./RUNBOOKS.md) / production readiness rollback notes.

---

## Phase 6 implementation notes

- Compose-only: `lib/assisted-pilot/pilotValidationCompose.ts` + `pilotValidationService.ts` reuse Customer Success / ops / readiness builders.
- UI: `app/dashboard/admin/pilot-validation/page.tsx`, `components/dashboard/pilot-validation-dashboard.tsx`.
- No new polling, AI engines, recommendation ranking/scoring, OAuth, billing, or Trigger schedule attachment.

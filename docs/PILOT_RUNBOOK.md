# Pilot Runbook — Assisted Pilot Readiness

**Phase 5.** Operator guide for onboarding, monitoring, and supporting a small assisted customer pilot.

Related docs: [`ASSISTED_PILOT.md`](./ASSISTED_PILOT.md), [`RUNBOOKS.md`](./RUNBOOKS.md), [`PRODUCTION_READINESS.md`](./PRODUCTION_READINESS.md), Phase 4A–4C UX docs.

**Hard rule:** `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains **false**. Do not activate schedules from this runbook.

---

## Surfaces

| Surface | URL | Purpose |
|---|---|---|
| Operations | `/dashboard/admin/ops` | Health, cron gate, queues, stuck jobs, production readiness, assisted pilot console |
| Customer Success | `/dashboard/admin/customer-success` | Per-customer checklist, timeline, attention center, guided recovery, pilot feedback |

Access: signed-in users listed in `ADMIN_USER_IDS`.

---

## Pilot onboarding process

1. Confirm admin allowlist + service-role env for multi-tenant reads.
2. Confirm cron gate **CLOSED** on Ops.
3. Customer completes guided setup (`/dashboard/setup`) — do not present assisted-pilot score as customer onboarding.
4. Register the business in Assisted Pilot (`register_pilot`) if not already listed.
5. Walk operator checklist on Customer Success:
   - Website analyzed
   - Business profile complete
   - Google Business connected
   - Marketing Plan generated
   - Brand Voice confirmed
   - First content approved
   - First content published
   - Reviews synchronized
   - Weekly briefing reviewed
6. Log pilot feedback issues early (bugs, confusing workflows, questions).

---

## Daily operator checklist

- [ ] Open Ops — overall health + cron gate CLOSED
- [ ] Open Customer Success — Attention Center empty or triaged
- [ ] Clear publishing failures / stuck jobs using existing retry controls only when marked safe
- [ ] Help any onboarding / Google reconnect cases via guided recovery links
- [ ] Update pilot checklist stages as work completes
- [ ] Capture new pilot feedback (question / bug / confusing workflow / etc.)

---

## Weekly operator review

- [ ] Review each pilot card: setup %, first publish, open attention kinds
- [ ] Review aggregate pilot readiness + launch recommendation (**advisory only**)
- [ ] Resolve or accept open critical/high pilot issues with notes
- [ ] Confirm no unintended publishes and no schedule activation
- [ ] Update known limitations below if new friction appears

---

## Common recovery steps

| Situation | Safe action |
|---|---|
| Website analysis failed | Customer `/dashboard/website-analysis` refresh, or pilot manual `website_analysis` |
| Google disconnected | `/dashboard/google-business-profile/connect` |
| Publishing failed | `/dashboard/publishing` retry; pilot manual `publishing` only with explicit job id |
| Pending / overdue approvals | `/dashboard/approvals` or weekly package preview |
| Marketing plan stale/failed | `/dashboard/marketing-plan` refresh |
| Stuck background job | Ops stuck-jobs panel — retry only when classified safe |
| Confused customer | Open HoM `/dashboard`; log “confusing workflow” feedback |

Never invent new backend engines. Never flip the cron gate from this workflow.

---

## Known pilot limitations

- Assisted pilot tables require migration `023`.
- Customer Success lists up to 50 tenants per page (ops pagination pattern).
- “Last login” is shown only when already available elsewhere — not fabricated.
- Timeline events come from pilot checklist completions, manual action runs, and persisted last-* stamps — empty until the business is registered / active as a pilot.
- Failure injection / external alert providers may be intentionally disabled.
- Schedule activation is a **separate approved change**, not part of Phase 5.

---

## Escalation guidance

1. Capture the issue in Pilot feedback with severity.
2. If customer data may be wrong or unsafe to publish — pause publishing assistance; leave cron gate closed.
3. If OAuth/token/env misconfiguration — escalate to engineering with Ops readiness item + correlation ids from health checks.
4. If readiness recommendation says Not Ready — do not discuss schedule activation with stakeholders.

---

## Pilot exit checklist

- [ ] Checklist complete through analytics/learning for each pilot business (or documented exceptions)
- [ ] Zero open critical pilot issues (or accepted with docs)
- [ ] Cron gate still CLOSED
- [ ] Customer Success Attention Center clear or accepted
- [ ] Decision recorded whether to open a **separate** PR for schedule activation later
- [ ] Feedback themes summarized for product backlog

---

## Phase 5 implementation notes

Presentation/composition only:

- `lib/assisted-pilot/customerSuccessCompose.ts`
- `lib/assisted-pilot/customerSuccessService.ts`
- `lib/assisted-pilot/recoveryLinks.ts`
- `app/dashboard/admin/customer-success/page.tsx`
- `components/dashboard/customer-success-dashboard.tsx`

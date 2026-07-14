# Assisted Pilot Framework

- **Status:** Implemented (manual ops only)
- **Branch intent:** `build-assisted-pilot-framework`
- **Cron gate:** `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains **false**

---

## Purpose

Operate AJN Marketing on owned businesses (**MySafetyTeam**, **Sunspots**, and future pilots) with structured checklists, metrics, issues, and readiness scoring **before** enabling Trigger.dev schedules or claiming autonomous operation.

This framework does **not**:
- Activate production crons
- Auto-approve content
- Auto-publish without an explicit job id / operator action

---

## Architecture

```
Admin (/dashboard/admin/ops)
  └── Assisted Pilot panel
        ├── pilot_businesses / checklist / issues / manual_action_runs (migration 023)
        ├── Metrics from existing tenant tables (approvals, jobs, recommendations, audits)
        ├── Deterministic readiness score (no AI)
        └── Manual actions → existing services / Trigger.dev one-off tasks
```

Admin API: `GET|POST /api/admin/pilot` (allowlisted via `ADMIN_USER_IDS` + service-role).

---

## Pilot workflow (daily operating guide)

1. Open `/dashboard/admin/ops` as an allowlisted admin.
2. Confirm cron gate **CLOSED**.
3. Select a pilot business (register via `register_pilot` if missing).
4. Run manual actions in order (see below).
5. Update checklist stages as work completes (or let actions mark stages).
6. Log issues immediately when UX/AI/publishing/oauth problems appear.
7. Review readiness score + advisory launch recommendation (advisory only).

### Manual trigger order

1. Website analysis  
2. Recommendation generation (Trigger.dev one-off)  
3. Weekly package generation (preview package; no outbound send required)  
4. Email review / Approvals (in Approval Center / one-click email actions)  
5. Publishing (explicit `publishingJobId` only)  
6. Analytics capture (Trigger.dev one-off)  
7. Outcome reconciliation  
8. Health refresh  
9. Pilot signoff checklist stage

---

## Success criteria

- At least one owned business completes the checklist through analytics + learning
- Second business (Sunspots) proves tenant isolation under assisted ops
- No unintended publishes
- Cron gate remains closed
- Critical pilot issues resolved or accepted with documentation

## Exit criteria (ready to consider schedule activation)

- Aggregate readiness in **Ready For Schedule Activation** band **and**
- Zero open critical issues **and**
- Separate approved PR to flip `ATTACH_DECLARATIVE_PRODUCTION_CRONS` (not this framework)

## Rollback

- Stop using manual console
- Leave cron gate false
- Optionally pause pilot businesses (`status=paused`)
- Vercel rollback if UI/API regresses

## Known risks

- Migration `023` must be applied before pilot tables exist
- Trigger.dev one-off triggers require `TRIGGER_SECRET_KEY`
- Publishing action requires a real job id (never sweeps all due jobs)
- Readiness score is advisory — not an automatic activator

## Security

- Admin-only (`isAdminUserId`)
- Pilot tables RLS enabled with **no** authenticated policies (service-role only)
- Register/action paths verify `business_profiles.user_id` ownership
- Responses never include OAuth tokens, service-role secrets, or email HTML bodies

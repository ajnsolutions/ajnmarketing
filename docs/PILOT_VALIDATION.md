# Pilot Validation Guide

Walkthrough for validating AJN Marketing with real pilot businesses **without** activating production schedules or enabling auto-publish/auto-approve.

## Scope

- Assisted / operator-driven loop
- Confirm tenant isolation, approvals, publishing safety, analytics, learning inputs
- Weekly package + one-click approval in preview/execute modes

## Pilot subjects

| Subject | Purpose |
|---------|---------|
| **MySafetyTeam** | Primary multi-feature pilot path |
| **Sunspots** | Second-tenant isolation / parity checks |
| **Pilot business** | Named customer candidate under NDA/pilot terms |

Use separate Supabase auth users / business profiles. Never cross-link tokens across tenants.

## Expected outcomes

1. Website onboarding completes; business profile present
2. Website analysis produces structured insights
3. AI Marketing Profile generates
4. Market context / opportunities / recommendations available after **explicit** admin or scripted pipeline run
5. Draft generation creates or reuses a single draft (idempotent)
6. Weekly Approval Package preview lists pending items with explanations
7. One-click email approval (or in-app approve) moves items to approved without double-apply on replay
8. Publishing queue accepts approved content; publish requires explicit action
9. Analytics capture upserts snapshots
10. Outcome/learning updates remain coherent (provider failures stay operational, not quality-poisoning)

## What to verify (per business)

- [ ] Correct business name on dashboards and weekly package
- [ ] No data from other tenants visible
- [ ] Approval Center deep links from weekly package land on the right item
- [ ] Expired email-action token fails closed
- [ ] Forged token fails closed
- [ ] Publish without GBP fails safely (retrying/failed) without leaking secrets
- [ ] Ops Dashboard shows expected queue depths after activity
- [ ] `/api/health` does not expose tokens or draft content

## Success criteria

- Happy path completes for at least one pilot business end-to-end under assisted operation
- Tenant isolation verified against a second account (Sunspots or throwaway)
- Zero production cron attachments
- Zero unintended publishes
- Operators can diagnose failures via Ops Dashboard + runbooks

## Known limitations

- Declarative Trigger.dev production crons remain disabled
- Weekly email outbound send may still be preview-only
- Fully autonomous overnight operation is **out of scope** until schedule activation PR
- Ops alerts are in-app only (no PagerDuty/Slack yet)

## After validation

Record date, operator, businesses tested, defects, and whether launch blockers in `PRODUCTION_READINESS.md` remain open.

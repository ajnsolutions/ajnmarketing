# Authenticated UX Implementation Plan

Branch source: `audit-authenticated-ui-flow` · Date: 2026-07-15

Group remediation into focused PRs. Do **not** activate Trigger.dev schedules in any of these PRs.

Recommended agent for each: Claude Code for IA/copy/architecture; Grok or Composer for mechanical refactors when scoped tightly.

---

## PR A — Navigation and information architecture

**Objective:** Reduce cognitive load; group customer nav around “Needs you / Grow / Business / Account”; hide unfinished destinations.

**Pages:** all dashboard shell consumers; `dashboard-nav.tsx`, `dashboard-sidebar.tsx`, `dashboard-topbar.tsx`

**Components:** nav config, optional section headers, topbar links

**Dependencies:** none

**Risks:** muscle-memory breakage for existing pilots; mitigate with short release note

**Acceptance criteria:**
- Placeholders (Notifications/Billing/Settings) not in primary nav or topbar until real
- ≤ ~8–10 top-level customer items or clear grouped sections
- Admin ops still absent from customer nav
- Active state still works on mobile + desktop

**Tests:** unit snapshot of nav config; Playwright smoke that `/dashboard/settings` still reachable by URL if kept

**Screenshots:** yes (desktop + mobile drawer)

---

## PR B — Dashboard and next-action clarity

**Objective:** Command Center answers “what should I do next?” in one glance.

**Pages:** `/dashboard/command-center`, possibly `/dashboard/tasks`

**Components:** `command-center-page.tsx`, command-center server aggregations

**Dependencies:** PR A helpful but not required

**Risks:** removing widgets operators like; keep progressive disclosure

**Acceptance criteria:**
- Single primary CTA when pending approvals / reconnect / empty recs
- Secondary panels collapsed or below fold
- No false autonomy claims

**Tests:** unit for next-action selector; manual review screenshots

**Screenshots:** yes

---

## PR C — Recommendation, content, and approval workflow

**Objective:** Close the loop from empty recommendations → draft → approval with honest copy.

**Pages:** recommendations, content, generator, approvals, delivery

**Components:** recommendation cards, approvals page, empty states

**Dependencies:** assisted pilot / admin triggers exist; may add customer-safe “refresh recommendations” that calls existing services with rate limits

**Risks:** exposing expensive pipeline runs; guard with confirm + quotas

**Acceptance criteria:**
- Empty Recommendations state explains next step (or offers safe refresh)
- Content/Approvals overlap reduced (copy + links)
- No “automatically published” language
- Approve All only where real (email-actions / queue), never dead buttons

**Tests:** Playwright pending deep link; unit empty-state; email-action regression suite remains green

**Screenshots:** yes

---

## PR D — Integration and error-state consistency

**Objective:** Consistent connect/reconnect/failure language; real Disconnect or clearly secondary.

**Pages:** GBP connect, publishing, website analysis, AI profile, onboarding

**Components:** `gbp-connect-page.tsx`, publishing panels, analysis/profile error UIs

**Dependencies:** Disconnect may need API work

**Risks:** OAuth revoke mistakes; feature-flag Disconnect until backend ready

**Acceptance criteria:**
- Same reconnect pattern across OAuth expired + publish blocked
- Website Analysis and AI Profile share failure posture (loud + retry)
- Disconnect either works or is not presented as a primary button

**Tests:** unit for status mapping; manual OAuth reconnect checklist

**Screenshots:** yes (failure states)

---

## PR E — Mobile and accessibility remediation

**Objective:** Usable 390px drawer and queues; keyboard and accessible names.

**Pages:** shell + approvals + publishing + reviews

**Components:** sidebar, topbar, approval cards, tables

**Dependencies:** PR A preferred first

**Risks:** low if incremental

**Acceptance criteria:**
- No horizontal overflow on key pages at 390 / 768
- Icon-only controls have accessible names
- Focus visible on interactive controls
- Tap targets ≥ 44px on primary actions

**Tests:** Playwright viewport checks; optional axe on approvals

**Screenshots:** yes (mobile)

---

## PR F — Visual consistency and design-system cleanup

**Objective:** Extract shared `SectionCard`, badges, button variants from repeated locals; align spacing tokens.

**Pages:** many dashboard pages

**Components:** new `components/dashboard/ui/*` primitives; migrate call sites gradually

**Dependencies:** none (can parallelize after A)

**Risks:** visual churn; migrate page-by-page

**Acceptance criteria:**
- Shared primitives used by ≥3 major pages
- No new third-party design system introduced
- Brand tokens unchanged unless documented

**Tests:** visual spot-check; unit for primitive variants

**Screenshots:** before/after optional

---

## PR G — Admin operations usability

**Objective:** Allowlisted admins can discover Ops/Pilot without exposing to customers.

**Pages:** `/dashboard/admin/ops`, possibly settings for admins only

**Components:** assisted pilot panel, ops dashboard

**Dependencies:** `ADMIN_USER_IDS`

**Risks:** leaking admin entry to customers — must gate rendering on `isAdminUserId`

**Acceptance criteria:**
- Admin-only nav item or Command Center card when allowlisted
- Non-admins never see the entry
- Cron gate still closed; no schedule activation UX that implies live cron

**Tests:** unit/admin gate; route 403/redirect tests

**Screenshots:** admin vs non-admin

---

## Cross-cutting constraints (all PRs)

- `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains false unless a dedicated activation PR
- No auto-publish / auto-approve
- No tenant isolation weakening
- Prefer existing design tokens and dashboard patterns
- Manual review required for any copy that claims automation

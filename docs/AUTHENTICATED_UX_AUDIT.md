# Authenticated UX / UI Audit — AJN Marketing

- **Status:** Complete (audit + limited copy/control fixes)
- **Date:** 2026-07-15
- **Branch:** `audit-authenticated-ui-flow`
- **Scope:** Authenticated customer experience + internal admin ops (code review, route inventory, prior live audits). Full live authenticated browser pass against pilot accounts was **not** completed in this branch.

---

## 1. Executive summary

AJN Marketing’s authenticated product has a strong functional core (approvals, publishing state machine, GBP sync, recommendations engine, weekly package, assisted pilot ops) but the **customer-facing information architecture still reads like an internal feature catalog**. A new local-business owner lands in a 17-item sidebar where Settings / Billing / Notifications are placeholders, onboarding historically understated a working GBP connect flow, and Approval Center copy previously claimed automatic publishing.

**Verdict:** Usable for an **assisted pilot** with operator support; **not yet** optimally simple for the “AJN handles the work” promise without IA cleanup.

| Severity | Count (this audit) |
|----------|--------------------|
| P0 | 0 (UI/tenant isolation) |
| P1 | 6 |
| P2 | 10 |
| P3 | 4 |

**Highest priorities:** (1) simplify navigation around “what needs me now,” (2) stop shipping placeholder destinations in primary chrome, (3) give customers a clear path from empty Recommendations → first draft, (4) keep automation copy honest while schedules remain gated.

Confirmations: `ATTACH_DECLARATIVE_PRODUCTION_CRONS = false`; this branch does not activate schedules, auto-publish, or auto-approve.

---

## 2. Current authenticated information architecture

```
Auth
├── /login, /signup, /forgot-password
├── /auth/callback (OAuth / magic-link)
└── /onboarding  →  gated until complete

Customer dashboard (/dashboard/*)
├── Command Center (home redirect)
├── Work: Today's Tasks, Approval Center, Publishing
├── Local: GBP, Reviews
├── Intelligence: Website Analysis, Brand Voice, AI Profile,
│                 Marketing Plan, Recommendations, Market Context
├── Content: Content hub, Content Generator
├── Insights: Analytics
└── Account chrome: Notifications*, Billing*, Settings*  (*placeholders)

Internal
└── /dashboard/admin/ops  (ADMIN_USER_IDS; not in sidebar)
```

---

## 3. Current navigation map

Source: `components/dashboard/dashboard-nav.tsx` → `dashboard-sidebar.tsx` + mobile overlay via `dashboard-shell.tsx` / `dashboard-topbar.tsx`.

| # | Label | Route |
|---|--------|--------|
| 1 | Command Center | `/dashboard/command-center` |
| 2 | Today's Tasks | `/dashboard/tasks` |
| 3 | Approval Center | `/dashboard/approvals` |
| 4 | Publishing | `/dashboard/publishing` |
| 5 | Google Business Profile | `/dashboard/google-business-profile` |
| 6 | Website Analysis | `/dashboard/website-analysis` |
| 7 | Brand Voice | `/dashboard/brand-voice` |
| 8 | AI Profile | `/dashboard/ai-profile` |
| 9 | Marketing Plan | `/dashboard/marketing-plan` |
| 10 | Recommendations | `/dashboard/marketing-recommendations` |
| 11 | Content | `/dashboard/content` |
| 12 | Reviews | `/dashboard/reviews` |
| 13 | Market Context | `/dashboard/market-context` |
| 14 | Analytics | `/dashboard/analytics` |
| 15 | Notifications | `/dashboard/notifications` |
| 16 | Billing | `/dashboard/billing` |
| 17 | Settings | `/dashboard/settings` |

Topbar also deep-links Settings (business pill / avatar) and Notifications (bell).

Admin Ops is **intentionally** omitted from nav (direct URL only).

---

## 4. Core user-flow diagrams

### Flow 1 — New customer
signup → onboarding → (optional GBP connect) → Command Center → Website Analysis / AI Profile → Recommendations (**often empty without assisted pipeline**) → Content Generator / create-content → Approval Center → Publishing

**Friction:** empty recommendations; long nav; placeholders in account chrome; historically false GBP “coming soon” on onboarding (fixed in this branch).

### Flow 2 — Returning customer
login → `/dashboard` → Command Center → pending approvals / tasks → approve → add to queue → publish

**Friction:** Command Center density; next action not always singular.

### Flow 3 — Weekly review
signed weekly / email-action link → login if needed → Approval Center or email-action confirm → approve → publishing status elsewhere

**Friction:** dual surfaces (in-app queue vs delivery preview vs one-click email).

### Flow 4 — GBP connect
Settings/nav GBP → connect → Google OAuth → return → sync → (Disconnect still UI-only)

### Flow 5 — Review management
Reviews hub → AI draft reply → edit/mark responded → open on Google (manual post path)

### Flow 6 — Content lifecycle
Recommendation → draft → edit → approve → publishing queue → job → published → analytics/learning

### Flow 7 — Failure recovery
OAuth expired / publish retrying → customer sees sanitized errors → reconnect GBP → retry publish explicitly

### Flow 8 — Admin pilot
`/dashboard/admin/ops` → select pilot → checklist → manual action → issue log → readiness score

---

## 5. Relevant Cursor skills and rules used

| Source | How applied |
|--------|-------------|
| `.cursor/rules/trigger-skills.mdc` + `trigger-authoring-tasks` | Do not activate schedules; treat Trigger.dev as ops backend only |
| `AGENTS.md` / `CLAUDE.md` | Next.js 16 conventions; avoid inventing obsolete APIs |
| User frontend design rules | Prefer existing dashboard patterns over a new design system; brand tokens already in `globals.css` |
| User git/PR rules | Focused commits; PR not merged |
| Cursor skills: `review-security`, `create-rule`, `babysit` | Referenced for security posture / future remediation PRs; not used to redesign UI |

---

## 6. Design-system inventory

| Area | Current state |
|------|----------------|
| Framework | Next.js 16.2.9 App Router, React 19.2.4 |
| Styling | Tailwind CSS v4 via `@theme inline` in `app/globals.css` |
| Tokens | navy / brand blue / growth green / surface / text-muted; Geist sans/mono |
| Component library | None (hand-rolled cards, badges, buttons) |
| Icons | Inline SVG in nav and pages |
| Forms | Local `useState`; no RHF/zod |
| Charts | Ad-hoc SVG on GBP page |
| Toasts | Inline local state strings |
| Shared UX states | `components/dashboard/ui/dashboard-states.tsx` |
| Modals | Custom (e.g. schedule post modal) |

**Recommendation:** do not invent a second design system; extract shared primitives from repeated `SectionCard` / badge patterns in a later PR.

---

## 7. What currently works well

- Onboarding gate in `app/dashboard/layout.tsx` is clear
- Approval Center + recommendation explainability packages are customer-legible
- Publishing job statuses (retry/cancel/history) are operationally solid
- Weekly package + one-click email actions are well security-scoped
- Admin ops / assisted pilot are correctly separated from customer nav
- Shared empty/error/loading components exist and are reused in several places
- Customer UI does not leak “Trigger.dev” / “service-role” jargon

---

## 8–16. Problem catalog (by theme)

### Usability (P1/P2)
1. **P1** Flat 17-item nav overwhelms new owners; no “Needs you” grouping  
2. **P1** Recommendations often empty without assisted/manual pipeline — primary value loop stalls  
3. **P1** Settings / Billing / Notifications are placeholders but live in primary chrome  
4. **P1** Approval Center previously claimed automatic publishing (**fixed** this branch)  
5. **P1** Dead Approve All / Refresh header controls (**fixed** → real links / removed)  
6. **P1** Onboarding GBP “coming soon” despite live connect (**fixed** → connect link)  
7. **P2** Brand Voice largely mock controls  
8. **P2** Command Center packs too many jobs for a first viewport  
9. **P2** Content vs Generator vs Approvals overlapping mental models  

### Visual consistency (P3)
- Per-page duplicated SectionCard/StatusBadge  
- Inconsistent shadow/radius/spacing across feature pages  

### Mobile (P2)
- Full 17-item mobile drawer is long  
- Dense tables/queues need dedicated stacking pass (inferred; not axe/device-lab verified here)  

### Accessibility (P3)
- Icon-only topbar controls need consistent accessible names  
- Focus visibility varies; no systematic axe run in this audit  

### Customer vs admin
- Separation is **good** (ops not in nav)  
- Gap: allowlisted admins have no in-product discoverability path to `/dashboard/admin/ops`  

### Duplicate / overlapping pages
- `/dashboard/content` vs `/dashboard/content/generator` vs Approvals  
- `/dashboard/approvals/delivery` vs weekly package preview API  
- Legacy `app/dashboard/[section]/page.tsx` placeholders  

### Terminology inconsistencies
| Current | Proposed customer vocabulary |
|---------|------------------------------|
| Command Center | Keep as product name **or** “Home” with subtitle |
| AI Profile / Marketing Brain | **Marketing Profile** |
| Opportunity (engine) | Keep internal; customer sees **Recommendation** |
| Tenant | **Business** |
| Queue (product) | OK if paired with plain language |
| Automatically published | **Never** claim while gate is closed |

### Broken / confusing actions
- GBP Disconnect still UI-only (honest toast; still looks primary) — **P1 residual**  
- Brand Voice save/refresh affordances without persistence — **P2**  

### Empty / loading / error
- Shared states are good when used  
- Website Analysis silent AI fallback vs AI Profile loud failure — **P2** inconsistency  

---

## 17. Prioritized recommendations

1. Restructure nav into **Needs you / Growth / Business** (PR A)  
2. Replace or demote placeholder Settings/Billing/Notifications destinations (PR A/D)  
3. Customer-safe “generate recommendations / refresh plan” or empty-state explaining assisted mode (PR C)  
4. Single next-action hero on Command Center (PR B)  
5. Honest autonomy copy everywhere schedules are gated (PR C/D)  
6. Mobile drawer IA + queue stacking (PR E)  
7. Shared dashboard primitives (PR F)  
8. Admin ops discoverability for allowlisted users only (PR G)  

---

## 18. Proposed future information architecture

```
Home (Command Center)
Needs you → Approvals, Today's Tasks, Reviews (pending)
Grow → Recommendations, Content, Publishing, Marketing Plan
Business → GBP, Website Analysis, Marketing Profile, Brand Voice, Market Context, Analytics
Account → Settings, Billing, Notifications (only when real)
Admin (allowlist) → Ops / Pilot
```

---

## 19. Proposed navigation structure

- Collapse secondary intelligence pages behind “Business insights” until used  
- Keep Approvals + Publishing adjacent  
- Hide placeholders from topbar until shipped  

---

## 20. Implementation phases

See `docs/AUTHENTICATED_UX_IMPLEMENTATION_PLAN.md` (PRs A–G).

---

## 21. Test strategy

- Unit: copy/regression for limited fixes; nav config snapshots later  
- Playwright: login → onboarding complete → approvals pending deep link; GBP connect entry; admin ops 403 for non-admin  
- Manual: 390 / 768 / 1024 / 1440 widths; keyboard pass on approvals queue  
- Do **not** snapshot the entire app  

---

## 22. Known limitations of this audit

- No full authenticated live session against MySafetyTeam/Sunspots in this branch  
- Playwright suite remains homepage-only  
- Accessibility not instrumented with axe  
- Mobile judgments largely from component structure + Tailwind breakpoints  
- Relies in part on `docs/RELEASE_CANDIDATE_END_TO_END_AUDIT.md` for historically live-validated defects  

---

## Limited fixes made in this branch

| Fix | Files |
|-----|--------|
| Workflow diagram no longer says “Automatically Published” | `approvals-page.tsx` |
| “How It Works” subtitle honesty | `approvals-page.tsx` |
| Dead Approve All / Refresh → “Review pending” link; mock email CTAs demoted to real links | `approvals-page.tsx` |
| Onboarding GBP points to real connect route | `onboarding-wizard.tsx` |

Documented residual: GBP Disconnect remains UI-only by product decision until a revoke API ships.

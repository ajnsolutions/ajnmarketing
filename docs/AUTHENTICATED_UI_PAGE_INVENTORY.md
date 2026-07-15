# Authenticated UI Page Inventory

Branch: `audit-authenticated-ui-flow` · Date: 2026-07-15

Legend for **Disposition:** keep / combine / rename / move / remove  
**Mobile / A11y:** `ok` = no obvious structural issue · `review` = needs dedicated pass · `risk` = likely problem

---

## Auth & entry

| Route | Title | Persona | Purpose | Primary action | Secondary | Component | Data deps | Mobile | A11y | Disposition | Severity | Notes |
|-------|-------|---------|---------|----------------|-----------|-----------|-----------|--------|------|-------------|----------|-------|
| `/login` | Log In | All | Authenticate | Submit credentials | Signup / forgot | `components/auth/login-form.tsx` | Supabase auth | ok | review | keep | — | Honors safe `?next=` |
| `/signup` | Sign Up | New | Create account | Create account | Login | `signup-form.tsx` | Supabase auth | ok | review | keep | — | |
| `/forgot-password` | (auth) | All | Reset | Send reset | Login | auth forms | Supabase | ok | review | keep | — | |
| `/auth/callback` | — | All | OAuth/code exchange | Redirect | — | `app/auth/callback/route.ts` | Session | n/a | n/a | keep | — | Uses `safeInternalNextPath` |
| `/onboarding` | Onboarding | New | Capture business profile | Complete steps | Skip GBP later | `onboarding-wizard.tsx` | `business_profiles` | review | review | keep | P1 fixed | GBP step now links to real connect |

---

## Customer dashboard

| Route | Title | Persona | Purpose | Primary action | Secondary | Component | Data deps | Mobile | A11y | Disposition | Severity | Notes |
|-------|-------|---------|---------|----------------|-----------|-----------|-----------|--------|------|-------------|----------|-------|
| `/dashboard` | — | Customer | Redirect home | — | — | `app/dashboard/page.tsx` | — | ok | ok | keep | — | → command-center |
| `/dashboard/command-center` | Command Center | Customer | Status + next work | Open priorities | Jobs / wins | `command-center-page.tsx` | command-center server | risk | review | rename/clarify | P2 | Dense; primary home |
| `/dashboard/tasks` | Today's Marketing Tasks | Customer | Daily agent tasks | Complete / regenerate | — | `marketing-agent-tasks-page.tsx` | marketing-agent | review | review | keep | P2 | Overlaps Command Center priorities |
| `/dashboard/approvals` | Approval Center | Customer | Review drafts | Approve / reject / edit | Delivery preview | `approvals-page.tsx` + `approval-queue.tsx` | content approvals + rec packages | review | review | keep | P1 fixed | Deep links `view`/`focus` |
| `/dashboard/approvals/delivery` | Email & SMS Approval Delivery | Customer/Admin | Preview weekly package delivery | Generate live preview | — | `approvals-delivery-page.tsx` | weekly package API | review | review | combine later | P2 | Overlaps weekly package |
| `/dashboard/publishing` | Publishing | Customer | Queue & jobs | Publish now / schedule / retry | History | `publishing-page.tsx` + panels | publishing engine | review | review | keep | P2 | Copy may overstate autonomy |
| `/dashboard/google-business-profile` | Google Business Profile | Customer | Local presence | Sync / manage | Connect | `google-business-profile-page.tsx` | GBP server | review | review | keep | — | |
| `/dashboard/google-business-profile/connect` | Connect GBP | Customer | OAuth connect | Connect Google | Disconnect* | `gbp-connect-page.tsx` | OAuth | ok | review | keep | P1 residual | *Disconnect UI-only |
| `/dashboard/website-analysis` | Website Analysis | Customer | Site insights | Run / refresh analysis | — | `website-analysis-page.tsx` | website-analysis | review | review | keep | P2 | Silent AI fallback |
| `/dashboard/brand-voice` | Brand Voice | Customer | Tone settings | Save* | Refresh* | `brand-voice-page.tsx` | mostly static | review | review | rebuild or hide | P2 | Mock controls |
| `/dashboard/ai-profile` | AI Profile | Customer | Strategy profile | Generate profile | — | `ai-marketing-profile-page.tsx` | AI profile server | review | review | rename | P2 | Prefer “Marketing Profile” |
| `/dashboard/marketing-plan` | Marketing Plan | Customer | Plan view | Create content from plan | Refresh | `marketing-plan-page.tsx` | marketing planner | review | review | keep | — | |
| `/dashboard/marketing-recommendations` | Marketing Recommendations | Customer | Recommended actions | Generate draft | Filters | `marketing-recommendations-page.tsx` | marketing decisions | review | review | keep + empty-state CTA | P1 | Empty without pipeline |
| `/dashboard/content` | Content | Customer | Content overview | Open generator | Approvals/publishing slices | `content-page.tsx` | approvals + publishing | review | review | combine | P2 | Overlaps Approvals |
| `/dashboard/content/generator` | AI Content Generator | Customer | Create drafts | Generate | Send to approval | `content-generator-page.tsx` | generator API | review | review | keep | — | |
| `/dashboard/reviews` | Reviews | Customer | Review replies | Draft / mark responded | Focus deep link | `reviews-hub-page.tsx` | GBP reviews | review | review | keep | — | |
| `/dashboard/market-context` | Market Context | Customer | Local context brief | Refresh brief | — | `market-context-page.tsx` | market-context | review | review | move under insights | P2 | Nav weight |
| `/dashboard/analytics` | Analytics | Customer | Performance | Refresh capture | — | `analytics-page.tsx` | analytics server | review | review | keep | — | |
| `/dashboard/notifications` | Notifications | Customer | Alerts | — | — | `DashboardFeaturePlaceholder` | none | ok | ok | remove from nav until real | P1 | Placeholder |
| `/dashboard/billing` | Billing | Customer | Plans/payment | — | — | `DashboardFeaturePlaceholder` | none | ok | ok | remove from nav until real | P1 | Placeholder |
| `/dashboard/settings` | Settings | Customer | Account/business | — | — | `DashboardFeaturePlaceholder` | none | ok | ok | ship real or demote | P1 | Topbar also links here |
| `/dashboard/[section]` | Placeholder | — | Legacy catch-all | — | — | `dashboard-section-placeholder.tsx` | none | n/a | n/a | remove | P3 | Shadowed by static routes |

---

## Internal admin

| Route | Title | Persona | Purpose | Primary action | Secondary | Component | Data deps | Mobile | A11y | Disposition | Severity | Notes |
|-------|-------|---------|---------|----------------|-----------|-----------|-----------|--------|------|-------------|----------|-------|
| `/dashboard/admin/ops` | Ops Dashboard | Admin | Health, alerts, pilot | Manual ops / issues | Health refresh | `admin-ops-dashboard.tsx` + `assisted-pilot-panel.tsx` | service-role aggregates | review | review | keep | P2 | Not in nav; allowlist only |

Related APIs (not pages): `/api/admin/*`, `/api/health`, `/api/weekly-approval-package/*`, `/api/email-actions/*`.

---

## Severity roll-up on inventory items

- **P1:** placeholders in chrome; recommendations empty-state; GBP disconnect residual; (copy/dead controls fixed this branch)
- **P2:** IA weight, terminology, Brand Voice mock, autonomy copy, overlaps
- **P3:** legacy `[section]` route, visual primitive duplication

# Guided Onboarding and Setup Experience

**Project Magic Phase 3B.** Help a new customer move from account creation to a useful, trustworthy, configured AJN Marketing workspace — without creating a second strategic engine.

## Goals

Answer clearly:

- What do I need to set up?
- Why does each step matter?
- What is complete / optional / blocked?
- What should I do next?
- When is AJN Marketing ready to help me?
- What can I use before every integration is connected?

## Architecture audit summary

| Area | Finding |
|---|---|
| Entry | Signup → `/onboarding` (Magic conversational wizard) → `/dashboard` when `onboarding_completed` |
| Persisted onboarding | `business_profiles` columns + Magic markers in `marketing_goals` / `voice_notes` |
| First-days home | `lib/dashboard/first-days-home.ts` — calm early path, GBP-centric |
| Assisted pilot readiness | Admin/ops only (`lib/assisted-pilot/*`) — **not** the customer setup engine |
| Middleware | Auth gates dashboard/onboarding; incomplete onboarding redirects to `/onboarding` |
| Phase 3A primitives | Status vocabulary, StatusBadge, PageHeader, dashboard states — reused here |

**Authoritative setup-state source:** deterministic derivation from existing product data (`business_profiles`, Google connection status, website analysis, AI marketing profile, marketing plan) via `lib/customer-setup/progress.ts`. Preferences table stores only non-derivable skips/acknowledgements/dismissals.

## Setup categories and steps

Categories: Foundation · Connections · Strategy readiness · Execution readiness · Optional enhancements.

| Key | Required? | Notes |
|---|---|---|
| `business_info` | Yes | Real business name |
| `website` | No | Skip / “no website” supported |
| `marketing_goals` | Yes | Picker goals **or** Magic audience/origin markers |
| `brand_voice` | No | Recommended |
| `google_business` | No | Never blocks whole product |
| `notifications` | No | Educational / deferrable |
| `ai_marketing_profile` | No | Recommended |
| `marketing_plan` | No | Recommended |
| `head_of_marketing` | Yes | Ready when onboarding + basics + goals |
| `approval_education` | No | Acknowledge only |
| `publishing_education` | No | Acknowledge only |
| `content_ready` | No | Voice or profile present |
| `marketing_preferences` | No | Optional enhancement |

**[RC-1]** The `notifications` step's CTA previously read "Review notifications" with a description implying configurable preferences ("How you prefer to hear about approvals and important updates") — but its destination (`/dashboard/notifications`) is an honest "coming soon" page with nothing to review. Copy corrected to accurately set expectations (`See how updates work`) rather than promising functionality that doesn't exist yet. See [`RC1_AUTHENTICATED_PILOT_VALIDATION.md`](./RC1_AUTHENTICATED_PILOT_VALIDATION.md).

## Required versus optional

Required setup is limited to foundation for a useful Head of Marketing:

1. Business profile with a real name  
2. Marketing direction (goals and/or Magic audience/origin)  
3. Onboarding completed (existing gate)

Google Business, Brand Voice, website analysis, and educational steps are optional or recommended. Optional incompleteness does **not** reduce required percent complete.

## Progress calculation

`computeCustomerSetupSnapshot` produces:

- required/optional complete counts and required percent  
- overall status (`not_started` → `in_progress` → `ready_for_head_of_marketing` / `complete` / `needs_attention`)  
- next recommended step, blocked/needs-attention keys  
- `canEnterMainProduct`, `headOfMarketingReady`, Google data availability  
- concise readiness explanation  

Statuses are customer-facing labels via `statusLabels.ts` — never raw DB enums.

Assisted-pilot readiness scores remain separate (admin). This calculator does not invent a second weighted pilot score.

## Persistence

Prefer derived state. Migration **031** adds `customer_setup_preferences`:

- `skipped_step_keys`, `acknowledged_step_keys`  
- `onboarding_dismissed_at`, `setup_completed_acknowledged_at`  
- `last_visited_step_key`  
- unique on `business_profile_id`  
- RLS requires `auth.uid()` ownership **and** matching `business_profiles.user_id`  

No secrets. Clients cannot write completion percentages or mark derived steps complete.

“No website” also uses `voice_notes` marker `Website: none confirmed.` (same pattern as deferred social connections).

## First-login behavior

1. Magic `/onboarding` remains the first-run wizard (unchanged architecture).  
2. After completion, `/dashboard` may show First Days home, HoM briefing, or honest setup readiness panel.  
3. Canonical guided checklist: `/dashboard/setup` — not a modal trap; leave/resume anytime.

## Phase 3C: operational visibility into setup

`GET /api/admin/ops?view=tenants` (admin-only) surfaces a per-tenant `setup` health dimension by calling the same `getCustomerSetupSnapshotForUser` used here — it does not introduce a second setup-completion calculation. See [`PRODUCTION_OPERATIONS_AND_PILOT_HARDENING.md`](./PRODUCTION_OPERATIONS_AND_PILOT_HARDENING.md).

## Surfaces

| Surface | Role |
|---|---|
| `/dashboard/setup` | Canonical checklist |
| `/dashboard/setup/business` | Business information form |
| `/dashboard/setup/goals` | Goals + audience/origin editor |
| Command Center card | Concise progress while required incomplete / needs attention |
| Settings hub | Discoverability links |
| HoM readiness panel | Explains missing required items — never fake strategy |
| First Days home | Links to setup without replacing calm early path |

## Google Business states (customer-facing)

Distinguishes available / not connected / connected / needs reauth / temporarily unavailable. Customer UI does **not** expose env vars, client IDs, secrets, redirect URI diagnostics, or raw provider errors. Technical diagnostics stay admin/ops.

## Recovery

Blocked/failed steps explain impact and next action (retry sync, reconnect, fix URL, continue other setup). Optional source failures do not blank the setup page.

## Resume / dismiss

- Progress derives from product data.  
- Soft dismiss hides the dashboard card until needs-attention or user returns via Settings/Setup.  
- Needs-attention always resurfaces the card.  
- Setup is business-scoped (one prefs row per `business_profile_id`); app is 1:1 user↔business today.

## Existing-user compatibility

Mature accounts derive complete required setup from existing profile/goals/onboarding flags. Magic audience markers count as goals. New optional steps do not force incomplete states. No forced onboarding modal every login.

## Multi-user / tenant

APIs resolve business profile from the authenticated user — never trust client-supplied `business_profile_id`. RLS blocks cross-tenant prefs. Cross-tenant reads/writes return 401/404 via auth + profile scoping.

## Accessibility & mobile

- One `h1` on setup surfaces  
- Semantic lists + text status labels (not color-only)  
- `role="progressbar"` with valuemin/max/now  
- Labels, required markers, associated errors, success `role="status"`  
- `min-h-11` actions; stack on small screens  
- Reduced-motion respected on progress transition  

## Performance

Parallel fact gathers in `sources.ts`. Single snapshot read API. No unsafe cross-tenant caching. Preferences writes are narrow and idempotent.

## APIs

- `GET /api/setup/status`  
- `POST /api/setup/preferences`  
- `POST /api/setup/steps/[key]/skip`  
- `POST /api/setup/steps/[key]/acknowledge`  

Authenticated, tenant-scoped, allowlisted keys, customer-safe errors.

## No duplicate engines

Does **not** create a second readiness/pilot/onboarding/business-profile/goals/Brand Voice/Google/HoM engine. Adapts existing data; assisted-pilot remains admin-labeled separately.

## Non-goals

No recommendation ranking changes, autonomous campaigns/experiments/publishing/approvals, OAuth architecture changes, LLM/ML/providers, schedule activation, billing changes, or Marketing Director logic changes.

## Remaining onboarding debt

- Richer multi-user roles when team accounts ship  
- Deeper Settings business editor beyond setup forms  
- GBP location-selection UX still phased  
- Notification preference product surface still “coming soon”  
- Authenticated Playwright against live fixtures when credentials available  

## Authenticated smoke checklist

1. Sign in as incomplete fixture → `/dashboard/setup` shows required progress.  
2. Complete business info → progress updates.  
3. Save goals → Head of Marketing readiness unlocks when onboarding complete.  
4. Skip Google → remains discoverable; product still usable.  
5. Confirm no website → website step skipped.  
6. Command Center card links to setup; dismiss soft-hides; reconnect-needed resurfaces.  
7. Mature account is not forced through wizard.  
8. Viewer/unauth cannot mutate; cross-tenant blocked.  
9. No campaigns/experiments/publishes created on load.  
10. Confirm `ATTACH_DECLARATIVE_PRODUCTION_CRONS = false`.

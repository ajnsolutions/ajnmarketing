# Release Candidate End-to-End Audit — AJN Marketing

- **Status:** Complete
- **Date:** 2026-07-13
- **Author:** Investigation, live testing, and documentation performed by Claude Code on branch `release-candidate-end-to-end-audit`
- **Scope:** Investigation and validation only. No new product features, no recurring Trigger.dev schedule, no live Google Business Profile publish, no destructive production-data cleanup, no migration. All testing ran against the one real Supabase project this codebase is already wired to (there is no separate staging project) — see [§3](#3-test-environment-and-account-used) for exactly what that means and what was and wasn't touched.

---

## 1. Executive Summary

AJN Marketing's individual features — onboarding, website analysis, AI marketing profile generation, market context, opportunity detection, the decision engine, content drafting, approval, and the publishing queue/job state machine — are **well-built, correctly isolated per tenant, and behave correctly when exercised**, including under live testing against the real database in this audit (not just unit tests). Security (RLS, ownership checks, error-message sanitization) is a strength: 11/11 live cross-tenant RLS tests passed, using two throwaway auth accounts created and destroyed for exactly this purpose.

However, the product's own stated architecture — **Business setup → Website Analysis → AI Marketing Profile → Market Context → Opportunity Detection → Decision Engine → Recommendation → Content Draft → Approval → Publishing Queue → GBP publish → Analytics Capture → Feedback into future recommendations** — is **not currently a connected, automatic pipeline**. Two of its middle stages (Opportunity Detection and the Decision Engine) have **zero trigger anywhere in the product**: no UI button, no API route, no background job, no Trigger.dev task. They only ran during this audit because they were invoked directly, bypassing the entire application layer. Without that manual intervention, `/dashboard/marketing-recommendations` is permanently empty for every real user, and the feedback loop from analytics back into new recommendations never closes. This matches and extends `docs/ADR_AUTONOMOUS_SCHEDULER.md`, already in this repo, which documents the same "nothing runs without a page load" architecture at a broader level and proposes Trigger.dev as the fix — a fix that is legitimately out of scope for this audit PR per its own instructions (no new schedules, no new features).

A second class of finding is **copy/reality mismatches that misrepresent current capability in both directions**: the Approval Center's own page claims content goes "From AI draft to published — automatically," which is not true (adding to the queue and publishing are both separate manual steps); the onboarding wizard tells new users Google Business Profile connection is "coming soon" when a fully working, live-verified OAuth flow exists elsewhere in the product; the GBP connect page shows "Coming soon" sync-checklist badges for sync functionality that is, in fact, fully implemented. None of these are security issues, but shipped to a real pilot customer they would each independently look like a bug or a broken promise.

A third finding is a **live-side-effect bug with real safety implications once GBP is connected**: `GET /api/publishing` (fired by simply loading or refreshing the Publishing dashboard page) synchronously executes any due scheduled/retrying job — including a real Google API call — with no dry-run or sandbox gate anywhere in the code. This was directly observed during this audit: a publishing job's retry count incremented from a background retry that fired purely because the dashboard was reloaded during unrelated navigation.

Finally, a **standing security item from a prior session remains unresolved**: `docs/ADR_AUTONOMOUS_SCHEDULER.md` records that a legacy Supabase service-role JWT was printed in full to a terminal during an earlier investigation and flagged for rotation. You confirmed during this audit's approval step that rotation has **not** been confirmed. This should be treated as unresolved until verified.

---

## 2. Release Verdict: **Ready with conditions**

Not "Ready for pilot" as-is, and not "Not ready" — the foundations (security, tenant isolation, individual feature correctness, error handling, retry/audit machinery) are genuinely solid and proven under live testing, not just code review. But the product cannot currently deliver on its core "autonomous marketing loop" premise without either (a) a human manually running the pipeline stages that have no product-level trigger, or (b) completing the orchestration work `docs/ADR_AUTONOMOUS_SCHEDULER.md` already scoped — both of which are legitimately out of scope for this audit branch, but must be a conscious decision before calling this "autonomous" to a pilot customer.

**Conditions for pilot readiness**, in priority order:
1. Rotate the flagged Supabase service-role key, or confirm in writing that it was already rotated (Blocking — see [§11](#11-defects-classified)).
2. Decide and communicate explicitly how Opportunity Detection → Decision Engine will run for pilot customers: manually triggered by AJN ops per customer, or held until Trigger.dev scheduling ships (Blocking for an "autonomous" pilot claim; not blocking for a manually-operated pilot).
3. Fix the Approval Center's "automatically published" copy to match actual (manual, two-step) behavior, and fix the two GBP-related copy mismatches (High).
4. Add a dry-run/sandbox gate — or at minimum stop executing due jobs as a side effect of `GET /api/publishing` — before any pilot customer connects a real GBP account (High).
5. Fix or remove the GBP "Disconnect" button, which currently does nothing but claims to (High).

None of these require this branch to hold up — they are documented below as separate, scoped follow-up branches ([§14](#14-proposed-follow-up-branches)).

---

## 3. Test Environment and Account Used

- **Supabase project:** the one and only project this codebase is configured against (`dqcsptbgladjfdbybeda`, `AJN marketing`, Postgres 17.6, `us-west-2`) — confirmed via `supabase projects list` and `.env.local`. There is no separate staging/test Supabase project.
- **Test account:** at the start of this audit, **exactly one** `auth.users` row existed in the entire project. That account (business profile `AJN solutions, LLC`, onboarding already complete, website analysis / AI marketing profile / market context already populated from prior work) was used as the primary subject for every non-destructive, non-external-effect test in this audit, per your explicit approval.
- **Tenant-isolation testing** used two **throwaway** auth accounts, created via the Supabase admin API immediately before the test and fully deleted (auth user + all seeded rows) immediately after — see [§7](#7-security-and-tenant-isolation-results). The real account was never used as either side of a cross-tenant test.
- **Local production server**: `npm start` (production build, not `next dev`) on `localhost:3000`, per your instruction to test against a production build locally.
- **GBP connection**: not connected at the start of this audit, and **remains not connected** — you chose to skip live GBP publish testing for this audit ([§8](#8-external-integrations-results)).
- **Trigger.dev**: no project provisioned. `trigger.dev dev start --help` confirms even "local" execution requires a project ref and defaults to `api.trigger.dev` — so "local dev CLI only" (your chosen option) turned out not to be achievable without at least a free Trigger.dev Cloud signup, which was out of scope for this audit. Analytics capture's core logic was instead validated directly (bypassing the Trigger.dev wrapper), matching the same approach already required for Opportunity Detection and the Decision Engine.
- **Credentials used:** `SUPABASE_SECRET_KEY` (service-role, for user provisioning/cleanup and for calling the same injectable-client functions Trigger.dev tasks call), `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY`, `OPENAI_API_KEY` (one real content-draft generation). No Google credentials were exercised (no GBP connection). No credential value was ever printed to terminal output, logs, or this document — see the one exception and its remediation in [§11](#11-defects-classified), item "OTP-session-URL logging incident."

---

## 4. Stages Tested

All 12 pipeline stages plus auth/RLS, onboarding, GBP connection, publishing, analytics, UX, and observability — see the pass/fail table in [§6](#6-passfail-table) and full narrative in [§8](#8-external-integrations-results)–[§10](#10-observability-findings).

## 5. Evidence Collected

All evidence below comes from **live execution against the real database and a real production server**, not from reading code alone (code-level findings from the pre-test investigation are cited separately where relevant). Reproduction scripts are committed under `scripts/audit/` in this branch:

| Script | What it proved |
|---|---|
| `scripts/audit/rls-tenant-isolation.ts` | 11/11 live RLS/tenant-isolation checks pass — full output in [§7](#7-security-and-tenant-isolation-results) |
| `scripts/audit/run-marketing-pipeline.ts` | `evaluateOpportunitiesForUser` + `runMarketingDecisionEngineForUser` run correctly and idempotently against the real account when manually invoked |
| `scripts/audit/run-content-draft.ts` | A real content draft, grounded in real business data and the real detected opportunity, generated via `generateContentDraftForRecommendation`; rerun correctly reused the same draft |
| `scripts/audit/browser-walkthrough.mjs` | Real authenticated Playwright session (via a service-role-issued OTP, cookies serialized with `@supabase/ssr`'s own code) drove Approve → Add to Queue → Publish Now, and swept all 21 dashboard pages: 0 console errors, 0 failed/4xx/5xx requests |
| `scripts/audit/mobile-viewport-check.mjs` | 0/8 key pages show horizontal overflow at 375×812 |
| `scripts/audit/auth-pages-check.mjs` | Signup/login/forgot-password pages render correctly, 0 console errors |
| `scripts/audit/run-analytics-capture.ts` | `captureSnapshotForUser` upserts correctly (same snapshot id on rerun, exactly 1 row per user+date) |

Concrete evidence produced by these runs, all on the real account (kept, not deleted — see [§15](#15-remaining-manual-tests) for cleanup notes):

- **Opportunity detection**, run live: 2 opportunities detected — a `seasonal` opportunity and a `local_event` opportunity sourced from a Market Context **fallback** item ("Neighborhood business mixer near Danville, CA" — one of `localEventsProvider.ts`'s two hardcoded fallback events, concrete proof that fallback data flows all the way into a real, persisted opportunity).
- **Decision engine**, run live: 2 recommendations generated (`create_timely_content`, `create_seasonal_content`), correctly merged/scored/prioritized. **Rerun immediately after produced the identical 2 recommendation IDs — zero duplicates, proving idempotency live, not just in unit tests.**
- **Content drafting**, run live: one real OpenAI-generated draft, genuinely grounded in the account's real business data ("AJN Solutions... Section 125 plans and CHAMP Plan™... increase employee net pay by $100/month...") and the real detected local-event opportunity — not generic template copy. Recommendation correctly flipped `open → in_progress` only after the draft insert succeeded. **Immediate rerun correctly reused the same draft (`reused: true`, identical id) rather than duplicating it.**
- **Approval Center**, exercised live via real browser session: Approve succeeded, "Add to Publishing Queue" succeeded.
- **Publishing engine**, exercised live: "Publish Now" clicked with no GBP connection present → job entered `retrying` with `last_error: "Sync Google Business Profile locations before publishing."` — a clean, safe, non-leaking error, exactly as the code review predicted, with `publishing_history` correctly recording `queued → publish_started → retrying` transitions and the UI's Retry/Cancel/History controls all present and correctly labeled. **A second retry attempt fired on its own** during unrelated dashboard navigation later in the same session — live, first-hand confirmation of the `GET /api/publishing` live-side-effect finding ([§9](#9-ux-findings), [§11](#11-defects-classified)).
- **Analytics capture**, run live: snapshot upserted correctly, identical row on immediate rerun.

## 6. Pass/Fail Table

| # | Stage | Result | Notes |
|---|---|---|---|
| 1 | Business setup / onboarding | PASS | Real account already had `onboarding_completed: true`; wizard code-reviewed, fully wired |
| 2 | Website Analysis | PASS | Existing row confirmed `completed`; has a silent placeholder-fallback path on OpenAI failure (documented, not a bug) |
| 3 | AI Marketing Profile | PASS | Existing row confirmed `active`; fails loudly (no silent placeholder) — a deliberately different (better) failure posture than Website Analysis |
| 4 | Market Context | PASS with caveats | Real brief exists (11 items); 3 of 7 providers are always-stub (news/trends/school-calendar), honestly labeled via a live/fallback badge |
| 5 | Opportunity Detection | **PASS functionally, FAIL for automatic operation** | Ran correctly and idempotently when invoked directly; **zero trigger anywhere in the product** |
| 6 | Decision Engine | **PASS functionally, FAIL for automatic operation** | Same as above — correct and idempotent, **zero trigger anywhere in the product** |
| 7 | Recommendations UI | PASS | Real page, populated after manual pipeline invocation; 0 console errors, filters/cards/evidence render correctly |
| 8 | Content Drafting | PASS | Real OpenAI draft, correctly grounded, correct ownership, correct reuse/idempotency |
| 9 | Approval Center | PASS with caveats | Approve/reject/regenerate work; several buttons decorative; "automatically published" copy is false |
| 10 | Publishing Queue | PASS | Queue creation, dedupe, and manual-step gating all correct |
| 11 | Publishing Job / retry state machine | PASS with a safety caveat | Full state machine verified live (queued→publishing→retrying); `GET` has a live side effect |
| 12 | GBP publish (live) | **NOT TESTED** | Deferred with your approval; connect/sync/reviews/posts/insights code-reviewed as real, live integrations |
| 13 | Analytics Capture | PASS functionally, **FAIL for automatic operation** | Correct/idempotent core logic; only 2 manually-invocable Trigger.dev tasks exist, neither scheduled, no project provisioned |
| 14 | Feedback → future recommendations | **FAIL (dead in production)** | `decliningEngagement` detector correctly reads `analytics_snapshots`, but is unreachable since Opportunity Detection never runs in production |
| 15 | Tenant isolation | PASS | 11/11 live RLS tests |
| 16 | Auth (signup/login/redirects) | PASS | Redirects correct; forms render correctly; underlying session mechanism (OTP) verified live |
| 17 | Automated verification suite | PASS | `test:unit` 209/209, `test:e2e` 1/1, `build` clean, `lint` at established 15-problem baseline |
| 18 | Browser bundle privileged-symbol check | PASS | No service-role/token/error-class symbols found in `.next/static/` |

## 7. Security and Tenant-Isolation Results

Live results from `scripts/audit/rls-tenant-isolation.ts` (two throwaway tenants, created and fully deleted within the same run):

```
PASS  business_profiles: same-tenant insert succeeds
PASS  business_profiles: same-tenant insert succeeds (tenant B)
PASS  business_profiles: tenant B cannot read tenant A's profile  -- rows returned: 0
PASS  business_profiles: tenant B cannot update tenant A's profile  -- rows affected: 0
PASS  marketing_opportunities: tenant B cannot read tenant A's opportunity  -- rows returned: 0
PASS  marketing_opportunities: tenant A can read own opportunity  -- rows returned: 1
PASS  marketing_recommendations: tenant B cannot read tenant A's recommendation  -- rows returned: 0
PASS  create-content: tenant B cannot generate a draft from tenant A's recommendation
        -- result=null error=Recommendation not found for this user.
PASS  content_approvals: tenant B cannot read tenant A's approval  -- rows returned: 0
PASS  publishing_queue: tenant B cannot read tenant A's queue item  -- rows returned: 0
PASS  business_profiles: unauthenticated client cannot read any profile  -- rows returned: 0

11/11 checks passed.
```

This directly proves, live: unauthenticated access is blocked; tenant A's writes succeed; tenant B cannot read or write tenant A's `business_profiles`, `marketing_opportunities`, `marketing_recommendations`, `content_approvals`, or `publishing_queue` rows; and the application-layer ownership check inside `generateContentDraftForRecommendation` correctly rejects a cross-tenant draft-generation attempt with a clean, non-leaking error message rather than a raw database error.

**Code-level corroboration** (from the pre-test investigation, not re-quoted in full here): every table in scope has RLS enabled with `auth.uid() = user_id` policies (or the correct `exists`-subquery variant for the two child tables without their own `user_id` column); every `createServiceRoleClient()` call site (3 total in the whole codebase) explicitly scopes its query by `userId` even though the client itself bypasses RLS; `/api/*` routes are not blocked by middleware but every sampled route does its own `getUser()` check.

**Supabase's own security advisor** (`supabase db advisors --type security`, run live against the linked project) found:
- `demo_requests` has an `INSERT ... WITH CHECK (true)` policy for `anon` — likely intentional (public "request a demo" form) but should be explicitly confirmed, and rate-limited if not already, since it allows unlimited anonymous inserts.
- Leaked-password protection is disabled on Supabase Auth (HaveIBeenPwned check) — a one-toggle fix.
- ~15 trigger functions (`set_*_updated_at`) have a mutable `search_path` — standard hardening item, low real-world risk here since these are simple timestamp triggers, not privilege-sensitive logic.

**Standing item, unresolved:** `docs/ADR_AUTONOMOUS_SCHEDULER.md` records that a legacy Supabase service-role JWT was printed in full to a terminal during a prior session and flagged for rotation. You confirmed during this audit that rotation is **not** confirmed. Treat as unresolved — see [§11](#11-defects-classified).

**Incident during this audit, self-remediated:** an early version of the browser-walkthrough script logged `page.url()` immediately after a magic-link redirect, which briefly printed a live access token, refresh token, and the account's email (already known from this session's own context, so not new PII exposure) into this conversation's output. The session was immediately revoked via `supabase.auth.admin.signOut(token, 'global')` (confirmed `OK`), and the script was rewritten to serialize sessions into cookies via `@supabase/ssr`'s own code (never via a URL) and to redact any token-shaped query parameters before logging any URL. All subsequent runs used the fixed approach. Flagging this transparently per your instruction to report security-relevant events.

## 8. External Integrations Results

- **Google Business Profile**: OAuth connect/callback flow, token storage/refresh/revocation handling, and the live token-verification status check are all real and code-reviewed as correct (CSRF-protected state, encrypted token storage, 5-minute-TTL live re-verification against Google's `tokeninfo` endpoint, not just a stored-row check). **Not live-tested** — no connection was established, per your decision to skip live GBP testing for this audit. Reviews, posts, and insights sync are all real Google API integrations (not stubs), confirmed via code review.
- **Live GBP publish**: **not performed.** The publishing job/queue state machine was instead validated end-to-end using the *absence* of a GBP connection as a safe way to exercise the real failure path — see [§5](#5-evidence-collected). The actual `createGoogleBusinessLocalPost` call (`lib/google-business/publish.ts`) was never invoked.
- **OpenAI**: real calls made for opportunity→recommendation→**content draft generation** (one real draft, billed). Market Context, by contrast, needs no OpenAI or any paid API — its "live" providers (weather.gov, Nager.Date holidays, RSS feeds) are all free/unauthenticated.
- **Trigger.dev**: no live task execution (no project provisioned — see [§3](#3-test-environment-and-account-used)). Core business logic validated directly instead.
- **Supabase**: fully live throughout this audit (advisors, direct queries, RLS tests, admin user provisioning).

## 9. UX Findings

Positive, live-verified: **0 console errors and 0 failed/4xx/5xx network requests across all 21 dashboard pages**, desktop (1280×800) and **0/8 pages with horizontal overflow** at mobile (375×812). Unauthenticated `/dashboard` and `/onboarding` both correctly redirect to `/login`.

Findings from the pre-test code investigation, not contradicted by anything observed live:
- **Approval Center's own page** (`components/dashboard/approvals-page.tsx`) shows a 4-step "AI Creates → Customer Reviews → Approve → Automatically Published" diagram and subtitle "From AI draft to published — automatically." **This is false** — approving only sets `status: "approved"`; adding to the queue and publishing are both separate, manual user actions, confirmed live in this audit's own walkthrough.
- Several Approval Center buttons are **non-functional decoration**: header "Approve All"/"Refresh Queue," "AI Priorities" → "Review," and the entire Email/SMS preview mockup section — no `onClick` handler at all.
- The **Brand Voice page** is mostly a static mockup: only the Notes textarea persists anything real; "Refresh Voice Profile," "Save Voice Settings," tone-adjustment chips, the "Voice Match Score," "Sample AI Content" cards, and the "AI Learning Timeline" (with hardcoded dates) are all non-functional or hardcoded, regardless of actual account state.
- The **onboarding wizard's** Google Business Profile step shows a disabled button with "Google connection coming soon," even though a fully working, live-verified connect flow exists on the dashboard.
- The **GBP connect page's** "Sync Checklist" section shows static amber "Coming soon" badges for sync functionality (locations, reviews, posts, insights) that is, in fact, fully implemented and working.
- The **GBP "Disconnect" button** is UI-only — it sets local text ("Disconnect is UI-only for now...") and does not revoke the token or delete the connection row. There is no revoke route anywhere in the API.
- Approval Center's own "Regenerate" action (distinct from the recommendation flow's real AI regeneration) uses **canned-suffix placeholder text**, not a fresh OpenAI call, and its insert omits `marketing_recommendation_id`, silently severing the link back to the originating recommendation.
- `publishing_queue`'s "Mark Published" button can force a queue item's status to `"published"` with **no corresponding `publishing_jobs` row and no Google API call** — a manual escape hatch that can desync the two tables' status views.
- Empty-state copy for Marketing Recommendations was already hardened in PR #17 (this audit's immediately preceding branch) to avoid implying an active background watcher — confirmed still accurate.

## 10. Observability Findings

- **No consistent structured-logging utility** exists across `lib/` — scattered raw `console.*` calls, one small `providerLogger.ts` used only by Market Context, and genuinely structured logging only inside the Trigger.dev analytics-capture task (visible only in the Trigger.dev dashboard, which isn't provisioned).
- **`audit_logs` has 41 distinct event types and is write-only from an operator's perspective** — confirmed by both code review and this audit's own `audit_logs` count (79 rows by the end of this session, all correctly attributed) — there is no UI or API route anywhere that reads it. An operator must query Supabase directly to see it.
- **Publishing failures are the one subsystem with a genuinely mature, UI-visible failure story**: `last_error`, `retry_count`, a dedicated "Failed" bucket, and full per-job history, all confirmed live in this audit (`publishing_history` correctly recorded `queued → publish_started → retrying → publish_started → retrying`).
- **GBP connection health is live-verified, not just a stored-row check** — a genuine positive finding, confirmed by code review (5-minute TTL, real `tokeninfo` calls, correctly distinguishes "was fine, refreshed fine" from "genuinely revoked").
- **AI Marketing Profile has structured OpenAI failure capture** (`AiMarketingProfileGenerationError` with provider/model/status/code/requestId); this pattern is **not** generalized to the content generator, marketing planner, or review-reply drafting, which use plain `Error`s.
- **Bottom line, unchanged from the pre-test investigation and not contradicted by live testing**: an operator can self-serve "did my scheduled post fail to publish" from the UI alone. Almost anything upstream of that — why a recommendation was or wasn't generated, analytics capture health, GBP sync attempt history — requires direct Supabase access to diagnose.

## 11. Defects Classified

### Blocking
1. **Service-role key rotation status unconfirmed.** `docs/ADR_AUTONOMOUS_SCHEDULER.md` documents a legacy Supabase service-role JWT printed in full to a terminal in a prior session. You confirmed during this audit that rotation is not confirmed. **Must be resolved (rotated, and old key invalidated) before any production deployment.**
2. **Opportunity Detection and the Decision Engine have no trigger anywhere in the product.** `/dashboard/marketing-recommendations` is permanently empty for any real user without a developer manually invoking two internal functions. This is blocking specifically for an *autonomous* pilot claim — not blocking if the pilot is explicitly scoped as manually-operated by AJN ops in the interim.

### High
3. **`GET /api/publishing` executes due jobs as a side effect of a page load**, including a real Google API call once GBP is connected, with no dry-run/sandbox gate anywhere. Observed live in this audit (a retry fired purely from unrelated dashboard navigation).
4. **Approval Center claims automatic publishing that does not exist** ("From AI draft to published — automatically" / the 4-step workflow diagram). Confirmed both by code and by this audit's live walkthrough (Approve did not queue or publish anything on its own).
5. **GBP "Disconnect" button does nothing** — no revoke/delete route exists anywhere in the API. A customer wanting to disconnect cannot, through the product.
6. **Approval Center's own "Regenerate" silently severs the link to its originating recommendation** (omits `marketing_recommendation_id` on insert) and uses canned placeholder text instead of a real AI regeneration, unlike the recommendation flow's own (correct) regenerate action.
7. **The analytics→opportunities feedback loop is dead in production.** `detectDecliningEngagement` correctly reads `analytics_snapshots`, but since Opportunity Detection never runs automatically, fresh analytics data never actually produces a new recommendation for any real user, contradicting the product's own stated architecture.

### Medium
8. **Onboarding wizard shows GBP connection as "coming soon"** while a fully working flow exists elsewhere — new users are misinformed at exactly the moment they're being onboarded.
9. **GBP connect page's "Sync Checklist" shows stale "Coming soon" badges** for functionality that is fully implemented.
10. **Several Approval Center and Brand Voice page controls are non-functional decoration** (header buttons, tone chips, sample-content cards, hardcoded "AI Learning Timeline").
11. **`publishing_queue`'s "Mark Published" can desync from `publishing_jobs`** — no corresponding job row or Google call, a manual override with no guard rail.
12. **Dedupe-key instability for context-sourced opportunities**: `market_context_items` are insert-only (never upserted), so the holiday/weather/local-event opportunity detectors' dedupe key (`item.id`) changes on every Market Context refresh, undermining their intended idempotency guarantee over time (does not cause active-row duplication today because status-preservation logic still protects dismissed/resolved rows, but will accumulate stale expired rows faster than necessary).
13. **Website Analysis silently degrades to a non-AI placeholder on OpenAI failure**, while AI Marketing Profile deliberately does not (fails loudly instead) — an inconsistent product decision worth resolving explicitly rather than leaving as an accident of two different implementations.
14. **Leaked-password protection is disabled** on Supabase Auth (Supabase's own advisor finding) — a one-toggle fix.

### Low
15. **3 of 7 Market Context providers (news, trends, school-calendar) never make a real network call**, always returning hardcoded template content. Honestly labeled via the existing live/fallback UI badge, so this is a completeness gap, not a trust/accuracy issue.
16. **~15 trigger functions have a mutable `search_path`** (Supabase advisor finding) — standard hardening, low real-world risk for simple `updated_at` triggers.
17. **`demo_requests` allows unrestricted anonymous inserts** — likely intentional for the public "request a demo" form; confirm intent and consider rate-limiting.
18. **No consistent structured-logging utility** across `lib/` — scattered `console.*` calls with no shared convention.
19. **`audit_logs` has no UI or API reader anywhere** — 41 event types captured, none visible without direct database access.

## 12. Reproduction Steps for Every Defect

| # | Defect | Reproduction |
|---|---|---|
| 1 | Key rotation unconfirmed | Read `docs/ADR_AUTONOMOUS_SCHEDULER.md` §2.7; ask whether the key referenced there has been rotated since (this audit did — answer was no/unsure) |
| 2 | No trigger for detection/decision engine | `grep -rn "evaluateOpportunitiesForUser\|runMarketingDecisionEngineForUser" app/` → zero route/component matches; confirmed live by this audit's `run-marketing-pipeline.ts`, which had to call the functions directly |
| 3 | Live GET side effect | Queue a publishing job, let it fail once (or schedule for the near future), then simply load/refresh `/dashboard/publishing` — `GET /api/publishing` → `processDueScheduledPublishingJobsForUser` executes it inline; observed live in this audit as an unprompted retry |
| 4 | False "automatic" publishing claim | Approve a draft in `/dashboard/approvals`, observe nothing happens to `publishing_queue`; compare against the page's own "Automatically Published" copy |
| 5 | Disconnect button does nothing | `/dashboard/google-business-profile/connect`, click Disconnect → local text only, `google_business_profile_connections` row and Google grant untouched; `grep -rn "DELETE" app/api/google-business-profile/` → no route |
| 6 | Regenerate severs recommendation link | `lib/content-approval/service.ts` regenerate branch → its insert object has no `marketing_recommendation_id` key |
| 7 | Feedback loop dead | `grep -rn "evaluateOpportunitiesForUser" lib/background-jobs/worker.ts app/` → handler exists in the worker switch, but zero enqueue call sites anywhere |
| 8 | Onboarding GBP stale copy | `components/onboarding/onboarding-wizard.tsx` step 3, disabled button + "coming soon" text |
| 9 | Sync checklist stale copy | `components/dashboard/gbp-connect-page.tsx` "Sync Checklist" section, hardcoded badges |
| 10 | Decorative buttons | `components/dashboard/approvals-page.tsx` header buttons and Email/SMS preview section; `components/dashboard/brand-voice-page.tsx` header buttons and tone chips — none have `onClick` |
| 11 | Mark Published desync | `lib/publishing-queue/service.ts` `mark_published` branch — no `publishing_jobs` interaction |
| 12 | Dedupe-key instability | `lib/marketing-opportunities/persistence.ts` `saveMarketContextItems` is a plain `insert`, not upsert; opportunity dedupe key for holiday/weather/local_event is `item.id` |
| 13 | Inconsistent OpenAI-failure posture | Compare `lib/website-analysis/service.ts` (silent placeholder fallback) against `lib/ai-marketing-profile/service.ts` (fails loudly, no fallback) |
| 14 | Leaked-password protection off | `supabase db advisors --linked --type security` → `auth_leaked_password_protection` WARN |
| 15 | Stub Market Context providers | `lib/market-context/providers/{newsProvider,trendsProvider,schoolCalendarProvider}.ts` — no `fetch` call in any of the three |
| 16 | Mutable search_path | `supabase db advisors --linked --type security` → `function_search_path_mutable` ×~15 |
| 17 | Open demo_requests insert | `supabase db advisors --linked --type security` → `rls_policy_always_true` on `demo_requests` |
| 18 | No structured logging | `grep -rln "console\." lib/` across 8 files, no shared logger module |
| 19 | audit_logs has no reader | `grep -rln "audit-log-server\|getAuditLogsForUser" app/` → zero matches |

## 13. Recommended Repair Order

1. Confirm/rotate the service-role key (Blocking #1) — a config/ops action, no code change, do first.
2. Decide the Opportunity Detection/Decision Engine trigger question (Blocking #2) — a product/architecture decision, likely resolved by adopting the ADR's Trigger.dev plan; until then, explicitly scope pilots as manually-operated.
3. Fix the `GET /api/publishing` live side effect (High #3) — move due-job processing off the read path, or gate behind an explicit action/cron.
4. Fix the Approval Center's misleading copy (High #4) and implement or remove the GBP Disconnect button (High #5) — both are customer-facing trust issues, low implementation cost.
5. Fix Approval Center's Regenerate to either call the real AI path or clearly relabel itself, and preserve `marketing_recommendation_id` on regeneration (High #6).
6. Everything else (Medium/Low) can follow in any order — none block a manually-operated pilot.

## 14. Proposed Follow-Up Branches

| Branch | Scope |
|---|---|
| `harden-publishing-get-side-effect` | Remove the live-execution side effect from `GET /api/publishing`; add explicit dry-run/sandbox gate before any pilot GBP connection |
| `fix-approval-center-copy-and-regenerate` | Fix "automatically published" copy, fix Regenerate to preserve `marketing_recommendation_id` and either call real AI or relabel |
| `implement-gbp-disconnect` | Real token revocation + connection-row deletion behind the existing Disconnect button |
| `fix-onboarding-and-gbp-connect-stale-copy` | Remove "coming soon" language from onboarding wizard step 3 and the GBP connect page's sync checklist |
| `remove-decorative-buttons-or-wire-them` | Approval Center header buttons, Email/SMS preview section, Brand Voice page controls — either implement or remove |
| `fix-market-context-item-upsert` | Change `saveMarketContextItems` to upsert on a stable key, stabilizing the holiday/weather/local-event opportunity dedupe keys |
| `supabase-advisor-hardening` | Enable leaked-password protection, set `search_path` on trigger functions, confirm/rate-limit `demo_requests` |
| *(separate initiative, not a small branch)* Trigger.dev scheduling adoption per `docs/ADR_AUTONOMOUS_SCHEDULER.md` | Closes Blocking #2 and High #7 for real; provision a Trigger.dev project, wire Opportunity Detection + Decision Engine as scheduled tasks |

## 15. Remaining Manual Tests

- **Live GBP connect + publish**, once you designate a disposable test listing — deferred by your choice for this audit.
- **Trigger.dev tasks executed via their actual runtime** (local dev CLI or Cloud), once a project is provisioned — deferred by your choice for this audit.
- **True second-tenant, real-account UI walkthrough** (a second real signup going through the full onboarding wizard) — this audit used throwaway accounts only for RLS boundary testing, not a full onboarding walkthrough as a second persona.
- **Cleanup note**: this audit's own live testing left real rows in the primary account: 2 `marketing_opportunities`, 2 `marketing_recommendations`, 1 `content_approvals` (approved), 1 `publishing_queue` item, 1 `publishing_jobs` row (status `retrying`, safely stuck since no GBP is connected), 1 `analytics_snapshots` row. All represent exactly the product's real intended behavior (not synthetic noise) and were left in place rather than deleted, per "no destructive production-data cleanup without approval." Delete or dismiss them via the UI/Supabase dashboard at your discretion.

## 16. Production Deployment Checklist

- [ ] Service-role key rotated and confirmed (Blocking #1)
- [ ] Explicit decision made on Opportunity Detection/Decision Engine triggering for launch (Blocking #2)
- [ ] `GET /api/publishing` live side effect fixed or explicitly accepted as a known risk before any customer connects GBP (High #3)
- [ ] Leaked-password protection enabled in Supabase Auth settings
- [ ] `demo_requests` open-insert policy confirmed intentional (or rate-limited)
- [ ] `TRIGGER_PROJECT_REF`/`TRIGGER_SECRET_KEY` provisioned if any Trigger.dev task is meant to run in production
- [ ] `ADMIN_USER_IDS` reviewed for correctness (gates the one manual analytics-capture trigger route)
- [ ] Confirm Vercel/production env vars mirror `.env.local`'s full set (already enumerated in `.env.example`)

## 17. Pilot-Customer Readiness Checklist

- [ ] Decide and communicate whether the pilot's "recommendations" are AJN-ops-triggered or fully automatic (Blocking #2) — do not let a pilot customer believe this is automatic if it isn't yet
- [ ] Fix Approval Center's "automatically published" copy before any pilot customer sees that page (High #4)
- [ ] Either implement or remove the GBP Disconnect button before a pilot customer connects a real account they may want to later disconnect (High #5)
- [ ] Remove or clearly label onboarding's stale "GBP coming soon" copy so new pilot customers aren't misinformed during setup (Medium #8)
- [ ] Decide whether the Brand Voice page's mostly-mockup state is acceptable to show a pilot customer as-is, or should be gated/hidden until wired (Medium #10)
- [ ] If a pilot customer will connect a real GBP account, fix the `GET /api/publishing` side effect first (High #3) — this is the one finding with genuine, real-world safety implications once live posting is possible

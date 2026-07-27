# Business Discovery — First Impression (Customer-Facing UI)

**Status:** Full customer-facing UI, wired end-to-end — no new backend contract
**Branch:** `project-magic/2-0-wave1-first-impression`
**Depends on:** PR #73 (AI Business Discovery orchestration), PR #74 (Public Snapshot foundation), PR #75 (Snapshot Continuation) — see [`BUSINESS_DISCOVERY_ENGINE.md`](./BUSINESS_DISCOVERY_ENGINE.md), [`BUSINESS_DISCOVERY_PUBLIC_SNAPSHOT.md`](./BUSINESS_DISCOVERY_PUBLIC_SNAPSHOT.md), [`BUSINESS_DISCOVERY_CONTINUATION.md`](./BUSINESS_DISCOVERY_CONTINUATION.md)
**Cron gate:** `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains **false** — untouched

---

## What this is

This is the first thing a visitor ever sees of Project Magic 2.0: **First Impression**, the public-facing experience built on top of PR #74's anonymous Snapshot and PR #75's continuation contract. A visitor lands on `/snapshot` (or types a URL into the homepage's compact form and is carried there), watches an honest, staged scan of their own public presence, and receives a conversational explanation of what we learned — not a dashboard, not an audit, not a form.

The emotional target, per the Project Magic 2.0 blueprint: **"This already understands my business."** Every design decision below traces back to protecting that feeling.

---

## Screens and routes

| Route | Purpose |
|---|---|
| `/snapshot` | The full First Impression experience — entry form, scan progress, results, review, signup/sign-in handoff |
| `/` (homepage) | `HomeScanCta` — a compact "type your website, see what we find" entry point that hands off to `/snapshot?url=...` |
| `/signup?snapshotRef=...` | Existing signup form, now snapshot-reference-aware |
| `/onboarding?snapshotRef=...` | Existing onboarding wizard, now opens on a new `snapshotReview` step when a snapshot reference resolves |

No new pages were added beyond `/snapshot` itself — everything else is an additive extension of existing routes.

---

## Customer journey

1. **Entry.** Visitor sees "Scan My Business" with a single required field (website) and progressively-disclosed optional fields (business name, city, state/region). Copy is explicit that this only looks at public information and needs no account.
2. **Scan.** Honest, staged progress (`ScanProgress`) — real stage labels, no fake percentage bar, no claim of private-source access. Cancellable. A duplicate submission mid-scan is prevented by disabling the form during `scanning`.
3. **Results.** `SnapshotResults` opens with an executive summary ("Here's what I learned about your business"), three top discoveries, up to three growth opportunities, then asks a single question — "Did I understand your business correctly?" — before ever showing a checklist. Only after that does a guided review of the lower-confidence items appear, followed by a collapsed "Review everything I learned" section for anyone who wants full detail.
4. **Review.** Each insight can be confirmed ("That's right"), corrected ("Let me correct it" → inline dialog), rejected ("That's not right"), or deferred ("Review later"). Nothing is auto-confirmed by viewing or scrolling past it.
5. **Convert.** A calm, dark footer CTA offers "Create My Growth Plan" (signup) or "I already have an account" (sign-in) — both carry the opaque `snapshotReference` forward safely.
6. **Continue.** An authenticated user lands in onboarding on a new first step, `SnapshotReviewStep`, which says plainly: *"I already learned this. Let's make sure I got it right."* Saving submits through the same PR #75 confirm contract; skipping moves on without penalty.

---

## Design decisions

- **Conversation before dashboard.** `SnapshotResults` is built as a linear narrative (summary → discoveries → opportunities → one question → guided review → everything-else), not a grid of cards competing for attention. This directly follows [`PRODUCT_PRINCIPLES.md`](./project-magic/PRODUCT_PRINCIPLES.md)'s "Conversation before dashboards" and "One primary decision at a time."
- **Progressive disclosure everywhere.** The entry form starts with one field. The results page starts with three discoveries, not eight. The full insight list is collapsed by default. Nothing forces a visitor to process everything at once.
- **No forced triage.** "Did I understand your business correctly?" is a disclosure toggle, not a gate — choosing either answer only controls what's shown next; it is never treated as a confirmation of any individual insight (see Confirmation behavior below).

---

## Public Snapshot integration

Consumes PR #74's `PublicBusinessDiscoveryResultV1` and PR #75's `InsightKeys`/`InsightDecisionTypes`/`ConfirmationDecisionInput` verbatim — no redefinition. Two genuine, additive gaps were found and closed in the contract itself (never worked around in UI code):

- `PublicBusinessDiscoveryResultV1` didn't echo back the visitor's own submitted `websiteUrl`/`businessName`/`city`/`stateOrRegion` — needed to prefill the form on a "scan a different business" restart and to avoid ever re-deriving that data client-side. Added as plain, non-optional fields, populated in `mapPublicResult.ts`.
- Nothing in the contract distinguished a full result from a degraded/partial one (Part 14's "provider timeout, partial result" requirement needs an honest signal to render "We learned part of your business" rather than silently presenting an incomplete result as complete). Added `degraded: boolean`, threaded through from the existing `extractionDegraded || aiProfileDegraded` internal signal.

`lib/snapshot-ui/insightCatalog.ts` maps all 8 confirmable `InsightKeys` to plain-language labels ("What you do," "Your primary services," "Who you help," "How your business comes across," "What stands out," "Your website," "Your Google Business Profile," "Where growth may be hiding") and builds the top-3/guided-review/remaining groupings the results screen renders from.

---

## Confidence-language treatment

Raw `confidenceTier` values (`known`/`assumed`/`missing`) and raw `confidenceScore` numbers are never rendered anywhere in this UI. `lib/snapshot-ui/confidenceLanguage.ts` translates:

| Tier | Displayed as |
|---|---|
| `known` | "Clearly stated" |
| `assumed` | "My best understanding" |
| `missing` | "I couldn't determine this yet" |

Confidence is never conveyed by color alone (Part 13) — every badge carries the text above.

`sourcePhrase()` turns `DiscoverySourceType[]` into a friendly, properly-joined phrase (e.g., "your website and your Google Business Profile") rather than ever showing an internal source enum value.

---

## Explainability treatment

Every insight's real `reason` field (already written in plain language by PR #73/#74's own generation step) is surfaced behind a "Why I think this" disclosure toggle on each `InsightReviewItem` — never chain-of-thought, raw prompts, internal IDs, or security/validation decisions. Opening it fires the `explanation_opened` analytics event (insight key only).

---

## Confirmation behavior (Part 5 / Part 6 discipline)

- Decisions are one of exactly the four PR #75 verbs: Confirm, Correct, Reject, Review Later — surfaced as "That's right" / "Let me correct it" / "That's not right" / "Review later."
- **Viewing, scrolling past, or answering "Did I understand your business correctly?" never counts as a decision on any individual insight.** The only code path that records a decision is `handleDecide` in `snapshot-flow.tsx`, called exclusively from an explicit button press on a specific insight.
- Corrections go through `InsightCorrectionDialog` — an accessible modal (focus trap, Escape-to-close, focus return to the trigger element on close) — never an inline click-to-edit that could be triggered accidentally.
- Anonymous (pre-auth) decisions are held in `sessionStorage` (`lib/snapshot-ui/decisionStorage.ts`), keyed by `snapshotReference`, and are **replayed** — never silently auto-applied — once a visitor authenticates and reaches `SnapshotReviewStep`. The only server call that can turn a decision into a durable/semi-durable fact is the authenticated `POST /api/business-discovery/continuation/confirm` call, fired by an explicit "Save my answers & continue" click.

A source-level test (`tests/first-impression.spec.ts` — "no forbidden decision auto-application") asserts this directly against the source, not just observed UI behavior.

---

## Signup / sign-in continuation

- "Create My Growth Plan" → `router.push('/signup?snapshotRef=' + encodeURIComponent(reference))`. `signup-form.tsx` reads `snapshotRef` via `useSearchParams()` and threads it into both `emailRedirectTo` and the post-signup `router.push`, so the reference survives email confirmation and direct sign-in alike.
- "I already have an account" → `router.push('/login?next=' + encodeURIComponent('/onboarding?snapshotRef=' + reference))`, reusing the existing `next` param convention and `safeInternalNextPath` (`lib/auth/safeNextPath.ts`) — confirmed to already support a `next` value containing its own nested query string, so **no changes were needed** to that function or `app/auth/callback/route.ts` to keep the redirect safe (no open-redirect risk introduced).
- The reference itself is opaque (PR #74's random hex token) — never raw snapshot content, never an internal cache key, in any URL or query param.

---

## Onboarding integration

`app/onboarding/page.tsx`'s `resolveSnapshotContinuation()` resolves and claims the reference **server-side**, before the wizard mounts, using the exact PR #75 service functions the API routes use. It returns a discriminated outcome:

- **Resolved** → the wizard opens on a new `snapshotReview` first step (`SnapshotReviewStep`), which renders the full snapshot for review and reachable "Save my answers & continue" / "Skip for now" actions, then proceeds into the normal wizard flow.
- **Unavailable, silently** (invalid/absent reference) → standard onboarding, byte-for-byte unchanged — nothing revealed about a garbage link.
- **Unavailable, with notice** (reference genuinely expired) → a friendly `role="status"` banner: *"Your Snapshot expired while you were signing in. You can continue setup below, or run a fresh scan anytime."* Distinguishing expired-and-honest from invalid-and-silent was a deliberate Part 14 requirement, not an oversight.

The wizard's existing prefill discipline (`mergeOnboardingPrefill` — only fills fields still blank, never overwrites a saved profile) is unchanged and reused, not duplicated.

---

## Mobile behavior

- No horizontal overflow at 375px width (verified by Playwright scenario 12 — `scrollWidth <= clientWidth`).
- All interactive touch targets (buttons, disclosure toggles) are at least 44px tall (`min-h-11` utility class throughout).
- `InsightCorrectionDialog` renders as a bottom sheet on small viewports (`items-end` → `sm:items-center`), capped at `max-h-[90vh]` with internal scroll, so it never exceeds the viewport.
- The dialog's action row respects `env(safe-area-inset-bottom)` via `pb-[max(1.5rem,env(safe-area-inset-bottom))]`.
- The conversion footer is a normal in-flow section, not a `position: sticky` bar — it never obscures content while scrolling.

---

## Accessibility

- Every form field has a real, associated `<label>` (`Your business website`, `Business name`, `City`, `State or region`).
- `ScanProgress` uses `role="status"` + `aria-live="polite"` so stage changes are announced without interrupting.
- Error banners use `role="alert"`.
- `InsightCorrectionDialog` implements a full accessible dialog pattern: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, a Tab-key focus trap, Escape-to-close, and focus return to the triggering element on close.
- Confidence is never color-only — every badge includes its translated text (see Confidence-language treatment).
- All interactive elements are reachable and operable via keyboard alone (verified by Playwright scenario 13).
- `ScanProgress`'s stage-cycling animation respects `motion-reduce:` Tailwind variants for reduced-motion users.
- Headings are semantic and in document order (`h1` page title → `h2` section headings → `h3` insight/discovery titles).

---

## Analytics

`lib/snapshot-ui/experienceAnalytics.ts` (server) and `lib/snapshot-ui/analytics.ts` (client, fire-and-forget via `POST /api/business-discovery/snapshot-events`, `keepalive: true`) track the funnel:

`scan_form_viewed` · `scan_submitted` · `scan_started` · `scan_completed` · `validation_failed` · `insight_confirmed` · `insight_corrected` · `insight_rejected` · `insight_deferred` · `explanation_opened` · `signup_selected` · `signin_selected` · (plus onboarding-side continuation events)

**Redaction, enforced in two places:** the client only ever sends `{ event, metadata }` where `metadata` is restricted by type to `{ section?, insightKey?, errorCode? }`; the route handler (`app/api/business-discovery/snapshot-events/route.ts`) independently re-validates the event against an allowlist and strips any metadata key outside `{section, insightKey, errorCode}` (each capped at 80 characters) before logging. **Never logged, by construction:** full website content, correction text/notes, snapshot result bodies, raw snapshot references, or any auth/personal data. The route is rate-limited (120 requests/hour) via the existing `checkRateLimit` helper.

---

## Error and partial-result states

| Condition | Behavior |
|---|---|
| Invalid/unsupported/blocked URL | Friendly banner: "We couldn't safely visit that address. Check the website and try again." — never a raw validator error |
| Rate limited | "You've reached the limit for free snapshots right now. Try again in about N minutes." (derived from `Retry-After`) |
| Provider timeout | "That website took too long to respond. You can try again, or continue with what we find next time." — form values are preserved, not cleared |
| Upstream/internal error | Generic, calm retry message — no stack traces, codes, or internal terms |
| Partial/degraded discovery | Results still render fully and usably; an honest "We learned part of your business" notice appears rather than presenting an incomplete picture as complete |
| Scan/continuation reference expired | Handled per-context — see Onboarding integration above for the authenticated case |
| No-JS | The scan form is a real `<form>` with a real submit button; server-side validation still exists behind it (PR #74's `urlSafety.ts`) even though the client-side check is convenience-only |

---

## Ephemeral confirmation limitation (honest, unchanged from PR #75)

Of the 8 confirmable insight keys, only `primaryServices` has a durable home (`business_profiles.primary_services`). The other 7 (business summary, target customers, brand personality, visible strengths, website/Google Business Profile presence, growth opportunities) are recorded in `confirmationStore.ts`, an in-memory store with a **24-hour TTL** — this UI does not change that. This was a deliberate PR #75 scope boundary (no new Business Brain schema), and this phase reuses it rather than working around it. A visitor's confirm/correct/reject decisions on those 7 fields are real, reviewable within that window, but not yet permanently durable across sessions beyond it.

---

## Tests performed

**Unit (`unit-tests/`):**
- `snapshot-ui-confidence-language.test.ts` (6 tests) — tier→text mapping, source-phrase joining (1/2/3+ items, serial comma)
- `snapshot-ui-insight-catalog.test.ts` (8 tests) — all 8 insight keys map correctly; top-3/guided-review/remaining groupings
- `snapshot-ui-decision-storage.test.ts` (5 tests) — save/load/clear round-trip, `window === undefined` guard
- `business-discovery-public-map-result.test.ts` — updated for the new `visitorInput`/`degraded` fields, plus 2 new tests asserting the degraded flag is threaded through honestly and defaults safely

**Playwright (`tests/first-impression.spec.ts`, 22 tests, chromium):** all 14 numbered scenarios from the spec (valid submission → Snapshot; reviewing an Assumed insight; correcting; rejecting; Review Later; signup handoff preserving the reference; sign-in handoff; expired-reference graceful fallback; rate-limited friendly state; blocked-URL friendly state; timeout friendly state + form preservation; partial/degraded result usability; mobile viewport with no horizontal overflow; keyboard-only review completion; analytics payload redaction) plus source-level assertions (no forbidden auto-confirmation; onboarding review step only ever calls the authenticated confirm contract; cron gate untouched) and dialog-specific focus/Escape behavior. All external AI calls and website fetches are mocked via `page.route()` — no live websites or paid APIs are ever reached.

**Full suite:** `npm run test:unit` — 1286/1287 passing. The one failure (`publishing-provider-client.test.ts`, missing `TOKEN_ENCRYPTION_KEY` env var) is a pre-existing environment-configuration issue in a file untouched by this work.

**Lint:** clean of new issues (`npm run lint`); remaining warnings/errors are pre-existing, in files this work never touched.

**Type check / build:** `npm run build` (Next.js's own project-wide TypeScript check) completes successfully; `/snapshot` is statically generated.

---

## Known limitations

- No established pattern anywhere in this repo's Playwright suite for signing in a real authenticated test user (every existing spec tests unauthenticated behavior only). The two scenarios that genuinely require an authenticated session — resuming a Snapshot inside onboarding, and confirming existing profile data is never overwritten — are covered instead by PR #75's server-side unit tests (`unit-tests/business-discovery-continuation-*.test.ts`) plus this phase's onboarding-prefill assertions, not by a new Playwright login flow.
- 7 of 8 confirmable insight fields remain 24h-TTL, not permanently durable (see Ephemeral confirmation limitation above) — unchanged from PR #75, not a new gap introduced here.
- In dev mode, a route's client bundle compiles on first navigation (Next.js on-demand compilation) — the two signup/sign-in Playwright assertions use a generous 20s timeout to absorb that one-time cost; this is a dev-server characteristic, not production behavior or flakiness.
- No final Business Pulse dashboard, Market Radar UI, Customer Voice UI, or connector marketplace — all explicitly out of scope per this task.

---

## Recommended next phase

Promote the 7 ephemeral confirmation keys to durable storage once cross-session persistence beyond 24h is actually needed (a minimal, purpose-built migration, not a large Business Brain schema) — the confirmation contract and store interface are already isolated enough (per PR #75's Part 8) that this is a backend-only change with no UI rework required.

---

## Product Decision Filter — verified

| Question | Answer |
|---|---|
| Makes the experience simpler? | Yes — a visitor sees one clear next step at a time (submit a URL, read a summary, answer one question, review a short list) instead of a form or a dashboard. |
| Helps the business grow? | Yes — this is the actual customer-facing surface that makes PR #74/#75's backend work visible and usable; without it, the Snapshot capability existed but no visitor could ever experience it. |
| Automates meaningful work? | Yes — the scan, the explanation, and the pre-fill into onboarding all happen without the visitor re-entering anything they already gave us. |
| Understandable to a non-technical owner? | Yes, by construction — every confidence tier, source, and decision verb is plain language; there is no raw tier name, percentage, or internal field name anywhere in the UI. |
| Fits the Growth Engine vision? | Yes — this is the "First Impression" milestone named in the Project Magic 2.0 blueprint, the entry point the rest of the Growth Engine journey builds on. |

**How duplicate questions are reduced:** the visitor's own submitted website/business name/city/state are echoed back through the public contract and reused verbatim on both a "scan a different business" restart and the onboarding prefill — never re-derived, never re-asked.

**How AI assumptions stay transparent:** every Assumed insight is labeled "My best understanding," carries its real `reason`, and can be reviewed individually — never blended into the summary as if it were a Known fact.

**How the illusion of simplicity is preserved:** DNS-safe fetching, tamper-resistant confirmation records, TTL bookkeeping, ownership claims, and rate limiting are all inherited unchanged from PR #74/#75 and stay entirely behind the scenes. What the visitor experiences is a short conversation about their own business, not a technical audit.

**What's deferred:** durable storage for 7 of 8 confirmation fields, a real authenticated Playwright login flow, and everything explicitly out of scope (Business Pulse, Market Radar, Customer Voice, connector marketplace, shared-store migration, production deployment/cron activation).

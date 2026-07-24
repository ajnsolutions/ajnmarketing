# RC-1: Authenticated Pilot Validation and User-Flow Hardening

**Project Magic RC-1.** A full-system validation-and-fix cycle across the authenticated customer journey — not a new feature phase. Builds on Phase 3A (Customer Experience Polish), Phase 3B (Guided Onboarding & Setup), and Phase 3C (Production Operations & Pilot Hardening).

## Objective

Validate the complete authenticated experience from first login through ongoing marketing operations, find real friction and defects (not hypothetical ones), fix release-blocking and high-value usability issues, and give an honest pilot-readiness recommendation.

## Method

No authenticated admin/customer session was available in this environment (consistent with every prior review in this engagement). Validation was performed by:

1. Reading the actual, current source of every major authenticated route and component — not relying on prior PR descriptions or documentation claims.
2. Tracing real data flow (props, client fetches, server actions) to distinguish genuinely dynamic, honest UI from hardcoded/fabricated content.
3. Cross-referencing setup-step definitions (`lib/customer-setup/steps.ts`) against their actual destination pages to find CTA/destination mismatches.
4. Reusing verified findings from the immediately preceding three review sessions in this engagement (PR #63, #64, #65 reviews), which already established that the onboarding, setup, Head of Marketing hierarchy, Google Business connection-state model, and admin ops boundary are sound — re-verified by spot-check rather than re-read from scratch where nothing in this diff touches them.

## Tested personas

Given no live session, personas were validated at the **code level**: what each route/component does for a given data shape (new/partial/mature/degraded account), not by clicking through a real UI. This is stated explicitly rather than implied as a live test.

## Customer-journey findings

### New-customer journey
Traced signup → `/onboarding` (unchanged, Phase B) → `app/dashboard/layout.tsx`'s completion gate → `/dashboard` → setup readiness gate (`SetupHomReadinessPanel`, Phase 3B, verified sound in the PR #64 review) → `/dashboard/setup` checklist. All 13 setup steps' destinations were cross-checked against real routes (`lib/customer-setup/steps.ts` vs. `app/dashboard/**`); 12 of 13 matched their promised CTA. **Found:** the Notifications step promised "Review notifications" / "How you prefer to hear about approvals" but its destination (`/dashboard/notifications`) is an explicit "coming soon" placeholder with nothing to review — a real dead-end for an actionable setup CTA (P1, fixed below).

### Partial-customer journey
Setup resumption logic (`computeCustomerSetupSnapshot`, unchanged by this PR) was already verified deterministic and non-regressive in the Phase 3B/3C reviews — a partial account's completed steps stay completed, skipped optional steps stay skipped, and the next-step pointer is stable. No changes were needed here.

### Mature-customer journey
`app/dashboard/page.tsx`'s routing order (briefing check before the setup-readiness gate, verified in the PR #64/#65 reviews) means a mature account with a full Head of Marketing briefing never sees the setup panel. Unchanged by this PR.

### Marketing-foundation journey (the most significant finding)
Reading `components/dashboard/ai-marketing-profile-page.tsx` and `components/dashboard/marketing-plan-page.tsx` in full confirmed both are honest: every value rendered comes from the real `profile`/`plan` prop, with an explicit anti-fabrication comment in the AI Profile page ("nothing here is placeholder or fake content") and correct empty/generating/failed states backed by real refresh actions.

**`components/dashboard/brand-voice-page.tsx` was a different story.** This page is reached from the setup checklist's "Set brand voice" step and is a required part of the marketing-foundation flow. It contained:

- A "Voice Match Score" badge hardcoded to **"Strong Match"** regardless of the real `analysis_score` — including when there was no score at all (`null`).
- A "Sources analyzed: Website, Google Profile, Reviews" claim shown unconditionally, even for accounts with no website analysis and no data confirming Google Profile or Reviews were ever used by this page.
- A fully fabricated **"AI Learning Timeline"** section with specific fake timestamps ("Jun 18, 2:00 PM", "Jun 18, 2:15 PM", …) presented as "How your voice profile was built" — implying real historical events that never happened for any customer.
- Two header buttons, **"Refresh Voice Profile"** and **"Save Voice Settings"**, with no `onClick` handler at all — completely non-functional.
- Two buttons per sample card, **"Approve Style"** and **"Edit Tone"**, also with no `onClick` handler.
- A "Tone Adjustment" section whose selections (`selectedTones`) were held in local component state only and never persisted anywhere, despite the copy claiming "AJN will apply these to future content drafts."
- Four hardcoded "Sample AI Content" cards with fabricated, static "match" percentages (96%, 94%, 92%, 93%) implying real per-sample computation.

This is a textbook "no false success" / "does not fabricate analysis" violation (explicitly called out in both this PR's and the prior Phase 3C review's adversarial checklists) and a real trust risk for a pilot customer — anyone who noticed the fixed date, the always-"Strong Match" badge on a fresh account, or clicked a dead button would reasonably question what else on the page is real. Classified **P1** (a working page that actively misrepresents system state is a pilot blocker, not a cosmetic issue) and fixed — see below.

### Recommendation-to-action, approval, and publishing journeys
`marketing-recommendations-page.tsx`, `publishing-page.tsx`, and the publishing queue/jobs panels were read and found sound: real filter state, real empty states with a clear next action, and a genuine "Approved"/"Published" text distinction (though their badge *coloring* is currently identical — see P2 notes). The publishing queue's customer "Mark Published" action was investigated as a possible false-success risk; it is a legitimate manual-bookkeeping action for content published through channels the automated system doesn't control, not a bug — no automated provider call is implied or triggered by it. The Approval Center's "SMS Approval Preview" card is an explicitly-labeled illustrative mockup of a not-yet-built feature (uses a fixed example count in a scripted example conversation, not live data) — noted as a P3 observation, not fixed, since it doesn't claim to be real.

## Information architecture

No navigation restructuring was needed or performed — the Phase 3A/3B primary-nav hierarchy (Head of Marketing as the calm default, Command Center demoted to an explicit "advanced/detailed workspace" with its own disclaimer, setup checklist reachable from Settings and the dashboard card) remains coherent and was not touched.

One dead route was found and documented, not fixed: `app/dashboard/[section]/page.tsx` is a legacy catch-all mapping section names (`gbp`, `content`, `reviews`, `market-context`, `analytics`, `billing`, `settings`) to a "Coming soon" placeholder. Every one of those names except `gbp` is now shadowed by a real dedicated page (Next.js resolves static routes before the dynamic catch-all), and nothing anywhere in the app links to `/dashboard/gbp`. This route is confirmed unreachable today (grep-verified against every `href` in `components/` and `app/`) — zero current customer impact, so left as documented P3 cleanup rather than spending fix budget on dead code with no live path.

## P0 findings

None found. No broken authentication, no data loss, no cross-tenant leak, no unauthorized access, no broken approval boundary, no duplicate-publishing risk, no infinite redirect, and no unexpectedly-active schedule were found in this pass. `ATTACH_DECLARATIVE_PRODUCTION_CRONS` confirmed `false`.

## P1 findings and fixes

1. **Brand Voice page fabrication and dead buttons** (see above). Fixed:
   - `matchScoreLabel()` (new, pure, tested — `lib/brand-voice/matchScoreLabel.ts`) replaces the hardcoded badge with an honest tiered label: `null` → "Not yet analyzed", `<40` → "Early signal", `40–69` → "Good match", `≥70` → "Strong match".
   - "Sources analyzed" now only claims "Website" when a real website analysis exists; otherwise it honestly says "None yet."
   - The fabricated "AI Learning Timeline" section was removed entirely, along with its backing hardcoded data.
   - The two dead header buttons and the two dead per-sample buttons were removed (no backing capability exists to wire them to without expanding RC-1 scope into new feature work).
   - "Sample AI Content" was relabeled "Example Drafts" with a subtitle clarifying these are illustrative, not this business's actual generated content; the fabricated per-sample match percentages were replaced with a neutral "Example" tag.
   - Tone selection (`selectedTones`) is now actually persisted to `business_profiles.brand_voice_tone` on save (reusing the existing `upsertBusinessProfile` path — no new capability, no schema change) and restored on page load, so the "Tone Adjustment" section's promise is now true.
   - Added `role="status"` to the save-confirmation message (was previously not announced to screen readers).

2. **Notifications setup-step CTA/destination mismatch**. Fixed: `lib/customer-setup/steps.ts`'s `NOTIFICATIONS` step description and `primaryActionLabel` no longer promise a configurable preferences screen ("Review notifications" / "How you prefer to hear about approvals and important updates"). The new copy ("See how updates work" / "How I'll keep you updated on approvals and important changes for now") accurately reflects the honest "coming soon, nothing to configure yet, Weekly Briefing is where I'll ask for your opinion" copy already present on the destination page (`components/dashboard/dashboard-feature-placeholder.tsx`, unchanged).

## Focused review pass (pre-merge re-review of this PR)

A second, deeper pass over `components/dashboard/brand-voice-page.tsx` — specifically targeting customer trust, source attribution, tone persistence, buttons, and accessibility — found four more real defects the first pass missed, none of them cosmetic:

1. **`brand_voice_tone` unconditional overwrite risk.** The original fix always wrote `brand_voice_tone` on every save, including a save triggered only to update the notes field. `business_profiles.brand_voice_tone` is read by content-generation prompts, AI Marketing Profile generation, Google review-reply generation, the website-analysis customer-persona extractor, and the setup-readiness calculator, and is independently editable as freeform text via the existing Settings page — a notes-only save could have silently clobbered a richer, real tone description with the default checkbox state. **Fixed:** added a `tonesDirty` flag, set only inside `toggleTone()`, and gated the `brand_voice_tone` key in the save payload behind it.
2. **`hasWebsiteAnalysis` too loose.** It was computed as `Boolean(analysis)`, but a `website_analyses` row can exist in `pending`/`running`/`failed` states with `analysis_score` still `null` — "Sources analyzed: Website" could display at the same time as the score badge honestly said "Not yet analyzed." **Fixed:** tightened to `analysis?.analysis_status === "completed"`.
3. **Blank example quote on a failed analysis.** `exampleParagraph` fell back through a `??` chain ending at `analysis?.raw_summary?.brandVoice`. `markWebsiteAnalysisFailed` (`lib/website-analysis/persistence.ts`) always writes `raw_summary.brandVoice` as `""` (never `null`) on a real failure, since the only real call site (`lib/website-analysis/service.ts`) always passes a non-empty `safeError` string — so a customer whose first website analysis fails would see an empty `""` quote in the "Example from your business profile" block instead of the honest default paragraph. **Fixed:** switched to `displayValue()`, which already treats an empty string the same as absent everywhere else on this page.
4. **Dead `SectionCard` `action` prop.** The shared local `SectionCard` component still accepted an `action?: string` prop and rendered a button with no `onClick` at all — the same dead-button pattern already fixed twice elsewhere in this file. Confirmed unreachable today (none of the file's 7 `<SectionCard>` call sites pass `action`), but a latent trap for future edits. **Fixed:** removed the prop and its rendering.
5. **Missing `aria-pressed` on tone chips.** The Tone Adjustment toggle buttons conveyed selected/unselected state only through color, with no `aria-pressed`, unlike every other toggle-button group in this codebase (`marketing-recommendations-page.tsx`, `setup-goals-form.tsx`, `strategic-marketing-calendar-page.tsx`). **Fixed:** added `aria-pressed={selectedTones.includes(option)}`.

All five re-verified via `npm run build`, the full unit suite, lint, and an expanded Playwright spec (see Tests below). No other focus area (setup-checklist copy, cron gate, regression scope) required changes in this pass — re-confirmed unchanged.

## P2 improvements completed

- Added `role="status"` to the Brand Voice save-confirmation message (accessibility).
- Relabeled the Sample AI Content badges from fabricated percentages to a neutral "Example" tag (also serves the P1 fix).

## P2 improvements identified but not fixed (documented as deferred)

- "Approved" and "Published" status badges on the Approval Center use identical visual styling (`bg-growth-50 text-growth-500 ring-emerald-100`) even though their text labels are correctly distinct. The text label already satisfies "status not conveyed by color alone," but a visually distinct treatment would make the approved/published distinction clearer at a glance. Deferred as a low-risk visual-only follow-up, not a pilot blocker.
- Marketing Plan's "generating" state tells the customer to "Refresh this page in a moment if it does not update automatically" — an honest but imperfect UX (ideally the page would poll/revalidate on its own). Deferred; the messaging is honest about the limitation, not misleading.

## P3 deferred improvements

- The unreachable `/dashboard/[section]` legacy placeholder route (see Information architecture above) — safe to delete in a future pass since nothing links to it, but zero current customer impact means it isn't worth the risk of a broader route-cleanup pass in RC-1.
- The Approval Center's "SMS Approval Preview" mockup of a not-yet-built feature — already clearly labeled as a preview, not deceptive, but a candidate for removal or clearer "coming soon" framing in a future polish pass if SMS approval isn't on the near-term roadmap.
- A real notification-preferences feature (the underlying capability the Notifications setup step alludes to) — explicitly out of RC-1 scope ("must not introduce major new product capabilities"); RC-1 only fixed the step's language to stop overpromising it.

## Manual Trigger.dev validation

Not performed — no `TRIGGER_SECRET_KEY`/authenticated environment was available in this session. This is unchanged from every prior review in this engagement. The existing manual-trigger admin routes and assisted-pilot manual actions (Phase 3C, unmodified by this PR) remain the correct mechanism; RC-1 did not touch Trigger.dev tasks, the schedule gate, or any manual-execution path.

## Pilot-checklist validation

The assisted-pilot activation checklist and its scoring (`lib/assisted-pilot/readiness.ts`, unmodified by this PR) remain the sole authoritative pilot-launch score, confirmed unchanged. RC-1 did not add a second checklist, a second score, or any checklist action capable of activating a schedule.

## Accessibility

Reviewed and fixed within the changed files only (per RC-1 scope — full-app accessibility re-audit was already performed in the Phase 3A review): the Brand Voice save-confirmation message now uses `role="status"` for live-region announcement. No other accessibility regressions were introduced — the removed elements (dead buttons, fabricated timeline) had no accessibility features to preserve, and their removal is a net accessibility improvement (no unlabeled dead controls left in the tab order).

## Mobile

No layout changes were made beyond content removal (which only reduces page length, never introduces overflow) and a badge-tone class change (same badge dimensions). No new mobile risk introduced.

## Performance

No new client fetches, no new server queries, no new provider calls. The fixes in this PR are pure content/logic corrections to an already-client-rendered page — no measurable performance change.

## Security / tenant isolation

No security-relevant surface was touched. The Brand Voice tone-persistence fix reuses the existing, already-tenant-scoped `upsertBusinessProfile` client function (which forces `user_id` from the authenticated session, not from any input) — no new write path, no new trust boundary.

## Migration decision

**No migration.** Both fixes are either pure UI/logic corrections (Brand Voice fabrication removal) or reuse an existing column (`business_profiles.brand_voice_tone`, already read elsewhere on this same page before this fix — RC-1 only added a write path to a column that already existed and was already being displayed).

## Tests

- `unit-tests/brand-voice-match-score.test.ts` (4 tests) — locks in the honest, tiered `matchScoreLabel` behavior.
- `unit-tests/customer-setup-step-definitions.test.ts` (2 tests) — locks in the notifications-step copy fix and a general sanity check that every setup step has a real action label and app-relative destination.
- `tests/rc1-user-flow-hardening.spec.ts` (12 Playwright tests) — unauthenticated redirects for the two changed pages, source-level regression locks for every fabricated/dead element removed from Brand Voice, a cron-gate regression check, and five additional locks from the focused review pass (`tonesDirty` gating, `hasWebsiteAnalysis` status check, no dead `SectionCard` action prop, honest `exampleParagraph` fallback, `aria-pressed` on tone chips).

## Authenticated smoke result

**Not performed.** No authenticated session was available in this environment. Do not treat the live UI as verified beyond source-level and unauthenticated-access assertions. See the manual validation checklist below.

## Known limitations

- This review's journey mapping was performed by reading source code and cross-referencing real data flow, not by operating a live authenticated session — genuinely interactive bugs (a click handler that's wired but throws at runtime, a race condition only visible under real network timing) cannot be ruled out by this method alone.
- The full 54-scenario Playwright list in the RC-1 brief assumes authenticated fixtures this environment doesn't have; the added spec covers what's verifiable without one (unauthenticated access, source-level regression locks) rather than claiming broader coverage.
- Deeper pages not read in full during this pass (Reviews, Content Generator, full Settings sub-pages, Decision Intelligence, Strategic Calendar, Campaigns, Experiments, Marketing Memory) were already reviewed in depth during the Phase 3A/3B/3C review sessions in this engagement and are believed sound based on that accumulated evidence, but were not re-read line-by-line in this specific session.

## Pilot recommendation

Proceed toward a controlled assisted pilot after the P1 fixes in this PR, with the manual smoke checklist below run by an operator with real credentials first — particularly exercising the Brand Voice page (to confirm the honest match-score/source-list behavior and working tone-save action look right for a real account) and the setup checklist's Notifications step (to confirm the new copy reads naturally in context).

## Schedule-activation recommendation

No change from the Phase 3C recommendation: schedule activation remains a separate, later, explicitly-approved decision. `ATTACH_DECLARATIVE_PRODUCTION_CRONS` must stay `false` through this PR and through pilot validation.

## Manual validation checklist

1. Sign in as a test account with no website, no Google Business connection, and no prior Brand Voice data. Open `/dashboard/setup` → confirm the Notifications step's "See how updates work" CTA reads naturally and its destination page doesn't feel like a broken link.
2. Open `/dashboard/brand-voice` for that same account. Confirm the Voice Match Score shows "—" and "Not yet analyzed" (not "Strong Match"), and "Sources analyzed" shows "None yet — add a website or share notes below."
3. Select one or more Tone Adjustment chips, type a note, click "Save Voice Preferences." Confirm the success message appears, then reload the page and confirm the same tone chips are still selected (persistence round-trip).
4. Repeat step 2 for an account with a completed, successful website analysis. Confirm the score badge reflects the real tiered label matching the actual `analysis_score` value, and "Sources analyzed" shows "Website."
5. Confirm no button on `/dashboard/brand-voice` is present without a working action (no more "Refresh Voice Profile," "Save Voice Settings," "Approve Style," or "Edit Tone").
6. Confirm the "AI Learning Timeline" section no longer appears anywhere on the page.
7. Resize to 375px and 320px — confirm the Brand Voice page still reads cleanly with the removed sections (no leftover empty gaps or broken layout).
8. Confirm `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains `false` in the deployed environment.

# Recommendation Explainability and Client Decision Experience

- **Status:** Implemented
- **Date:** 2026-07-14
- **Scope:** Presents PR #28's adaptive scoring intelligence to clients in plain
  business-owner language within the existing Approval Center, and adds a durable
  positive-feedback signal ("do more like this"). No machine learning, no autonomous
  approval/publishing, no email/SMS delivery (a future milestone). No production
  schedules were activated by this work.

---

## 1. Investigation findings

- **Two existing recommendation-facing surfaces**, not one: `app/dashboard/
  marketing-recommendations` (a recommendation *list*, via
  `MarketingRecommendationCard`) and `app/dashboard/approvals` (the Approval Center,
  via `ApprovalQueue`/`ApprovalCard`). The task's Phase 6 explicitly targets extending
  the Approval Center — this milestone does **not** touch the marketing-recommendations
  list page.
- **The existing recommendation card already displays raw internal numbers** —
  `Score {priority_score}` and `{confidence}% confidence` badges, directly, on
  `MarketingRecommendationCard`. This is a pre-existing pattern, left untouched (out of
  scope: Phase 6 only asks to extend the Approval Center). It's flagged here as a known
  inconsistency, not fixed in this PR — see §13.
- **`getApprovalDashboardData()`** (`lib/content-approval-server.ts`) previously
  returned only raw `ContentApproval[]` rows with zero recommendation enrichment — this
  is the actual gap this milestone closes.
- **content_approvals -> recommendation link**: `content_approvals
  .marketing_recommendation_id` (migration 019), already the single source of truth PR
  #26/#27/#28 all build on. Reused directly, never re-derived.
- **Structured rejection reasons already exist and are already wired into the UI** as
  of PR #27 (`REJECTION_REASON_OPTIONS` in `approval-queue.tsx`, backed by
  `RejectionReasonCodes` in `lib/recommendation-outcomes/types.ts`). This milestone
  reuses that vocabulary verbatim — no second vocabulary was introduced.
- **No "do more like this" or positive-feedback mechanism existed anywhere** (confirmed
  by a repo-wide search) — a new event type was required (§7).
- **`recommendation.reasoning`** (built by `buildReasoning()` in
  `lib/marketing-decisions/decisionEngine.ts`) is already a client-safe, deterministic,
  human-readable string (e.g. "Independence Day weekend"). Reused directly as the
  package's `whyNow` field rather than reinventing a similar sentence.

### Current flow (as implemented before this PR)

```
recommendation (marketing_recommendations)
   -> adaptive score (lib/recommendation-learning, PR #28, stored on the recommendation row)
   -> generated draft (content_approvals, linked via marketing_recommendation_id)
   -> Approval Center (raw ContentApproval[], no recommendation context)
   -> edit/approve/reject (lib/content-approval/service.ts, PR #27 outcome-event wiring)
   -> outcome event (recommendation_outcome_events)
```

The only actual gap: between "generated draft" and "Approval Center," nothing surfaced
*why* the draft existed, what it was expected to accomplish, or how confident the
platform was — despite all of that data already existing.

## 2. Architecture

A new, server-only presentation layer, `lib/recommendation-presentation/`, sits
strictly between the existing data layers and the UI — it never duplicates PR #27/#28's
logic, only translates it:

```
lib/recommendation-outcomes    (PR #27: outcome summary)  \
lib/recommendation-learning    (PR #28: adaptive breakdown) -> lib/recommendation-presentation/service.ts
lib/marketing-decisions        (recommendation + reasoning)  /        |
                                                                       v
                                                     ClientRecommendationDecisionPackage
                                                                       |
                                                                       v
                                              components/dashboard/approval-queue.tsx
                                                     (RecommendationPackagePanel)
```

`getRecommendationDecisionPackagesForApprovals` is called once from
`getApprovalDashboardData()` (`lib/content-approval-server.ts`) and threaded through
`app/dashboard/approvals/page.tsx` -> `ApprovalsPage` -> `ApprovalQueue` -> `ApprovalCard`
as a plain `Record<contentApprovalId, ClientRecommendationDecisionPackage>` (not a `Map`
— this crosses the server/client component boundary as a prop, and a plain object is
this codebase's existing convention for that). Approvals with no
`marketing_recommendation_id` (hand-authored content) simply have no entry in that
record and render exactly as they did before this PR.

### A refactor along the way

`lib/recommendation-learning/debug.ts`'s per-recommendation score-recompute logic was
extracted into a new shared pure function,
`computeRecommendationScoreBreakdown` (`lib/recommendation-learning/adaptiveScoring.ts`),
so both the admin debug view (PR #28) and this milestone's client presentation service
call the **same** recompute logic rather than duplicating it. This is a pure
refactor — the admin debug view's existing tests still pass unmodified.

## 3. Internal vs. client explanation separation

`lib/recommendation-presentation/types.ts` defines a model that is, by construction,
never unsafe to send to a signed-in tenant's own browser:

| Never included | Where the internal version actually lives |
|---|---|
| Base score, historical adjustment, final score (raw numbers) | `AdaptiveScoreBreakdown` (PR #28), admin-only |
| Raw confidence percentages | Same — replaced with `confidenceLabel` + `confidenceLabelText` |
| Reason weights / internal reason descriptions with embedded percentages | Replaced with fixed, generic plain-language templates (§4) |
| Raw provider/OAuth error text | Replaced with `outcomeStatus.detail`'s fixed operational-issue sentence (§9) |
| Service-role/provider credentials | Never touched by this module at all |

A dedicated test (`recommendation-presentation-service.test.ts`) asserts the serialized
package never contains the strings `baseScore`, `historicalAdjustment`, `finalScore`,
`reasonWeight`, `historicalConfidence`, or `confidenceInHistory`.

Admin and client presentation remain two genuinely separate code paths: the admin debug
route (`/api/admin/recommendation-learning-debug`, PR #28) is completely untouched by
this PR and still returns the full `AdaptiveScoreBreakdown`.

## 4. Deterministic reason translation

Two sources, both real data, **never AI-generated or rewritten**:

1. **Market-side reasons** (`translateOpportunityCategoryReasons`,
   `lib/recommendation-presentation/reasonTranslation.ts`): a fixed lookup table keyed
   by the actual `OpportunityCategory` vocabulary (`missing_gbp_posts`,
   `low_review_activity`, `seasonal`, `holiday`, `weather`, `local_event`,
   `declining_engagement`, `missing_business_info`, `missing_photos`,
   `stale_website_content`) behind the recommendation's related opportunities.
   **The task brief's illustrative "competitor_activity_detected" example does not
   correspond to any real opportunity category or evidence field in this codebase** —
   there is no competitor-detection opportunity type today. It is deliberately **not**
   implemented, to avoid fabricating a signal the platform doesn't actually produce.
2. **Historical reasons** (`translateHistoricalReasons`): translates PR #28's
   `AdaptiveScoreBreakdown.reasons` by `reasonType` + the **sign** of `reasonWeight`
   only — the raw weight/percentage/description is never read into the client string,
   only used to pick positive vs. negative phrasing from a fixed template table.

Sample size gating (`MIN_BUCKET_SAMPLE_SIZE_FOR_REASON`, reused from PR #28's
`weights.ts`, not duplicated): below that threshold, **no per-dimension historical claim
is made at all** — a single honest "We're still learning what works best for your
business" reason replaces every historical reason, regardless of which direction the
(statistically thin) underlying signals point.

`buildSupportingReasons` combines market-side reasons first, then historical reasons,
capped at 4 total (Phase 6's "2-4 client-safe reasons").

## 5. Confidence-label strategy

`lib/recommendation-presentation/confidenceLabels.ts` — four labels, no raw percentage
ever shown:

| Label | Condition |
|---|---|
| `Still learning` | `historicalSampleSize < MIN_BUCKET_SAMPLE_SIZE_FOR_REASON` (3) -- **regardless of how high the underlying raw confidence is** |
| `Strong recommendation` | Established history (>= 3 samples) and `finalConfidence >= 80` |
| `Good opportunity` | Established history and `finalConfidence >= 60` |
| `Worth considering` | Established history, below 60 |

Every label is paired with a fixed plain-language explanation sentence
(`confidenceExplanation`) — never a bare label with no context, and never a number.

## 6. Expected-benefit mapping

`lib/recommendation-presentation/expectedBenefit.ts` — a fixed lookup table keyed by the
existing 8 `RecommendedActionType` values, using language taken directly from the task
brief's own examples ("Improve your visibility on Google Business Profile," "Promote a
seasonal service at the right time," etc.). Deliberately contains no numeric
lead/ranking/ROI projection anywhere — a dedicated test asserts none of the 8 mappings
contain a dollar figure, a percentage, or a specific lead count.

## 7. "Do more like this" (positive feedback)

New event type, `do_more_like_this` (migration `022_do_more_like_this_event_type.sql`,
extending PR #27's `recommendation_outcome_events.event_type` check constraint) —
deliberately **distinct** from `draft_approved`: a client can approve a draft without
wanting more like it, and vice versa, so these are two independent signals.

- **No new table.** The existing `recommendation_outcome_events` model already fits —
  the same append-only, uniquely-keyed, RLS-protected table PR #27 built handles this
  event type with zero structural changes beyond the check constraint.
- **No new uniqueness protection needed** — the existing unique constraint on
  `idempotency_key` already covers it; the application computes
  `<content_approval_id>:do_more_like_this`, one per draft, matching
  `draft_approved`/`draft_rejected`'s own pattern.
- **Wired through the existing content-approval mutation path**, not a new API surface:
  `patchContentApprovalForUser` (`lib/content-approval/service.ts`) gained a new
  `action: "more_like_this"` branch that calls
  `recordDoMoreLikeThisOutcome` and **returns the approval completely unchanged** — no
  `updateContentApproval` call at all on this path. The existing `PATCH
  /api/content-approval` route and `patchContentApprovalRequest` client wrapper needed
  zero changes.
- Never approves, never publishes, never adjusts recommendation scores (that's
  explicitly out of scope for this milestone — the event is only recorded, not yet
  consumed by scoring).
- **Cannot be backfilled by reconciliation** — unlike `draft_approved` (reconstructable
  from `content_approvals.status`/`approved_at`), there is no column anywhere that
  records "a client clicked do more like this." `emptyByEventTypeCounts()` in
  `lib/recommendation-outcomes/reconciliation.ts` documents this the same way PR #27
  already documents `draft_edited`'s equivalent limitation.

## 8. Rejection experience

No new vocabulary — the UI (`REJECTION_REASON_OPTIONS` in `approval-queue.tsx`, already
built in PR #27) uses the exact canonical `RejectionReasonCodes` values from
`lib/recommendation-outcomes/types.ts`: `too_promotional`, `wrong_tone`,
`incorrect_information`, `off_brand_topic`, `poor_timing`, `duplicate_content`, `other`.
Rejecting a recommendation-generated draft already records both the authoritative
`content_approvals` status change **and** the `draft_rejected` outcome event (PR #27) —
this milestone didn't need to change that wiring, only ensure it renders inside the new
recommendation package layout, which it does (the package panel stays visible during the
rejection flow, not hidden).

## 9. Provider-failure presentation (operational, not quality)

`lib/recommendation-presentation/outcomeStatus.ts::presentOutcomeStatus` maps PR #27's
`RecommendationOutcomeSummary.lifecycleStatus` to one of 8 plain labels ("Ready for
review," "Edited," "Approved," "Rejected," "Scheduled," "Publishing," "Published,"
"Performance measured") — **except** `publish_failed`, which maps to `"Publishing needs
attention"` with `isOperationalIssue: true` and a fixed detail sentence: *"This does not
affect the quality of the recommendation."* The raw provider/OAuth error text
(`publishingFailureCategory`, `last_error`) is never read into this presentation at all —
a dedicated test confirms the string `"OAuth"` never appears in a serialized package even
when the underlying failure was an OAuth error.

## 10. Tenant isolation

Every function in `lib/recommendation-presentation/service.ts` follows the exact
`*ForUser(userId, ..., supabaseClient?)` convention used everywhere else in this
codebase. `getRecommendationDecisionPackageForUser` returns `null` for a recommendation
that doesn't exist **or** doesn't belong to the given `userId` — cross-tenant access is
indistinguishable from "not found," exactly like `getMarketingRecommendationByIdForUser`
already guarantees. `patchContentApprovalForUser`'s new `more_like_this` branch inherits
the same tenant check every other action on that function already has
(`getContentApprovalById(supabase, userId, input.id)` — a mismatched tenant simply never
finds the row). No client-supplied business ID is ever trusted:
`getRecommendationDecisionPackagesForApprovals` takes `businessProfileId` from the
server-resolved `getBusinessProfileForUser()` call in `content-approval-server.ts`, never
from a request parameter.

## 11. Approval Center integration

`components/dashboard/approval-queue.tsx` gained one new sub-component,
`RecommendationPackagePanel`, rendered inside `ApprovalCard` whenever a
`recommendationPackage` prop is present (i.e., the approval is recommendation-linked).
It shows: the recommended action + platform + outcome-status badge, an expandable "Why
this recommendation" section (why-now sentence, 2-4 supporting reasons, expected
benefit, confidence label + explanation), and stays visible during both editing and
rejecting (Phase 9's explicit requirement) rather than disappearing. A new "Do more like
this" button appears alongside Approve/Reject/Edit/Regenerate, calling the same
`patchContentApprovalRequest` client function with `action: "more_like_this"`. **No other
part of the Approval Center was redesigned** — filtering, the KPI cards, the edit/reject
forms, and every existing button all work exactly as before.

## 12. Accessibility and mobile behavior

- The panel and its buttons use the same `flex flex-wrap` + `rounded-full`/`rounded-xl`
  Tailwind patterns already used throughout this file — no new visual system.
- The expandable section uses `aria-expanded`/`aria-controls` with a `useId()`-generated
  id, matching `MarketingRecommendationCard`'s own established pattern exactly.
- The "Do more like this" button has an explicit `aria-label`.
- All text uses `text-sm`/`leading-6` with generous spacing (`space-y-3`), never a dense
  wall of text — reasons render as a short bulleted list, not a paragraph.
- Every interactive element is a real `<button>`/`<select>`/`<input>`, so keyboard
  navigation and screen readers work without any extra wiring.

## 13. Known limitations

- `MarketingRecommendationCard` (the separate recommendation-list page) still displays
  raw `priority_score`/`confidence` numbers directly — a pre-existing pattern, out of
  scope for this milestone (Phase 6 only targets the Approval Center). Worth revisiting
  in a future pass for consistency.
- The task brief's "competitor activity detected" and similar richer per-evidence market
  reasons are not implemented — no real opportunity category/evidence field in this
  codebase corresponds to them today (§4).
- No React component-rendering test infrastructure exists in this codebase (no
  `@testing-library/react`, no jsdom) — confirmed again during this milestone. Coverage
  is at the presentation-service/content-approval-service level (56 new tests), not
  component rendering. See §14 for the Playwright/manual-testing decision.
- `getRecommendationDecisionPackagesForApprovals` loops per recommendation-linked
  approval (reusing PR #27/#28's own already-accepted per-recommendation loop pattern);
  fine at today's scale.
- "Do more like this" records a signal but does not yet feed back into scoring — that
  integration is explicitly out of scope for this milestone (see PR #28's own "future
  extension points" section for the natural place to add it later).

## 14. Playwright coverage decision

No new Playwright test was added, for the same documented reason as PR #26/#27/#28: this
repository has no authenticated-flow E2E scaffolding to extend (no login helper, no seed
data, no service-role key in the E2E CI job). Building one here would mean inventing that
whole scaffold rather than extending an existing convention. Coverage instead comes from
56 new unit/service-level tests covering the presentation model, tenant isolation,
do-more-like-this wiring, and reason/confidence/status translation — see §16's manual
verification steps for what a human tester should check in the browser.

## 15. Manual verification

1. Use a test business with an eligible recommendation-generated draft in the Approval
   Center.
2. Confirm the card shows a violet-tinted recommendation package: recommended action,
   platform, outcome-status badge, and a "Why this recommendation" toggle.
3. Expand it — confirm a why-now sentence, 2-4 plain-language reasons, an expected
   benefit, and a confidence label + explanation. Confirm no raw score/percentage
   appears anywhere in this panel.
4. Edit the draft and save — confirm the package panel stays visible throughout, and the
   edit is preserved.
5. Approve a draft — confirm its status badge updates.
6. Reject a different draft, trying each of the 7 structured reasons — confirm each
   persists.
7. Click "Do more like this" — confirm the button changes to "Thanks — noted!".
8. Click it again — confirm no error and no duplicate event (verifiable via
   `recommendation_outcome_events`, one row per draft).
9. Confirm "Do more like this" never changes the approval's status.
10. For a cold-start business (no history), confirm the confidence label reads "Still
    learning" regardless of the underlying opportunity confidence.
11. For a business with substantial history, confirm a stronger label ("Strong
    recommendation"/"Good opportunity") with evidence-based reasons.
12. For content whose only publishing history is a provider/OAuth failure, confirm the
    status reads "Publishing needs attention" with the "does not affect quality" note —
    never a raw provider error.
13. Resize to a mobile width — confirm buttons remain tappable and text doesn't overflow.
14. Confirm a hand-authored (non-recommendation) draft renders with no package panel and
    no "Do more like this" button, exactly as before this PR.
15. Attempt a cross-tenant request (a different user's recommendation id) — confirm it's
    rejected/returns nothing.

## 16. Next milestone

Email/SMS delivery of this same client-facing package (explicitly out of scope here, per
the task brief) is the natural next step — the `ClientRecommendationDecisionPackage`
model this milestone built is already delivery-channel-agnostic and could be rendered
into an email template without any changes to `lib/recommendation-presentation/`.

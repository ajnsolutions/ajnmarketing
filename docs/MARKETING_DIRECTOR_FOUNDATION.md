# Marketing Director Intelligence — Foundation (Phase 1)

**Status:** Implemented (composition/orchestration layer only)
**Branch / PR theme:** `project-magic-marketing-director-foundation`
**Depends on:** [`MARKETING_DIRECTOR_ARCHITECTURE.md`](./MARKETING_DIRECTOR_ARCHITECTURE.md) (the design this PR implements)
**Constraint:** No schema changes, no API changes, no Trigger.dev changes, no backend behavior changes, no recommendation/analytics/publishing changes, no new engine, no new LLM call. `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains `false`.

---

## Purpose

Before this PR, two functions each independently decided "what matters most right now" for the customer:

- `buildPrimaryAction` (`lib/head-of-marketing/weeklyBriefing.ts`) — decided the primary CTA button.
- `buildPrimary` (formerly inside `lib/head-of-marketing/proactive.ts`) — decided the primary headline message shown first.

Both read overlapping-but-not-identical signals and were kept consistent only by convention, not by construction — see the architecture review's collision finding
(`MARKETING_DIRECTOR_ARCHITECTURE.md` §4). In one real scenario (an open recommendation with no pending approvals) they had already drifted: the CTA said "Review Recommendation" while the headline could say something entirely unrelated, because `buildPrimary`'s waterfall never checked `openRecommendations` at all.

This PR introduces `lib/marketing-director/` — a single, pure composition layer that both functions now consume. It is not a new recommendation engine, not a new scoring system, and not a new decision center. It answers exactly one question, once per Weekly Briefing render: *what's the single most important thing to tell this customer right now, and does it require their action?*

---

## Composition-layer responsibilities

**Determines** (by composing already-computed outputs, never by re-scoring):

- The single highest-value action right now — foundational connection gap → pending approvals → an open, ranked recommendation → unanswered reviews → (nothing requires attention) seasonal opportunity → celebration → reassurance.
- Which open recommendations should wait this cycle, with a concise internal reason each.
- A calm, honest, Head-of-Marketing-voice sentence describing the decision.
- Whether the customer needs to act at all (`requiresCustomerAction`).

**Coordinates existing engines by calling their outputs, never reimplementing them:**

- `marketing-decisions` + `recommendation-learning` — via the already-ranked, already-adaptive-scored `marketing_recommendations` rows (`getActiveMarketingRecommendationsForUser`), never rescored.
- `recommendation-presentation` — the existing explainability package (`getRecommendationDecisionPackageForUser`) is reused verbatim for the top-ranked recommendation's `whyNow`/`expectedBenefit`/`confidenceLabel`. This is the same package the Approval Center already shows; this PR is the first time it also reaches the Weekly Briefing surface.
- `command-center/context.ts` — approval/review/publishing counts already fanned out for the Head-of-Marketing layer.

**Never:**

- Calls OpenAI or any external API.
- Writes to the database (pure function of already-fetched inputs, exactly like every other module in `lib/head-of-marketing/`).
- Duplicates `marketing-decisions/scoring.ts`'s or `recommendation-learning/adaptiveScoring.ts`'s arithmetic.
- Duplicates `recommendation-outcomes`'s event recording.
- Duplicates `publishing`'s execution or scheduling.
- Replaces `marketing-decisions`, `recommendation-execution`, or `publishing` as the system of record.

## What remains owned by existing engines (unchanged by this PR)

- Opportunity detection, recommendation scoring/grouping, and adaptive historical adjustment — entirely in `lib/marketing-opportunities/` and `lib/marketing-decisions/` + `lib/recommendation-learning/`.
- Recommendation explainability composition — `lib/recommendation-presentation/service.ts`, called, not reimplemented.
- Outcome recording and lifecycle summarization — `lib/recommendation-outcomes/`.
- Publishing execution/scheduling — `lib/publishing/`, `lib/publishing-queue/`.
- Analytics measurement — `lib/analytics/`.
- Marketing Health's threshold classification, Monthly Focus's priority list, and Recent Activity's day-by-day narrative — all unchanged in this PR (see "Next migration phase" below for why `buildRecommendation`, Journal's own priority weights, and Monthly Focus's ordering were deliberately left alone).

## Shared decision contract

`lib/marketing-director/types.ts` defines `MarketingDirectorDecision` — see the file for the full shape. Key fields:

| Field | Purpose |
|---|---|
| `decisionType` | One of `meaningful_decision`, `approval_needed`, `high_value_recommendation`, `opportunity`, `reassurance`, `celebration` |
| `title` / `summary` | The actual customer-facing label and sentence |
| `rationale` | Internal — why this was selected; not shown to the customer verbatim |
| `targetOutcome` | Plain-language outcome this decision is meant to improve |
| `confidenceLabel` | Reused from `recommendation-presentation/types.ts` — never a raw percentage |
| `requiresCustomerAction` | Whether a CTA exists at all |
| `primaryAction` | The exact `{kind, label, href}` shape `HeadOfMarketingPrimaryAction` already had |
| `deferred[]` | Candidates not selected this cycle, each with a `DeferralReason` |
| `supportingSignals[]` | Internal diagnostic signal names — never customer copy |
| `sourceRecommendationId` | The recommendation this decision is about, if any |
| `presentationPriority` | Internal-only relative ranking value, never rendered |
| `evaluatedAt` | ISO timestamp of computation |

A separate `MarketingDirectorClientView` type (via `toMarketingDirectorClientView`) exists as the deliberately narrow subset (`decisionType`, `title`, `summary`, `confidenceLabel`, `requiresCustomerAction`, `primaryAction`) safe to ever hand to a Client Component. See "Server/client boundaries" below for why it isn't wired anywhere yet.

## Precedence rules

Deterministic waterfall, evaluated in this fixed order (see `lib/marketing-director/resolveDecision.ts` for the exact implementation):

1. Google Business Profile not connected → `meaningful_decision`
2. Pending approvals exist → `approval_needed`
3. An open recommendation exists (and at least one candidate was loaded) → `high_value_recommendation`, selecting `candidateRecommendations[0]` — trusted as already sorted by the persistence layer (`priority_score` desc, `created_at` desc), never re-sorted here
4. Unanswered reviews exist → `approval_needed`
5. Nothing requires attention — pick the calmest truthful thing to say: seasonal opportunity → excellent-health celebration → new-reviews celebration → view-count celebration → publishing-in-progress reassurance → early-customer reassurance → healthy reassurance → needs-attention observation → at-risk foundations reassurance

This is the union of what `buildPrimaryAction` and the old `buildPrimary` each independently decided — every existing customer-facing message this produces is byte-identical to what shipped before, verified by the full existing Weekly Briefing / Proactive / One-Head-of-Marketing test suites passing unchanged. The one intentional behavior change: step 3 now always wins over the "nothing requires attention" branches, which it did not reliably do before (see Purpose above).

`presentationPriority` is not used to choose between decision types — the waterfall order does that, deterministically. It exists only as an internal, loggable relative-ranking value should a future phase need to compare decisions across time or tenants (e.g. an admin debug view).

## Deferral reasons

`buildDeferred` in `resolveDecision.ts` assigns exactly one reason per deferred candidate, cheapest-and-most-certain first:

- `already_handled` — the candidate's `status` is `in_progress` (a draft already exists for it).
- `not_time_sensitive` — the candidate's `urgency` is `low`.
- `lower_priority` — the default: it exists, is open, and simply wasn't this cycle's pick.

`DeferralReason` also declares `blocked_by_prerequisite`, `awaiting_outcome_data`, `outside_monthly_focus`, `customer_attention_not_required`, and `duplicate_or_overlapping` for future use — none of these are assigned yet because doing so honestly would require signals not cheaply available at this composition layer today (e.g. per-candidate historical sample size, or a real dependency graph between recommendations). See "Known limitations."

Deferred entries are **not** rendered to the customer in this phase — they exist on the decision for explainability and future disclosure, exactly as the architecture review specified ("This PR does not need to expose a large 'things we rejected' interface to the customer").

## Server/client boundaries

`HeadOfMarketingPage` (`components/dashboard/head-of-marketing-page.tsx`) and its parent `app/dashboard/page.tsx` are both Server Components (no `"use client"` directive) — the entire `HeadOfMarketingBriefing`, including everything derived from the Marketing Director decision, is rendered server-side in one pass and never crosses a Server → Client Component boundary as serialized props today. Confirmed by reading both files before making any change.

Given that, this PR does not attach the full internal `MarketingDirectorDecision` to `HeadOfMarketingBriefing` at all — `buildPrimaryAction`'s replacement (`decision.primaryAction`, unchanged shape) and the proactive presence's primary moment (`{purpose, label, message}`, unchanged shape, mapped from `decision.title`/`decision.summary`) are the only things that reach the briefing object. The full decision — including `rationale`, `deferred[]`, `supportingSignals[]`, `presentationPriority`, and `sourceRecommendationId` — stays internal to `weeklyBriefing.ts`'s call graph and is discarded after use.

`toMarketingDirectorClientView`/`MarketingDirectorClientView` exist as a defensive boundary primitive for the future: if a Client Component ever needs the decision directly (e.g. an interactive explainability panel), it should receive that narrow view, never the internal `MarketingDirectorDecision`. Not wired anywhere in this PR — a natural, low-risk extension point, not implemented ahead of need.

## Current consumers

| Consumer | Before this PR | After this PR |
|---|---|---|
| `buildPrimaryAction`'s replacement | Independent 5-branch waterfall in `weeklyBriefing.ts` | `const primaryAction = decision.primaryAction;` — direct passthrough |
| Proactive presence's primary moment | Independent 11-branch waterfall (`buildPrimary`) in `proactive.ts`, reading raw signals directly | `derivePrimaryMoment(decision)` — a fixed `decisionType → purpose` lookup plus `decision.title`/`decision.summary` |

Both are computed from **one** `resolveMarketingDirectorDecision` call inside `buildWeeklyBriefing` (`weeklyBriefing.ts`), then threaded down — not two independent calls that happen to agree. `lib/head-of-marketing/service.ts` loads the ranked recommendation candidates and (only when at least one is open) the top one's explainability package, passing both into `buildWeeklyBriefing`.

## Testing strategy

`unit-tests/marketing-director-foundation.test.ts` covers the resolver directly: precedence ordering (including the connection-gap and approval-priority cases), high-value recommendation selection with and without explainability, reassurance/no-action cases, Monthly Focus theme propagation, deferred alternatives and their reasons, determinism (identical input twice → deep-equal output), tie-break trust in caller ordering, forbidden-language absence across every branch, empty/partial input handling, and the client-safe view's field allowlist.

A dedicated regression test (`regression: buildPrimaryAction and the proactive primary moment can never disagree...`) drives `buildWeeklyBriefing` end-to-end across a dozen signal combinations and asserts the CTA and the proactive purpose can never contradict each other — the exact failure mode this PR exists to make structurally impossible.

The pre-existing `unit-tests/project-magic-proactive-head-of-marketing.test.ts`, `unit-tests/project-magic-weekly-briefing.test.ts`, `unit-tests/project-magic-one-head-of-marketing.test.ts`, `unit-tests/project-magic-monthly-focus.test.ts`, and `unit-tests/project-magic-product-readiness.test.ts` suites were re-run unmodified in behavior (three `buildProactivePresence` call sites in the first were updated to construct their `decision` via the same resolver call weeklyBriefing.ts makes, replacing the removed `primaryActionKind` field) and all pass with identical assertions to before this PR.

## Known limitations

- Five of eight declared `DeferralReason` values (`blocked_by_prerequisite`, `awaiting_outcome_data`, `outside_monthly_focus`, `customer_attention_not_required`, `duplicate_or_overlapping`) are not yet assigned by any code path — they're reserved for signals not cheaply available at this layer today (e.g. a real prerequisite graph, or per-candidate historical sample size without an extra fetch per deferred item).
- `MarketingDirectorClientView`/`toMarketingDirectorClientView` are defined but unused — there is no Client Component boundary to protect yet, so this is a forward-looking primitive, not active enforcement.
- Fetching the top recommendation's explainability package adds one extra `getRecommendationDecisionPackageForUser` call to the Weekly Briefing load path, but only when `openRecommendations > 0` — the common "nothing pending" path is unaffected.
- `buildRecommendation` (the separate "What I'd recommend next" card inside `weeklyBriefing.ts`), Journal's own hand-tuned priority weights (`journal.ts`), and Monthly Focus's source-order priority list (`monthlyFocus.ts`) are **not** consolidated in this phase — deliberately, per this PR's scope (`buildPrimaryAction` and the proactive primary moment only). They remain independent, documented as the architecture review's Phase 4 candidate.

## Next migration phase

Per `MARKETING_DIRECTOR_ARCHITECTURE.md` §9's five-phase plan, this PR completes the first safe production phase (build the composition layer + migrate both existing primary resolvers to consume it, output-preserving). The natural next phase: feed `journal.ts`'s candidate priorities and `monthlyFocus.ts`'s priority ordering from the same decision/candidate data, so Recent Activity and Monthly Focus can never visibly contradict the stated top priority — see the architecture doc for the full plan. Quarterly/annual planning, competitor memory, seasonality memory, and management-style-aware decision depth remain out of scope until their own dedicated phases.

## Cron gate

`ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains `false` (`lib/trigger/scheduleActivation.ts:13`) — untouched by this PR. No Trigger.dev files were modified.

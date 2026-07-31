# Head of Marketing Orchestrator

AJN Marketing should feel like a Head of Marketing that wakes up every day, reviews
the business, decides what matters most, and presents one coherent plan. This
sprint does **not** add another AI or reasoning engine — it adds an orchestration
layer that composes what every existing system already decided into one daily
**Executive Review**.

## Architecture

```
Weekly Growth Plan  ──┐
Executive Brief   ────┼──▶ buildExecutiveReview() ──▶ ExecutiveReview
Opportunity Engine ───┘         │
                                 ▼
                     presentExecutiveReview(cadence)
                          │        │        │
                        Today   This Week  This Month
```

- **`lib/head-of-marketing-orchestrator/types.ts`** — the `ExecutiveReview` contract:
  `primaryPriority`, `secondaryPriorities`, `executiveSummary`, `decisionExplanation`,
  `actionPlan`, `trustLinks`.
- **`lib/head-of-marketing-orchestrator/build.ts`** — pure composition, no I/O.
  `buildExecutiveReview(input)` turns an already-built `WeeklyGrowthPlan`, an
  already-built `ExecutiveBrief`, and the Opportunity Detection Engine's
  already-persisted active opportunities into one `ExecutiveReview`.
  `presentExecutiveReview(review, cadence, briefsByCadence)` swaps only the
  headline/summary framing for Today / This Week / This Month.
- **`lib/head-of-marketing-orchestrator/adminOverview.ts`** — `buildAdminExecutiveOverview`
  rolls the same kind of signal up across every business an admin manages (Part 8).
- **`lib/head-of-marketing-orchestrator/service.ts`** — the two server entrypoints:
  `getExecutiveReviewAllCadencesForCurrentUser()` (customer-facing) and
  `getAdminExecutiveOverviewForCurrentAdmin()` (admin-facing).
- **`components/dashboard/executive-review-page.tsx`** + **`app/dashboard/executive-review/page.tsx`**
  — the customer-facing page, at `/dashboard/executive-review`.
- **`components/dashboard/admin-executive-overview.tsx`** + **`app/dashboard/admin/executive-overview/page.tsx`**
  — the admin-facing page, at `/dashboard/admin/executive-overview`.

## Composition flow

The orchestrator's server entrypoint (`getExecutiveReviewAllCadencesForCurrentUser`)
mirrors the exact fetch/compose chain `app/dashboard/page.tsx` already uses:

1. `getHeadOfMarketingBriefingForCurrentUser()` — already builds `executiveBriefs`
   (morning / weekly strategy / monthly executive) from the same Marketing Director
   decision, health state, and weekly wins.
2. Business Discovery, Goals, Customer Voice, External Intelligence, Smart Uploads,
   Website Testimonials — the same already-fetched Business Brain packages every
   other Business Brain surface uses.
3. `getBusinessReasoning(...)` — the Business Knowledge Graph reasons across those
   same packages; no second reasoning pass.
4. `reconcileAndGetBusinessLearningPatterns(...)` — the Business Learning Engine's
   own reconciliation, on-demand.
5. `reconcileAndGetOpportunities(...)` — the Opportunity Detection Engine's own
   reconciliation. `opportunities[0]` is the top opportunity; the rest are
   candidates for secondary priorities.
6. `getWeeklyGrowthPlanForCurrentUser(...)` — the Autonomous Growth Planner's own
   plan, which already resolves exactly one `primaryObjective` and already carries
   `whyNow`, `expectedImpact`, `estimatedEffort`, `evidence`, `explainability`,
   `historicalContext`, `supportingActions`, `successMetric`, and `whatIllWatch`.
7. `buildExecutiveReview(...)` reshapes the plan + brief + opportunities into one
   `ExecutiveReview` — see "Priority selection" below.
8. `presentExecutiveReview(...)` is called three times against the SAME review core,
   once per cadence, so the page can switch Today / This Week / This Month client-side
   without a second fetch.

Nothing in this chain re-derives a fact a Business Brain provider already computed.
The orchestrator's only original logic is: comparing the primary opportunity against
its runner-up in plain language, framing risk-of-waiting from the same evidence,
and picking which already-computed sentences go into which summary bucket.

## Priority selection

**The primary priority is never independently scored by the orchestrator.** It is
the Weekly Growth Plan's own `primaryObjective` — which already resolves through
`lib/growth-planner/primaryObjective.ts`'s existing priority order (a genuinely
strong opportunity, then Marketing Director's action type, then the highest-priority
active goal, then external intelligence seasonal signals, then Customer Voice
review pressure, then a default). The orchestrator only adds two honest,
composed-not-scored sentences on top:

- **`wonBecause`** — when a `topOpportunity` drove the objective and other active
  opportunities existed, this names how many alternatives existed and which
  dimensions (evidence strength / urgency / business impact) the winner was
  stronger on — in plain language, never a raw score. When no opportunity drove
  the objective, it says so honestly ("comes directly from your stated goals").
- **`riskOfWaiting`** — reframes the opportunity's own `whyNow` field
  forward-looking, using its urgency tier (opportunities are already tiered
  low/medium/high — see `lib/opportunity-engine/score.ts`) to decide between an
  urgent framing and a calmer one. When there's no opportunity, it says this is a
  steady, ongoing priority rather than inventing a deadline.

**Secondary priorities** (Part 3) are every other active opportunity that clears
`MIN_SECONDARY_OPPORTUNITY_SCORE` (40 — lower than the 60-point bar the Growth
Planner itself uses to let an opportunity *drive* the week, since a secondary item
only needs to be worth watching), capped at 3. Anything below that bar is not
rendered at all — it isn't shown "deprioritized," it simply isn't there, and its
count is honestly summarized in the executive summary's "what can wait" column
instead.

## Trust model

Part 9's rule — every recommendation must answer "why am I seeing this?" — is met
two ways:

1. **The decision explanation** (`decisionExplanation`) is an expandable section
   showing `signalsConsidered` (which Business Brain sources contributed, in plain
   labels — never a raw provider id), `evidenceUsed` (the Weekly Growth Plan's own
   `PlanEvidenceItem[]`, already customer-safe statements), `learningApplied` (the
   plan's own `historicalContext`, i.e. what the Business Learning Engine
   contributed), and `confidence` (the plan's own `confidenceLabelText` — never a
   raw score).
2. **Trust links** (`trustLinks`) always point back to real, already-existing
   evidence surfaces — specifically the Business Brain Inspector and its own
   section anchors (`/dashboard/business-brain#section-marketing_opportunities`,
   `#section-learning_history`, `#section-customer_themes`,
   `#section-search_trends`). No new evidence page was built for this: the
   Business Brain Inspector already had exactly these sections, so the
   orchestrator reuses them rather than duplicating an evidence view.

## Admin Executive Overview (Part 8)

`buildAdminExecutiveOverview` reuses the exact same already-computed sources every
other admin dashboard in this repo reuses:

- `getTenantOperationalHealthPage` (already batches operational health per tenant —
  see `lib/ops-dashboard/tenantHealth.ts`) buckets businesses into **needing
  attention** (`blocked`/`warning` overall state) and **doing well** (`healthy`).
- Each tenant's already-persisted active opportunities (`getActiveOpportunitiesForUser`,
  batched per tenant, never re-detected) drive **confidence gaps** (zero active
  opportunities, or every active opportunity is low-confidence) and **stalled
  opportunities** (an active opportunity whose `firstDetectedAt` is 14+ days old —
  a plain read of a persisted timestamp, never a fabricated staleness score).

This deliberately does **not** recompute Business Discovery, Customer Voice, or
External Intelligence per tenant — see "Performance strategy" below for why.

## Performance strategy

Part 10 is explicit: avoid duplicate computation, reuse cached Business Brain
outputs, and compose existing objects rather than rerunning providers. This shows
up in two places:

- **Per-user reviews** build their `ExecutiveReview` core exactly once per page
  load (`buildExecutiveReviewCoreForCurrentUser`) and derive all three
  Today/This Week/This Month cadences from that single core via
  `presentExecutiveReview` — a pure, in-memory reshape, not a second fetch.
- **The admin overview** intentionally stays at the granularity of already-batched,
  already-persisted data (tenant health snapshots, persisted opportunities) rather
  than building a full per-business `ExecutiveReview` for every tenant on every
  admin page load. A full per-tenant Executive Review would require
  userId-parameterized variants of Business Discovery, Customer Voice, and External
  Intelligence that don't exist yet (today's versions read the signed-in user's
  session) — building those just for an admin rollup would mean rerunning
  expensive Business Brain composition at exactly the scale (every tenant, every
  admin page load) where that cost matters most. The lighter rollup answers the
  mission's actual four questions (needing attention / doing well / confidence
  gaps / stalled opportunities) without that cost.

## Future extensibility

- **A true per-tenant Executive Review for admins.** If a userId-parameterized
  variant of the Business Brain fetch chain is added for another reason, the admin
  overview can upgrade from the lighter rollup above to real per-business
  `ExecutiveReview` objects without changing its own output shape.
- **New cadences.** `ExecutiveReviewCadences` and `presentExecutiveReview` are
  built to add a new cadence (e.g. quarterly) by adding one more branch and
  building one more `ExecutiveBrief` variant — `lib/head-of-marketing/types.ts`'s
  `BriefingCadenceSupport` already anticipates this with `supportedStyles`.
- **New trust links.** `EXECUTIVE_REVIEW_TRUST_LINKS` is a flat list; a future
  Business Brain section gets a trust link by adding one entry, no other change.
- **New secondary-priority sources.** Today, secondary priorities come only from
  the Opportunity Detection Engine's active list. A future source (e.g. a stalled
  goal) could contribute by producing the same `SecondaryPriority` shape and being
  merged in `buildExecutiveReview`, without changing the page.

## Testing

- **Unit tests** (`unit-tests/head-of-marketing-orchestrator.test.ts`): primary
  priority composition, the "why this one won" and "risk of waiting" framings
  (including the case with no opportunity to compare against), the secondary
  priority evidence bar and cap, the executive summary's reuse of the Executive
  Brief's own fields, the "what can wait" honesty, the decision explanation's
  evidence/learning/confidence reuse, the action plan's reuse of supporting
  actions, trust links, cadence presentation (headline/summary swap only), and
  the admin overview's bucketing/confidence-gap/stalled-opportunity logic.
- **Playwright** (`tests/head-of-marketing-orchestrator.spec.ts`): source-level
  wiring across every Part of the mission, the admin gate, the cron gate, and
  documentation coverage.

## Known limitations

- The admin overview's "confidence gap" signal is derived from opportunity
  confidence, not a full Business Knowledge Health recomputation — see
  "Performance strategy" above.
- "Risk of waiting" and "why this one won" are honest reframings of already-real
  evidence, not new predictive claims — there is no persisted historical
  snapshot to compute a true before/after delta from (the same limitation noted
  in the Business Brain Inspector's own documentation for its Timeline
  milestones).

`ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains `false` — this feature introduces no
new scheduled job.

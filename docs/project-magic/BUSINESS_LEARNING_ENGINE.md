# Project Magic 2.0 — Business Learning Engine

**Companion to:** [`BUSINESS_BRAIN.md`](./BUSINESS_BRAIN.md) · [`BUSINESS_KNOWLEDGE_GRAPH.md`](./BUSINESS_KNOWLEDGE_GRAPH.md) · [`GROWTH_ADVISOR_EXPERIENCE.md`](./GROWTH_ADVISOR_EXPERIENCE.md) · [`../RECOMMENDATION_OUTCOME_FEEDBACK_LOOP.md`](../RECOMMENDATION_OUTCOME_FEEDBACK_LOOP.md) · [`../MARKETING_MEMORY_FOUNDATION.md`](../MARKETING_MEMORY_FOUNDATION.md)

The Business Brain can already reason across sources at a single point in
time (the Business Knowledge Graph). This sprint teaches it to improve
*through experience* — to notice that certain kinds of recommendations
consistently land well (or don't), and to say so, with real evidence and
real caveats, the next time a similar recommendation comes up.

**This is not analytics, and not a generic event log.** It's a small number
of reusable, evidence-backed *business patterns*, continuously reinforced
from real outcomes already tracked elsewhere in this codebase.

**Status:** Shipped.
**Branch:** `project-magic/business-learning-engine`
**Cron gate:** `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains **false** — untouched

---

## Architecture

```
lib/business-learning-engine/
  types.ts               LearningSignalInput contract + BusinessPattern model
  confidence.ts           Decay handling + adaptive confidence blending
  lifecycle.ts             Recommendation lifecycle state derivation
  reinforce.ts              Pure pattern reconciliation (create vs. reinforce)
  learningMaturity.ts        Five-dimension Learning Maturity score
  persistence.ts             Supabase reads/writes for patterns + feedback
  service.ts                 Single entrypoint: reconcile, record feedback, look up patterns
  adapters/
    marketingMemory.ts        Marketing Memory learnings -> LearningSignalInput[]
    recommendationOutcomes.ts  Recommendation outcomes (by action type) -> LearningSignalInput[]
    businessKnowledgeGraph.ts   Business Knowledge Graph reasoning -> LearningSignalInput[]
    feedback.ts                 Explicit customer feedback -> LearningSignalInput[]

lib/business-timeline/
  types.ts                BusinessTimelineEntry model
  build.ts                  Pure composition over already-fetched sources
  service.ts                 Entrypoint for the Business Timeline page

supabase/migrations/034_business_learning_engine.sql
  business_learning_patterns        Persisted, reinforced patterns
  recommendation_feedback_events    Explicit "helped" / "wasn't useful" feedback
```

### Why this isn't a second Marketing Memory

This codebase already has `lib/marketing-memory/` — a real, statistically
evaluated pattern-learning system (timing and recommendation-action-outcome
learnings, with confidence levels, sample sizes, and a status lifecycle).
The Business Learning Engine does not re-derive what Marketing Memory
already computes. Instead, it **treats Marketing Memory's own learnings as
one input provider** (via `adapters/marketingMemory.ts`), alongside two more
sources Marketing Memory doesn't cover on its own: recommendation outcomes
grouped by action type, and Business Knowledge Graph conclusions. A fourth
provider — this engine's own explicit customer feedback — closes the loop
Part 9 asks for. Nothing here duplicates Marketing Memory's storage,
evaluation math, or preference/override system.

### Why this isn't a generic event log

`lib/recommendation-outcomes/` already has an append-only
`recommendation_outcome_events` table and a deterministic lifecycle
(`RecommendationLifecycleStatus` + `UsefulnessSignal`). This engine reuses
that event log as-is (via `getOutcomeEventsForBusiness` /
`summarizeRecommendationOutcomeForUser`, already exported functions) rather
than creating a second one. The only new table,
`recommendation_feedback_events`, exists because no prior table captures
*retrospective* customer judgment on a recommendation's real-world value —
distinct from `content_approvals` (pre-publish approve/reject) and
`do_more_like_this` (a pre/at-approval-time signal).

### The provider-agnostic adapter pattern

Every provider normalizes into one shared contract:

```ts
type LearningSignalInput = {
  sourceProviderId: string;
  sourceLabel: string;
  patternKey: string;      // deterministic, namespaced per provider
  statement: string;       // customer-safe
  direction: "positive" | "negative" | "neutral" | "inconclusive";
  confidence: "low" | "medium" | "high";
  evidenceSummary: string;
  occurredAt: string | null;
};
```

`reinforce.ts` (the reconciliation engine) and `service.ts` (the
orchestrator) only ever operate on this shape — neither contains a branch
on `sourceProviderId`. Two providers can intentionally share the same
`patternKey` namespace (e.g. `recommendation_action_outcome:{actionType}`
from both `recommendationOutcomes.ts` and `feedback.ts`) so that outcome
data and explicit feedback about the same kind of recommendation reinforce
**one** pattern, not two competing ones — this is the cross-provider fusion
Part 1 asks for.

---

## Learning model (Part 2)

One row of `business_learning_patterns`:

| Field | Meaning |
|---|---|
| `patternKey` | Deterministic identity across reinforcements |
| `statement` | Customer-safe claim, e.g. "Publish Gbp Post recommendations consistently perform well for your business." |
| `direction` | positive / negative / neutral / inconclusive |
| `confidenceLevel` | The pattern's own stored confidence (never drops on reinforcement — only decay lowers it) |
| `contributingProviders` | Every distinct provider that has reinforced this pattern |
| `evidence` | Bounded, append-only evidence list (never a raw provider payload) |
| `firstObserved` / `lastReinforced` | Real timestamps, never fabricated |
| `reinforcementCount` | How many times independent evidence has reinforced this pattern |
| `decayState` | `fresh` (≤30 days since last reinforcement) / `decaying` (≤90 days) / `stale` (beyond) — recomputed on every read from `lastReinforced`, never persisted as the source of truth |

`reinforce.ts`'s `planReinforcement()` decides, for a batch of fresh
signals against already-persisted patterns, what's brand new vs. what
reinforces something that already exists — and is **idempotent**: replaying
the exact same signal never double-counts reinforcement (it checks whether
the evidence is already present before counting it again).

---

## Pattern lifecycle (Part 3) — recommendation states

`lib/business-learning-engine/lifecycle.ts`'s `deriveRecommendationLifecycleState()`
is a pure, deterministic normalization over three already-existing
vocabularies — `RecommendationStatus` (marketing-decisions), the
already-shipped `RecommendationLifecycleStatus` + `UsefulnessSignal`
(recommendation-outcomes), and this engine's own explicit feedback — never
a new persisted status column, exactly like recommendation-outcomes' own
`presentOutcomeStatus()` pattern.

```
Suggested → Generated → Approved → Published → Observed → Successful
                      ↘ Rejected            ↘ Unsuccessful
                      ↘ Deferred
(any state) → Retired   (recommendation superseded or dismissed)
```

Priority order (first match wins): explicit customer feedback is the most
authoritative signal (it directly answers "did this work"), then terminal
recommendation states (superseded/dismissed → Retired), then the
deterministic outcome lifecycle, falling back to Suggested when nothing has
happened yet. A `measured` outcome without explicit feedback is `Observed`
— data exists, but nobody has rendered a verdict yet; only explicit
feedback (Part 9) or a future automatic-threshold rule can call it
Successful or Unsuccessful.

---

## Confidence evolution (Part 4)

`lib/business-learning-engine/confidence.ts` has two independent
mechanisms:

**Decay** — `computeDecayState()` + `applyDecay()`. A pattern nobody has
reinforced in 90+ days is presented at low confidence regardless of its
stored level; 30–90 days demotes only the top tier (high → medium); within
30 days, unaffected. Nothing is deleted or mutated — decay is recomputed on
every read from `lastReinforced`.

**Adaptive confidence** — `blendConfidence()`. Blends a recommendation's
*current* confidence with a relevant pattern's decay-adjusted confidence.
Current evidence is always the floor: the function only ever nudges
confidence **up by exactly one tier**, and only when the pattern is
genuinely positive, has real reinforcement behind it (≥2), and is itself at
least medium confidence. A negative or thin pattern never silently
downgrades the recommendation Marketing Director already decided on —
instead it's surfaced as separate, explicit historical context (see below),
never blended into the confidence number itself. This is deliberately
conservative: current evidence remains the strongest signal, and history
only ever influences, never dominates.

---

## Growth Advisor (Part 5)

`historicalContextFromPattern()` in `buildGrowthAdvisorBriefing.ts` adds a
new `historicalContext` field to the current recommendation (parallel to
the existing `customerVoiceContext`) — e.g.:

> "Publish Gbp Post recommendations consistently perform well for your
> business. We've seen this 3 times across 2 sources."

Only fires once a pattern has real reinforcement (≥2) and a clear direction
(positive or negative) — never for a single thin data point or an
inconclusive pattern. Rendered in `recommendation-section.tsx` alongside the
recommendation, and folded into `whyIBelieve` / `supportingEvidence` for
progressive disclosure.

---

## Weekly Growth Plan (Part 6)

`buildHistoricalContext()` in `lib/growth-planner/evidence.ts` produces a
**separate** `historicalContext: PlanEvidenceItem[]` field on
`WeeklyGrowthPlan` — shown under "From past experience" in the plan's "Why
I believe this" disclosure, never merged into `evidence` (current-cycle
evidence). Same reinforcement/direction gate as Growth Advisor's version.

---

## Marketing Health — Learning Maturity (Part 7)

`lib/business-learning-engine/learningMaturity.ts`'s
`computeLearningMaturity()` scores five dimensions, each with a concrete,
actionable improvement tip:

| Dimension | What it measures | How to improve it |
|---|---|---|
| Learning depth | How many distinct, live patterns exist | Approve/reject/give feedback so there's real outcome data to learn from |
| Outcome coverage | Fraction of recommendations with a tracked outcome | Review pending recommendations |
| Recommendation feedback rate | Fraction of published recommendations with explicit feedback | Use "This helped" / "Wasn't useful" |
| Evidence quality | Average confidence across all live patterns | More corroborating sources and reinforcement over time |
| Confidence stability | Fraction of patterns still actively reinforced (not stale) | Keep engaging regularly — unreinforced patterns decay |

This is additive, alongside Business Knowledge Health
(`lib/business-knowledge-graph/knowledgeHealth.ts`) and the three
pre-existing, independent "Marketing Health" implementations (command-center
score, Head of Marketing state, Customer Voice health) — none of those are
touched.

---

## Business Timeline (Part 8)

`lib/business-timeline/` is a pure composition over already-fetched
sources — no new persisted event log. Every entry answers **"what
changed"** and, only when genuinely applicable, **"what did the AI
learn"** (`whatDidAILearn` is `null`, not fabricated, for routine events like
a routine approval). Sources: recommendation outcome events (approved /
published / measured), completed campaigns, processed Smart Upload
documents, Search Console demand milestones, Customer Voice theme
milestones, and this engine's own learning-pattern first-observations.
Every entry's `occurredAt` is the real timestamp of the underlying signal —
never "now," even though External Intelligence and Customer Voice are
recomputed fresh on every request. Complements, rather than duplicates,
Decision Intelligence's internal `DecisionTimelineEvent` feed (an
admin/power-user diagnostic view) and the Head of Marketing Journal's
curated ≤5-entry narrative — this is the customer-friendly, chronological
version, at `/dashboard/business-timeline`.

---

## Feedback loop (Part 9)

A customer can tell the engine directly: **"This helped"** / **"Wasn't
useful"** — buttons on the current recommendation
(`components/dashboard/growth-advisor/recommendation-section.tsx`), backed
by `POST /api/recommendation-feedback`, which verifies the recommendation
belongs to the caller before recording anything, then inserts an append-only
`recommendation_feedback_events` row. This feeds `adapters/feedback.ts`
directly into pattern reinforcement (grouped by the recommendation's action
type, same namespace as `recommendationOutcomes.ts`, so feedback and
outcome data reinforce the same pattern) and directly determines a
recommendation's lifecycle state (`Successful` / `Unsuccessful` — see Pattern
lifecycle above), always explainable back to the real feedback events behind
it.

---

## Provider integration (Part 10) — future providers

Because every adapter emits the same `LearningSignalInput` contract and
`reinforce.ts` never branches on provider id, adding Testimonials, Weather,
GBP Insights, Competitor Intelligence, Social Analytics, Advertising, or
Email Marketing means:

1. Write one adapter function: `<provider>ToLearningSignals(nativeShape) -> LearningSignalInput[]`.
2. Add one line to the signal-gathering step in `service.ts`.

Nothing else changes. The provider-extensibility test in
`unit-tests/business-learning-engine.test.ts` proves this by feeding the
engine a signal from a `sourceProviderId` (`"gbp_insights"`) that has no
adapter in this sprint at all, and confirming it fuses into a pattern
exactly like a known provider would.

---

## Testing

`unit-tests/business-learning-engine.test.ts` covers: decay handling and
adaptive confidence at every threshold (including the "never dominates"
guarantee), pattern reconciliation (create vs. reinforce, idempotency),
recommendation lifecycle derivation for every state and priority ordering,
every adapter's real transform logic, Growth Advisor and Weekly Growth Plan
integration, Learning Maturity scoring, Business Timeline composition, and
provider extensibility.

`tests/business-learning-engine.spec.ts` (Playwright) verifies the modules
and migration exist, that reconciliation/adapters never branch on provider
id, that the feedback route enforces ownership and stays 401'd when
unauthenticated, that the Business Timeline page requires auth, that Growth
Advisor/Weekly Growth Plan/Marketing Health actually wire the engine in, and
that the cron gate remains `false`.

---

## Future roadmap

- **More providers, zero engine changes.** See Provider integration above —
  no roadmap item here requires touching `reinforce.ts` or `service.ts`.
- **Topic-level (not just action-type-level) outcome patterns.** Today's
  `recommendationOutcomes.ts` adapter groups by `recommended_action_type`
  (the only per-recommendation dimension the schema tracks) — not by
  service/topic (e.g. "commercial roofing" specifically). A future provider
  with genuinely topic-level outcome data (e.g. correlating Search Console
  clicks or Customer Voice sentiment to a specific published recommendation)
  can produce a topic-scoped pattern through the same contract without any
  engine change — see Known Limitations below.
- **Automatic Successful/Unsuccessful classification.** Today those states
  require explicit customer feedback. A future threshold rule comparing
  `content_performance` against a baseline could classify some
  recommendations automatically, still surfaced as `Observed` until real
  confidence in that threshold exists.
- **Persisted timeline history for reinforcement events.** The Business
  Timeline currently shows only a pattern's `firstObserved` milestone (no
  fabricated intermediate reinforcement dates); a future sprint could add a
  lightweight reinforcement-event log (still respecting the "no generic
  event log" rule — scoped specifically to this purpose) to show "this
  pattern was reinforced again on such-and-such date."

## Known limitations

- **No genuine topic/service-level outcome correlation exists yet.**
  Neither Search Console clicks nor Customer Voice sentiment are currently
  linked back to a specific published recommendation anywhere in this
  codebase (confirmed by direct inspection before this sprint). The
  `recommendationOutcomes` and `feedback` adapters therefore group by
  `recommended_action_type` — a real, honest signal — rather than
  fabricating a "commercial roofing recommendations outperform residential"
  claim the underlying data can't yet support at that granularity.
- **Decay windows (30/90 days) are stated, not tuned against real usage
  data.** They're a reasonable, documented default, not a fitted parameter.
- **Learning Maturity's "strong pattern count" target (5) is an arbitrary,
  stated threshold**, not a benchmarked number — chosen for honest, legible
  scoring rather than false precision.
- **No cross-tenant learning.** Every pattern is scoped to one business
  profile — the engine never learns from, or leaks evidence across,
  different customers' data.

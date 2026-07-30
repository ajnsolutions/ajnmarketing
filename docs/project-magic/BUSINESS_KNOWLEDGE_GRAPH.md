# Project Magic 2.0 — Business Knowledge Graph & Cross-Source Reasoning

**Companion to:** [`BUSINESS_BRAIN.md`](./BUSINESS_BRAIN.md) · [`GROWTH_ADVISOR_EXPERIENCE.md`](./GROWTH_ADVISOR_EXPERIENCE.md) · [`SMART_UPLOADS.md`](./SMART_UPLOADS.md)

The Business Brain has, until now, contained multiple independent knowledge
sources: Business Discovery, Goals, Customer Voice, External Intelligence,
Smart Uploads. Each one is honest and evidence-linked on its own — but a
customer experiencing five separate observations doesn't feel like "you
understand my business." It feels like "you have lots of disconnected data."

This sprint teaches the Business Brain to **reason across sources** — to
notice when several independent providers are quietly describing the same
real-world thing, to say so with appropriate confidence, and to say clearly
when sources disagree instead of guessing which one is right.

**Status:** Shipped.
**Branch:** `project-magic/business-knowledge-graph`
**Cron gate:** `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains **false** — untouched

---

## Architecture

```
lib/business-knowledge-graph/
  types.ts               Entity/relationship/evidence model + GraphSignalInput contract
  topicMatch.ts           Topic-word overlap clustering (fuzzy, not exact-string)
  build.ts                Fuses signals into entities + relationships (the "graph")
  reasoning.ts            Conclusions, Opportunity Signals, conflict detection
  explainability.ts       Shared "why do you believe this" contract
  knowledgeHealth.ts       Six-dimension Business Knowledge Health score
  service.ts               Single entrypoint: getBusinessReasoning / getBusinessKnowledgeHealth
  adapters/
    businessDiscovery.ts   Business Discovery -> GraphSignalInput[]
    goals.ts                Goals -> GraphSignalInput[]
    customerVoice.ts         Customer Voice -> GraphSignalInput[]
    externalIntelligence.ts  External Intelligence (Search Console, seasonal, competitors) -> GraphSignalInput[]
    smartUploads.ts           Smart Uploads knowledge facts -> GraphSignalInput[]
```

### It is a *logical* graph, not a graph database

Per [`BUSINESS_BRAIN.md`](./BUSINESS_BRAIN.md)'s rule — "no feature gets a
private data store that duplicates what the Business Brain already knows" —
nothing here is persisted. `getBusinessReasoning()` and
`getBusinessKnowledgeHealth()` are pure functions: given the same
already-fetched Business Discovery / Goals / Customer Voice / External
Intelligence / Smart Uploads packages a request already assembled, they
build the graph and reason over it in memory, once, per request. No new
migration, no new table, no second fetch of raw provider data.

### The provider-agnostic adapter pattern

Every Business Brain source gets exactly one adapter function that converts
its native shape into the shared contract:

```ts
type GraphSignalInput = {
  sourceProviderId: string;
  sourceLabel: string;
  entityType: GraphEntityType;
  entityLabel: string;
  confidence: ConfidenceLevel;
  evidenceSummary: string;
  occurredAt: string | null;
  relationship?: GraphRelationshipType;
  relatedEntityType?: GraphEntityType;
  relatedEntityLabel?: string;
};
```

`build.ts` (the graph builder) and `reasoning.ts` (the reasoning engine)
**only ever operate on this shape.** Neither file contains a single
`if (providerId === ...)` branch. This is what makes Part 10 — future
providers (Testimonials, Weather, Holiday Calendar, GBP Insights, Competitor
Intelligence, Social Analytics, Advertising, Email Marketing) — a one-file
change: write an adapter that emits `GraphSignalInput[]`, add it to
`gatherGraphSignals()` in `service.ts`. Nothing downstream changes. The
provider-extensibility unit tests in
`unit-tests/business-knowledge-graph.test.ts` prove this directly, by
feeding the engine a signal from a `sourceProviderId` no adapter in this
sprint produces and confirming it fuses in identically to a known provider.

### Entities and relationships

Twelve entity types: Service, Product, Industry, Customer Segment,
Geographic Market, Goal, Search Topic, Customer Theme, Brand Voice,
Competitive Strength, Seasonal Opportunity, Marketing Channel.

Ten relationship types: `supports`, `reinforces`, `contradicts`,
`related_to`, `expands`, `competes_with`, `mentioned_in`, `observed_by`,
`goal_for`, `served_by`. Seven of these (`supports`, `reinforces`,
`expands`, `goal_for`, `mentioned_in`, `observed_by`, `served_by`) count as
**positive corroboration** for an entity — `contradicts` and
`competes_with` never do.

### Entity clustering is fuzzy, not exact-string

Two providers almost never describe "commercial roofing" with identical
text — one says "commercial roofing," another says "commercial roofing
installation for office buildings." `topicMatch.ts` reuses the overlap-
coefficient technique from [`SMART_UPLOADS.md`](./SMART_UPLOADS.md)'s
crossover detection: strip stopwords, compare word sets, cluster above a
threshold (`0.5` for merging entities, `0.3` for resolving a relationship's
target — lower, because a target label is often a full sentence, not a
short restatement — and `0.2` below which two labels are considered
genuinely unrelated, used by conflict detection).

---

## Evidence fusion (Part 2)

An entity's total evidence is its own direct evidence **plus** the evidence
carried by every positive relationship pointing at it. Concretely, if:

- Search Console reports rising "commercial roofing" search demand (`supports` -> Service),
- a Smart Upload brochure directly describes commercial roofing (direct evidence on the Service entity),
- Customer Voice reviews praise commercial roofing (`reinforces` -> Service),
- and a stated Goal is "growing commercial roofing work" (`goal_for` -> Service),

...then the Service entity's evidence list contains all four, from four
distinct `sourceProviderId`s. Distinct provider count drives confidence:

| Distinct providers | Confidence | Output |
|---|---|---|
| 1 | low | Opportunity Signal — "may be worth watching," never "we believe" |
| 2 | medium | Business Conclusion — "we believe..." |
| 3+ | high | Business Conclusion — "we believe..." |

Every conclusion's `reasoning` field is a deterministic "because:" sentence
built only from the real evidence summaries that produced it — never an
invented take, never evidence from an entity it wasn't actually attached to.

---

## Conflict detection (Part 3)

A conflict is flagged when a stated Goal prioritizes one entity
(`goal_for` edge) while a **different, topically unrelated** entity of the
same type has strong, independent corroboration (2+ distinct providers) and
isn't itself linked to any goal. Example: a goal says "grow residential
customer base," but Smart Uploads and Customer Voice both independently
describe substantial commercial roofing work that no goal mentions.

The output is always framed as a question, never a verdict:

> "We found conflicting signals: '\{goal\}' prioritizes '\{A\}', but evidence
> from 2 other sources shows real activity around '\{B\}' instead."
>
> Recommendation: "Confirm whether '\{B\}' should also be a priority, or
> whether that evidence reflects work you'd rather not expand."

The reasoning engine never guesses which side is correct — it never picks a
winner. A single thin (1-provider) alternative is never enough to trigger a
conflict, and an alternative already linked to a goal is never flagged
against a different goal's priority — see
`findPriorityConflicts()` in `reasoning.ts`.

---

## The reasoning engine (Part 4)

`reasonAboutBusinessGraph(graph, now)` is the single reusable function every
consumer calls (via `getBusinessReasoning()` in `service.ts`). It takes the
already-built graph and returns:

```ts
type BusinessReasoningResult = {
  generatedAt: string;
  conclusions: BusinessConclusion[];       // 2+ provider corroboration
  opportunitySignals: OpportunitySignal[]; // 1 provider — lighter weight
  conflicts: BusinessConflict[];           // goal-priority mismatches
};
```

It never fabricates: every conclusion and signal is scoped to
`OPPORTUNITY_ENTITY_TYPES` (Service, Product, Geographic Market, Seasonal
Opportunity) — the entity types a growth opportunity can genuinely apply to
— and every statement traces back to real evidence carried on the graph.

This is an **evidence layer, not a second decision engine.** Marketing
Director remains the sole prioritizer of what to actually recommend (see
[`GROWTH_ADVISOR_EXPERIENCE.md`](./GROWTH_ADVISOR_EXPERIENCE.md)). Nothing
in this sprint re-ranks or replaces the Marketing Director's single
recommendation — reasoning outputs are additive annotation: new
observations and evidence citations layered on top.

---

## Growth Advisor (Part 5)

`synthesizedInsightObservation()` in `lib/growth-advisor/observations.ts`
turns the top fused conclusion into the highest-priority "What I noticed"
observation — ahead of the prior sprint's single-source crossover and
Customer Voice observations — with a `supportingEvidence` bullet list
rendered directly in `growth-advisor-page.tsx`:

> "We believe commercial roofing represents your best near-term growth
> opportunity."
> — 4 independent sources agree — that's stronger evidence than any one
> signal alone.
> - Organic clicks for "commercial roofing" grew from 5 to 40.
> - Your brochure highlights commercial roofing installation.
> - Customers consistently praise your commercial roofing work.
> - Growing commercial roofing work is one of your stated goals.

It only fires when the reasoning engine found genuine multi-source
corroboration — never pads with a single-source observation dressed up as a
synthesized one.

---

## Weekly Growth Plan (Part 6)

`synthesizePlanEvidence()` in `lib/growth-planner/evidence.ts` cites the top
fused conclusion first, under a new `"business_reasoning"` evidence source
(added to `PlanEvidenceItem["source"]` in `lib/growth-planner/types.ts`),
ahead of the existing single-source evidence items (briefing, goals,
Customer Voice, External Intelligence, Smart Uploads). `buildWeeklyGrowthPlan.ts`
and `lib/growth-planner/service.ts` thread the same `BusinessReasoningResult`
through — no second computation, no second fetch.

---

## Marketing Health / Business Knowledge Health (Part 7)

This codebase already had **three separate, independent, pre-existing**
"Marketing Health" implementations (a command-center numeric score, a Head
of Marketing categorical state, and Customer Voice health) — none of which
measure how well the Business Brain *understands* the business across
sources. Rather than retrofit any of them (out of scope, and each serves a
different, already-shipped purpose), this sprint adds a new, additive
`computeBusinessKnowledgeHealth()` in `knowledgeHealth.ts`, scoring six
dimensions from the same graph and reasoning result:

| Dimension | What it measures |
|---|---|
| Business Understanding | How many of the 12 entity types the graph has learned anything about |
| Evidence Coverage | How many opportunity-shaped entities have real evidence backing them |
| Knowledge Confidence | Average confidence across all drawn conclusions |
| Recommendation Confidence | Confidence of the single leading conclusion |
| Data Completeness | How many of the 5 Business Brain sources actually contributed a signal this request |
| Cross-Source Alignment | How much sources agree with each other (fused conclusions vs. single signals, penalized by detected conflicts) |

`missingKnowledge` lists concrete gaps in priority order — e.g. "We
understand your business, but have no customer sentiment yet" — surfaced in
the Growth Advisor's supporting context panel. This is a new signal, purely
additive; it does not touch, replace, or feed into any of the three existing
Marketing Health implementations.

---

## Business Connections (Part 8)

`recommendNextConnection()` in `lib/business-connections/recommendNext.ts`
now accepts the already-computed readiness gaps
(`BusinessBrainReadinessItem[]` from `readiness.ts`) and cites the real
missing capability behind its recommendation instead of a generic pitch:

> "We understand your business, but have no customer feedback yet —
> connecting Google Business Profile would fill that gap."

The reconnect ("needs attention") path is unchanged — that's about
restoring a broken connection, not a knowledge gap. The function stays
backward compatible: the `readiness` parameter defaults to `[]`, falling
back to the previous generic copy when no gap is known.

---

## Explainability (Part 9)

`explainConclusion()`, `explainOpportunitySignal()`, and `explainConflict()`
in `explainability.ts` map every reasoning output through one shared shape:

```ts
type ReasoningExplanation = {
  summary: string;
  supportingEvidence: string[];
  sources: string[];       // distinct provider labels, e.g. "Search Console"
  confidence: ConfidenceLevel | null;
};
```

Every field is customer-safe copy — never a raw provider payload, an
internal entity id, or a relationship id. This is the shared contract for
"why do you believe this," consumed today by Growth Advisor's supporting
evidence bullets; any future consumer (Weekly Growth Plan detail view,
Business Connections) can call the same three functions rather than
re-deriving explanation copy from raw conclusions/conflicts.

---

## Extensibility — future providers (Part 10)

Because every adapter emits the same `GraphSignalInput` contract and
`build.ts` / `reasoning.ts` never branch on provider id, adding
Testimonials, Weather, Holiday Calendar, GBP Insights, Competitor
Intelligence, Social Analytics, Advertising, or Email Marketing means:

1. Write one adapter function: `<provider>ToGraphSignals(nativeShape) -> GraphSignalInput[]`.
2. Add one line to `gatherGraphSignals()` in `service.ts`.

Nothing else changes. The provider-extensibility tests in
`unit-tests/business-knowledge-graph.test.ts` prove this by feeding the
engine a signal from a `sourceProviderId` (`"gbp_insights"`) that has no
adapter in this sprint at all, and confirming it fuses into an existing
conclusion exactly like a known provider would.

---

## Testing

`unit-tests/business-knowledge-graph.test.ts` covers: entity clustering and
relationship creation, evidence fusion, confidence calculation at each
threshold, conflict detection (including the two negative cases — a single
thin alternative, and an alternative already linked to a goal), every
adapter's mapping against real fixture shapes, both of the mission's worked
examples end to end via `getBusinessReasoning()`, explainability's
customer-safe shape, Growth Advisor and Weekly Growth Plan integration,
Business Knowledge Health scoring, Business Connections' evidence-driven
recommendations, and provider extensibility.

`tests/business-knowledge-graph.spec.ts` (Playwright) verifies the modules
exist, that the builder/reasoning engine never branch on provider id, that
every existing consumer (Growth Advisor, Weekly Growth Plan, Business
Connections, Marketing Health) actually wires the new reasoning in, that
explainability never leaks internal ids, and that the cron gate remains
`false`.

---

## Future roadmap

- **More providers, zero engine changes.** Testimonials, Weather, Holiday
  Calendar, GBP Insights, Competitor Intelligence, Social Analytics,
  Advertising, and Email Marketing each need only one adapter (see
  Extensibility above) — no roadmap item here requires touching `build.ts`
  or `reasoning.ts`.
- **A `contradicts` conflict shape.** The `contradicts` relationship type
  already exists in the type system; a future sprint could detect when two
  providers assert genuinely conflicting facts about the same entity (not
  just a goal-priority mismatch) and surface that as a second conflict kind.
- **Trend-aware conclusions.** Once reasoning output is optionally persisted
  as history (still subject to the "no private data store" rule — likely as
  an extension of existing history mechanisms like Weekly Growth Plan's),
  conclusions could describe momentum ("this has held for three weeks")
  instead of only current-state confidence.
- **Explanation reuse beyond Growth Advisor.** `explainability.ts`'s shared
  `ReasoningExplanation` shape is ready for a Weekly Growth Plan detail view
  or a Business Connections "why we suggest this" panel to consume directly,
  once those surfaces want a deeper explanation than their current summary
  line.

## Known limitations

- **Entity clustering is fuzzy, not authoritative.** Topic-word overlap is a
  heuristic, not a stable foreign key — a sufficiently vague or
  differently-worded signal may fail to merge with an existing entity (and
  create a near-duplicate) or, less often, merge two genuinely distinct
  entities that happen to share several words. The thresholds were tuned
  against the mission's worked examples and this sprint's test fixtures, not
  against a large real-world corpus.
- **Generic goals rarely link to anything.** Most of the 10-value `GoalKey`
  enum (e.g. "increase revenue") carries no service-specific text, so
  `goal_for` edges only form for goals whose label happens to name a
  specific service or market — this is correct, honest behavior (never
  fabricating a link that isn't real), not a bug to work around.
- **Conflict detection only checks goal-priority mismatches.** Part 3's
  worked example (goals vs. reviews vs. website vs. uploads) is the only
  conflict shape implemented this sprint; other kinds of cross-source
  disagreement (e.g. two providers describing contradictory facts about the
  same entity, using the `contradicts` relationship type) are modeled in
  the type system but not yet detected by the reasoning engine.
- **No persistence, no history.** Because the graph is rebuilt fresh every
  request, there's no "this conclusion has held steady for three weeks"
  trend — every request reasons from scratch over current evidence.

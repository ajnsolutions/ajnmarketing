# Project Magic — Opportunity Detection Engine

**Companion to:** [`BUSINESS_BRAIN.md`](./BUSINESS_BRAIN.md) · [`BUSINESS_KNOWLEDGE_GRAPH.md`](./BUSINESS_KNOWLEDGE_GRAPH.md) · [`BUSINESS_LEARNING_ENGINE.md`](./BUSINESS_LEARNING_ENGINE.md) · [`GROWTH_ADVISOR_EXPERIENCE.md`](./GROWTH_ADVISOR_EXPERIENCE.md) · [`AUTONOMOUS_GROWTH_PLANNER.md`](./AUTONOMOUS_GROWTH_PLANNER.md)

**Status:** Shipped.
**Branch:** `project-magic/opportunity-detection-engine`
**Cron gate:** `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains **false** — untouched

This sprint's mission was to move AJN Marketing from a system that responds to what a customer
does, into one that continuously looks for meaningful opportunities on its own — always grounded
in real, explainable evidence, never generated to appear busy.

## Architecture

The Opportunity Detection Engine (`lib/opportunity-engine/`) is a composition layer over Business
Brain packages that already exist — it introduces no new AI call and no second reasoning engine.
It reuses, rather than duplicates:

- The **Business Knowledge Graph**'s reasoning output (multi-source conclusions) as one input.
- The **Business Learning Engine**'s persisted patterns, both as a scoring input (historical
  success) and as the actual definition of "this opportunity was completed."
- **Customer Voice**'s themes (which already merge Google Reviews and Website Testimonials).
- **External Intelligence**'s already-categorized insights (seasonal, local events, search
  demand, competitor activity).
- **Smart Uploads**' existing website-content-gap detector (`crossover.ts`), not a re-implementation.

```
lib/opportunity-engine/
  types.ts                        Opportunity type, candidate, score, and lifecycle model
  adapters/
    externalIntelligence.ts        seasonal, local_event, trending_search, competitive_positioning
    customerVoice.ts                reputation, review_request, service_spotlight
    smartUploads.ts                  content_gap, faq
    businessKnowledgeGraph.ts         service_spotlight / website_improvement / seasonal (from conclusions)
    businessLearningEngine.ts          underperforming_content_refresh, high_performing_content_expansion
  detect.ts                        Aggregates every adapter — the one place a future provider registers
  score.ts                         Evidence strength / impact / urgency / confidence / historical success
  dedupe.ts                        Topic-overlap merge (same technique as the Business Knowledge Graph)
  reconcile.ts                     Pure create/update/complete/expire lifecycle planning
  persistence.ts                   CRUD against detected_opportunities (tenant-scoped)
  service.ts                       reconcileAndGetOpportunities — the single entrypoint

supabase/migrations/036_opportunity_detection_engine.sql   detected_opportunities table + RLS
```

### Request flow

```
app/dashboard/page.tsx
  - already fetches businessDiscovery, customerVoice, externalIntelligence, smartUploadFacts,
    smartUploadDocuments, businessReasoning, and the Learning Engine's reconciled patterns
        |
lib/opportunity-engine/service.ts::reconcileAndGetOpportunities
  - detect.ts gathers candidates from every adapter (Part 1/2)
  - dedupe.ts merges same-type, overlapping-topic candidates (Part 4)
  - score.ts scores each merged candidate (Part 3)
  - reconcile.ts plans create/update/complete/expire against what's already persisted (Part 4)
  - persistence.ts writes the plan, then the canonical active list is read back
        |
        +--> Growth Advisor (top opportunity only — Part 5)
        +--> Weekly Growth Plan (drives the objective + leads the evidence — Part 6)
        +--> Business Timeline (detected/completed/expired/learned-from — Part 7)
        +--> Marketing Health (Opportunity Readiness dimension — Part 8)
```

Reconciliation is on-demand, called from the dashboard page load — never a scheduled cron, matching
every other Business Brain reconciliation in this repo (Business Learning Engine, Business Knowledge
Graph). Safe to call every request: detection is deterministic, and writes only happen for
opportunities that genuinely changed this run.

## Opportunity model (Part 2)

Thirteen opportunity types, matching the mission's examples exactly (`lib/opportunity-engine/types.ts`):
seasonal, trending search, reputation, content gap, website improvement, local event, competitive
positioning, customer education, FAQ, service spotlight, review request, underperforming content
refresh, and high-performing content expansion.

Every opportunity is produced by a provider adapter emitting the shared `OpportunityCandidateInput`
shape — never a fabricated statement. Each adapter only speaks up when its source has genuine,
sufficiently strong evidence:

- A Customer Voice concern must have `evidenceCount >= 2` and `businessImpact === "high"` before it
  becomes a reputation opportunity.
- A Business Learning Engine pattern must have `reinforcementCount >= 2` before it becomes a
  content-refresh or content-expansion opportunity.
- Smart Uploads' content gap reuses the exact same overlap threshold
  (`WEBSITE_GAP_MAX_OVERLAP`) the Growth Advisor's existing gap observation already uses.

## Scoring (Part 3)

`lib/opportunity-engine/score.ts::scoreOpportunity` blends five factors into one 0–100 total:

| Factor | Weight | Source |
|---|---|---|
| Evidence strength | 35% | Corroborating provider count + evidence recency |
| Business impact | 20% | The candidate's own tiered impact |
| Urgency | 15% | The candidate's own tiered urgency |
| Confidence | 20% | The candidate's own confidence level |
| Historical success | 10% | The Business Learning Engine's pattern for the related action type, if any |

Evidence strength carries the highest weight, by design — the mission's explicit requirement that
"current evidence should remain the strongest signal." Historical success is weighted lowest and is
neutral (50) whenever no genuinely reinforced pattern exists, so a thin or absent history can never
inflate or deflate a score — only a pattern with `reinforcementCount >= 2` nudges it, exactly the
same reinforcement bar `blendConfidence` (Business Learning Engine) already uses.

## Deduplication and merging (Part 4)

`lib/opportunity-engine/dedupe.ts::mergeOpportunityCandidates` groups candidates of the same
`type` whose `topic` overlaps above `TOPIC_MERGE_THRESHOLD` — the identical topic-word-overlap
technique the Business Knowledge Graph uses for entity clustering (`topicMatch.ts`), applied here to
opportunities instead of graph entities. A merged opportunity keeps the strongest tier across all its
merged candidates for confidence/impact/urgency, and combines every contributing candidate's evidence
— so two providers independently noticing the same real opportunity strengthens it once, rather than
producing two competing entries.

## Lifecycle (Part 4)

Every opportunity is persisted (`detected_opportunities`) so its lifecycle can be tracked across
requests — `lib/opportunity-engine/reconcile.ts::planOpportunityReconciliation` is pure, deterministic
logic (no I/O) deciding, for a fresh batch of scored candidates against what's already active:

- **Create** — a candidate that matches no persisted opportunity (same type + overlapping topic).
- **Update** — a persisted opportunity re-detected this run: its evidence, score, and `last_seen_at`
  move forward; its `first_detected_at` never changes.
- **Complete** — a persisted opportunity *not* re-detected this run, whose related action type now
  has a genuinely positive, reinforced (`reinforcementCount >= 2`) Business Learning Engine pattern —
  reusing the Learning Engine's own definition of "this worked," never inventing a second one.
- **Expire** — a persisted opportunity not re-detected and not completed, whose evidence has been
  absent for more than `EXPIRE_AFTER_DAYS` (14) days — long enough to survive a single quiet
  evidence cycle, short enough that stale opportunities don't linger indefinitely.
- **Unchanged** — not re-detected, not completed, but still within the grace window — left alone,
  avoiding flapping between active/expired on every page load.

## Consumer integration

### Growth Advisor (Part 5)

`lib/growth-advisor/observations.ts::opportunityObservation` surfaces **only** the single
highest-scored active opportunity as one more "What I noticed" observation — headline (the
opportunity's own statement), why it matters (its `whyNow`), an `expectedOutcome` line (new,
optional field on `GrowthAdvisorObservation`), and supporting evidence bullets straight from the
opportunity's own evidence list. It's prioritized just behind the Business Knowledge Graph's
multi-source synthesis (the single strongest evidence in the whole system) and ahead of
single-source observations. Growth Advisor's own recommendation is never re-ranked by this —
consistent with every prior sprint's "no second decision engine" rule.

### Weekly Growth Plan (Part 6)

A genuinely strong active opportunity (`score.total >= 60`) now drives the week's primary
objective (`lib/growth-planner/primaryObjective.ts`) and its own `whyNow` becomes the plan's stated
reason, ahead of the prior static action-type/goal lookup table — literally "generated from active
opportunities rather than a static recommendation list," per the mission. A weak or absent
opportunity gracefully falls back to the exact prior resolution logic, so nothing regresses for a
business without a strong opportunity yet. The opportunity is also cited as the plan's
highest-priority evidence item (`lib/growth-planner/evidence.ts`, new `"opportunity_engine"` source).

### Business Timeline (Part 7)

Four new entry types (`lib/business-timeline/build.ts::opportunityEntries`): opportunity detected
(at `first_detected_at`), completed and expired (at `retired_at`), and — for a completed opportunity
with a related action type — learned from, at the same timestamp. Every timestamp is the
opportunity's own real lifecycle timestamp, never "now."

### Marketing Health (Part 8)

A new, additive `opportunityReadiness` dimension on `BusinessKnowledgeHealth`
(`lib/business-knowledge-graph/knowledgeHealth.ts`) — scored from the count of currently active
opportunities, and explaining how many recently expired without being acted on. When there are zero
active opportunities, it's the honest 0 score used everywhere else in this dimension set, and a new
"Active opportunities" gap appears in `missingKnowledge` explaining that more evidence from
connected sources would help identify one.

## Provider integration (Part 9)

Adding a future opportunity source is exactly: write one adapter function producing
`OpportunityCandidateInput[]`, and add it to the list in `detect.ts`. Nothing else — scoring,
deduplication, reconciliation, persistence, or any consumer — needs to change or branch on the new
provider's id, the same discipline every other Business Brain engine in this repo (Business
Knowledge Graph, Business Learning Engine, Customer Voice) already follows.

## Security & tenant isolation

`detected_opportunities` enables RLS scoped to `auth.uid() = user_id`, with select/insert/update
policies — no delete policy, since opportunities are lifecycle-retired (completed/expired), never
removed, preserving the audit trail of what was detected and when. Every persistence function is
exercised in `unit-tests/opportunity-detection-engine.test.ts` against a fake Supabase client
proving reads and inserts scope to the given `userId`; updates-by-id rely on RLS for tenant
isolation, the same established pattern `business-learning-engine/persistence.ts` already uses for
`updateBusinessLearningPattern`.

## Testing

`unit-tests/opportunity-detection-engine.test.ts` covers scoring (evidence-strength weighting,
historical-success neutrality/reward/penalty), every adapter (including the no-fabrication guard —
each returns nothing when evidence is too thin), deduplication/merging, lifecycle reconciliation
(create/update/complete/expire, including the expiry grace window), and integration with Growth
Advisor, the Weekly Growth Plan, Business Timeline, and Marketing Health. `tests/opportunity-detection-engine.spec.ts`
covers module existence, the full opportunity-type list, RLS presence, the cron gate, and
documentation coverage.

## Future roadmap

Known limitations and where this could go next:

- The Business Knowledge Graph adapter defaults a conclusion to `service_spotlight` when the
  caller doesn't have the underlying graph's entity-type map in hand (the dashboard currently
  passes only the reasoning result, not the graph itself, to avoid a second graph build) — a real,
  honest opportunity, just less specifically typed than it could be with a small additional wiring
  change.
- Marketing Health's "expired opportunities" count reflects opportunities that expired during the
  *current* reconciliation run, not an all-time cumulative total — accurate, but scoped to "recently,"
  not "ever."
- There is no dedicated "All Opportunities" page yet — every consumer (Growth Advisor, Weekly
  Growth Plan, Business Timeline, Marketing Health) surfaces opportunities in context, matching the
  mission's explicit instruction to reuse those surfaces rather than add a new one. A future sprint
  could add a browsable list for a customer who wants to see every active and recently retired
  opportunity in one place.
- Only five providers have adapters today (External Intelligence, Customer Voice, Smart Uploads,
  the Business Knowledge Graph, the Business Learning Engine) — Business Discovery and Goals
  contribute indirectly today (through the Business Knowledge Graph's own conclusions and Smart
  Uploads' website-service comparison) rather than through a dedicated adapter of their own. Adding
  one is exactly the Part 9 extensibility pattern described above.

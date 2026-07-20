# Marketing Experimentation Engine

**Project Magic Phase 2E.** Manages controlled marketing experiments that have already been approved by the Marketing Director and user.

## Responsibilities

The Experimentation Engine:

- Creates experiment records from **Marketing Director–proposed** inputs backed by existing recommendations
- Manages deterministic lifecycle transitions
- Compares variants using existing analytics KPIs
- Summarizes findings with confidence indicators
- Surfaces active/completed experiments on the Head of Marketing dashboard
- On completion, records a Marketing Memory **observation** (evidence only)
- Exposes explainable results via API

The Experimentation Engine does **not**:

- Invent experiments or free-form experiment creation
- Generate or re-rank recommendations
- Automatically launch or approve experiments
- Modify campaigns or publish content autonomously
- Write Marketing Memory learnings or preferences
- Call LLMs or ML models
- Attach Trigger.dev production crons (`ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains `false`)

## Source-of-truth boundaries

| Concern | Owner |
|---|---|
| Should an experiment exist? | Marketing Director |
| Experiment type / hypothesis / linkage | Marketing Director (via proposal) |
| Create record / lifecycle / measure | Experimentation Engine |
| Strategy / prioritization | Marketing Director only |
| Create recommendations | Recommendation Engine (unchanged) |

Proposal is gated: callers must pass `proposedBy: "marketing_director"`, a non-empty `marketingDirectorDecisionKey`, and `createdFromRecommendationId`. See `lib/marketing-director/experimentProposal.ts`.

## Lifecycle

```
Draft → Proposed → Approved → Running → Measuring → Completed → Archived
```

All transitions are deterministic and auditable (`lib/marketing-experimentation/experiment-state.ts`).

## Experiment model

Deterministic types (templates in `experiment-templates.ts`):

- posting time
- content format
- CTA variation
- educational vs promotional messaging
- image vs text emphasis
- campaign sequencing
- review request timing

Only templates backed by existing Marketing Director recommendations may be proposed.

## Analytics integration

Reuses existing analytics snapshots / KPIs only:

- engagement
- clicks
- reviews
- reach
- conversions
- publishing consistency

No new analytics providers. Measurement splits the latest snapshot deterministically into A/B buckets for comparison.

## Marketing Memory integration

On first transition into `completed`, the engine records an `experiment_completed` observation via `recordObservationForExperimentCompletion`. Payload includes experiment type, variant summary, measured outcome, confidence level, and supporting metrics. Evidence only — never overwrites preferences or learnings.

## Modules

| Module | Role |
|---|---|
| `experiment-types.ts` | Closed vocabularies + entity shapes |
| `experiment-templates.ts` | Declarative templates |
| `experiment-planner.ts` | Pure plan-from-template (MD-gated) |
| `experiment-state.ts` | Lifecycle transitions |
| `experiment-outcomes.ts` | Deterministic A/B outcome math |
| `experiment-engine.ts` | Pure progression / measure / explain helpers |
| `experiment-persistence.ts` | Batched Supabase access |
| `experiment-service.ts` | DI entrypoints + Memory observation hook |
| `experiment-dashboard.ts` | Customer-safe card projection |
| `experiment-request.ts` | API body parsing |

Schema: `supabase/migrations/028_marketing_experimentation.sql`.

APIs: `GET/POST /api/experiments`, `GET/POST /api/experiments/[id]` (`advance` | `measure` | `complete`).

## Explicit non-goals (this phase)

- No LLM / ML
- No new providers
- No autonomous actions or schedules
- No manual experiment editing UI
- No new recommendation engine
- No deployment of production crons

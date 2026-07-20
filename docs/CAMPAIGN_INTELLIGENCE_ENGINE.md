# Campaign Intelligence Engine

**Project Magic Phase 2B.** Orchestrates multi-step marketing campaign *execution*.

## Responsibilities

The Campaign Intelligence Engine:

- Turns an **approved Marketing Director strategy** into a deterministic execution plan
- Loads declarative campaign templates and builds timelines/metrics
- Tracks lifecycle progression and step completion
- Surfaces active campaigns on the Head of Marketing dashboard
- On completion, records a Marketing Memory **observation** (evidence only)

The Campaign Intelligence Engine does **not**:

- Decide whether a campaign should exist
- Choose campaign type, priority, or objective independently
- Create or re-rank recommendations
- Publish, approve, or schedule content autonomously
- Write Marketing Memory learnings
- Call LLMs or ML models
- Attach Trigger.dev production crons (`ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains `false`)

## Relationship to Marketing Director

Marketing Director remains the **only strategic decision-maker**.

| Concern | Owner |
|---|---|
| Should a campaign exist? | Marketing Director |
| Campaign type / objective / priority | Marketing Director |
| Build timeline from template | Campaign Engine |
| Progress steps / lifecycle | Campaign Engine |
| Create recommendations | Recommendation Engine (unchanged) |

Initiation is gated: callers must pass `initiatedBy: "marketing_director"` plus a non-empty `marketingDirectorDecisionKey`. See `lib/marketing-director/campaignInitiation.ts` for the Director → Engine handoff helper.

## Relationship to Marketing Memory

Campaign completion emits `campaign_completed` observations via the existing Marketing Memory ingestion pipeline (`recordObservationForCampaignCompletion`). Outcomes remain **evidence**. The engine never inserts learnings or preferences.

## Campaign lifecycle

```
Draft → Planned → Approved → Scheduled → In Progress → Completed → Measured → Archived
```

`cancelled` is reserved for a future phase (not granted in the schema check yet).

## Template architecture

Templates live in `lib/campaign-intelligence/campaign-templates.ts` as declarative data:

- Back to School
- Holiday Promotion
- Customer Appreciation
- Community Event
- Hiring
- Seasonal Promotion

Each step references an **existing** `RecommendedActionType` only (GBP post, reviews, seasonal/timely content, posting frequency, business info, photos, website refresh). Future templates should be configuration additions, not new execution branches.

## Modules

| Module | Role |
|---|---|
| `campaign-types.ts` | Closed vocabularies + entity shapes |
| `campaign-templates.ts` | Declarative templates |
| `campaign-planner.ts` | Pure plan-from-template (MD-gated) |
| `campaign-timeline.ts` | Ordering, milestones, step transitions |
| `campaign-state.ts` | Lifecycle transitions |
| `campaign-metrics.ts` | Deterministic counts/rates |
| `campaign-engine.ts` | Pure progression helpers |
| `campaign-persistence.ts` | Batched Supabase access |
| `campaign-service.ts` | DI entrypoints + Memory observation hook |
| `campaign-dashboard.ts` | Customer-safe card projection |
| `campaign-request.ts` | API body parsing |

Schema: `supabase/migrations/027_campaign_intelligence.sql`.

## Future automation hooks

Reserved for later (not implemented here):

- Cancellation transitions
- Background reminder delivery for next milestones
- Deeper Publishing Queue / Approval Center auto-links per step
- Preference-aware template selection (still Director-decided)

None of these activate schedules. Manual APIs and dashboard load remain the only entrypoints.

## Relationship to Strategic Marketing Calendar

The Strategic Marketing Calendar ([`STRATEGIC_MARKETING_CALENDAR.md`](./STRATEGIC_MARKETING_CALENDAR.md)) may display campaign spans and dated timeline steps. Campaign Intelligence remains authoritative; the calendar never invents or mutates steps.

## Relationship to Decision Intelligence

[`DECISION_INTELLIGENCE_AND_LEARNING_IMPACT.md`](./DECISION_INTELLIGENCE_AND_LEARNING_IMPACT.md) (Phase 2F) may show that a campaign's completion observation later contributed to a learning that influenced a decision — traced via explicit IDs (`marketing_memory_evidence_links` → `marketing_memory_observations.source_campaign_id`), never by matching titles or dates. It only reads campaigns; it never creates, initiates, or modifies one.

## Explicit non-goals (this phase)

- No LLM / ML
- No new providers
- No billing / OAuth changes
- No autonomous publishing or approval
- No new recommendation types
- No schedule activation

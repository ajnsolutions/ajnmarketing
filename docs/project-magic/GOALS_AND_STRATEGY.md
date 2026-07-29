# Goals & Strategy — Wave III

**Status:** Shipped (this sprint)  
**Branch:** `project-magic/wave3-goals-and-strategy`  
**Depends on:** Wave I (Business Discovery / Snapshot), Wave II (Your Growth Advisor)  
**Cron gate:** `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains **false** — untouched

---

## Intent

Transform Growth Advisor from “good recommendations” into **goal-aware** recommendations — still one primary next step, now explicitly tied to what success looks like for the business.

This sprint **does not** replace Business Discovery, Business Brain, the Recommendation Engine, Marketing Memory, Marketing Health, or Growth Advisor. It adds a thin Goal model + strategy annotation layer on top.

---

## Goal model

`lib/goals/types.ts` — lightweight `BusinessGoal`:

| Field | Purpose |
|---|---|
| `key` | Stable catalog id (e.g. `improve_online_reputation`) |
| `label` | Customer-facing copy |
| `priority` | 1 = highest |
| `status` | `active` / `paused` / `achieved` / `dropped` |
| `targetTimeframe` | `90_days` / `6_months` / `1_year` / null |
| `createdAt` / `updatedAt` | ISO timestamps |
| `meta?` | Reserved for future extensibility |

**Persistence:** encoded into `business_profiles.marketing_goals` as a single `__business_goals_v1__:` JSON marker (same no-migration pattern as audience/origin Magic markers), plus human-readable labels for existing consumers. See `lib/goals/persistence.ts`.

**Catalog:** `lib/goals/catalog.ts` — Increase revenue, Generate more leads, Increase recurring customers, Improve online reputation, Increase website conversions, Launch a new service, Expand into a new market, Grow memberships, Reduce seasonality, Save time with automation.

Legacy labels (e.g. “More reviews”) map onto catalog keys for continuity.

---

## Strategy layer

```
recommendation (already chosen by Marketing Director / recommendation engine)
        ↓
strategy layer (lib/strategy/goalRelevance.ts)
        ↓
goal relevance (Supports Goal + why)
        ↓
Growth Advisor presentation
```

The strategy layer **never ranks or scores**. It only explains why the already-selected recommendation supports a selected goal (or the customer’s primary strategic focus).

---

## Goal Progress

`lib/goals/progress.ts` — states:

- On Track  
- Needs Attention  
- Ahead of Plan  
- Establishing Baseline  

Progress uses **existing** briefing confidence signals only (GBP, reviews, posts, approvals, publish failures, early-customer flag). When evidence is thin, the advisor says it is still establishing a baseline — **never fabricates** a trend.

---

## Recommendation ranking

**Unchanged.** Marketing Director + recommendation-learning remain the sole ranking/scoring authorities. Wave III only annotates the single recommendation Growth Advisor already shows.

Each Growth Advisor recommendation presentation includes:

- Supports Goal  
- Why now  
- Expected impact  
- Estimated effort  
- Why I believe this  

(Explainability reused from recommendation-presentation / confidence labels.)

---

## Growth Advisor briefing

`buildGrowthAdvisorBriefing` now also surfaces:

- Progress toward goals  
- Strategic focus (priority-1 active goal)  
- Exactly one primary recommendation (unchanged cardinality)  
- Recommended next step (existing primary action)

---

## Onboarding

Conversational step after customer origin:

> What would success look like for your business over the next year?

Multi-select with priority order + optional timeframe (90 days / 6 months / 1 year). Setup goals page uses the same vocabulary and priority controls — not a long competing form.

---

## Future roadmap

- Per-goal metric baselines once durable outcome data exists  
- Goal-aware Monthly Focus themes (presentation only)  
- Optional `business_goals` jsonb column if marker encoding outgrows `marketing_goals`  
- Deeper website-conversion progress when analytics attribution is honest enough  

---

## Explicit non-goals

- No new AI recommendation engine  
- No change to recommendation ranking/scoring  
- No schedule activation  
- No auto-publish / auto-approve  

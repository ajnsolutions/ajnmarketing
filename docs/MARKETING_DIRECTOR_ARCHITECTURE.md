# Marketing Director Intelligence — Architecture Review & Design

**Branch:** `project-magic-decision-architecture-review` (from latest `main`, post–PR #48)
**Date:** 2026-07-17
**Type:** Architecture review and design exercise. **No implementation.** No production code, schema, API, or Trigger.dev changes in this PR.
**Framing:** Project Magic V1 is complete — Your Head of Marketing, Meet Your Head of Marketing, Weekly Briefing, Recent Activity, Monthly Focus, Marketing Health, Results, Library, and Product Readiness polish are all shipped. The customer-facing *relationship* is built. This document asks the next question: how does AJN Marketing evolve from a system that **generates** recommendations into one that **demonstrates sound marketing judgment** — and where does that judgment layer belong so it doesn't become a fourth competing brain?

> **Update (2026-07-17, `project-magic-marketing-director-foundation`):** §9's Phases 1–3 are implemented — `lib/marketing-director/` exists, and both `buildPrimaryAction` and the proactive presence's primary moment are now thin consumers of one shared `resolveMarketingDirectorDecision` call. Phases 4–5 remain future work. See [`MARKETING_DIRECTOR_FOUNDATION.md`](./MARKETING_DIRECTOR_FOUNDATION.md) for what shipped.

---

## 1. Executive Summary

AJN Marketing already has a well-factored, deterministic recommendation pipeline (opportunities → decisions → adaptive scoring → execution → outcomes → explainability) and a well-factored, pure-function presentation layer (Weekly Briefing, Monthly Focus, Recent Activity, Proactive presence). Both halves are individually sound. The gap is that **neither half has a single point that decides "the one highest-value thing to do right now, and why not everything else."** Instead:

- The recommendation engine ranks *opportunities* by an opportunity-level score, but nothing ranks *across* recommendations, monthly plan items, and reviews together for "what should the customer's attention go to this instant."
- The presentation layer has **two semi-independent functions already answering versions of that question** — `buildPrimaryAction` (the CTA) and `buildPrimary` inside `proactive.ts` (the headline message) — built at different times, reading overlapping-but-not-identical signals, kept consistent only by convention, not by construction.
- A naive "Marketing Director Intelligence" layer bolted on top would almost certainly become a **third** such resolver, not a consolidation.

The correct move is **not** a new engine. It is a thin orchestration layer that sits between the existing decision/scoring outputs and the existing presentation functions, replacing `buildPrimaryAction`'s and `buildPrimary`'s independent waterfalls with consumption of one shared decision — while calling zero new external services, writing zero new tables, and duplicating zero existing scoring logic. Section 8 designs that layer. Section 9 lays out a migration that never breaks the shipped customer experience.

---

## 2. Current Architecture — Full Decision Pipeline

### 2.1 Input signals

| Stage | Module | What it produces | Cadence |
|---|---|---|---|
| **Website Analysis** | `lib/website-analysis/` | One current snapshot per business (`website_analysis`, upsert on `user_id`) — business identity, services, brand voice, SEO fields, `contentOpportunities[]`. OpenAI (`gpt-4.1-mini`, structured JSON schema) with a heuristic fallback extractor. | On demand / triggered by the pipeline when stale; not scheduled independently. |
| **Market Context** | `lib/market-context/` | Weekly brief: 7 providers (weather, holiday, local event, school calendar, competitor, news, trend — mostly real external APIs, competitor is profile-derived) scored by `contextScoringService.ts` for relevance/timeliness/confidence, top 12 items persisted. | Weekly, or on-demand refresh if the active brief is >24h old (`recommendation-pipeline/orchestrator.ts`). |

### 2.2 Core decision engine

| Stage | Module | What it does |
|---|---|---|
| **Marketing Opportunities** | `lib/marketing-opportunities/detectionEngine.ts` | Deterministic detectors (one per category — stale website content, holidays, local events, weather, competitor activity, market-context items, etc.) evaluate current signals and persist/expire `marketing_opportunities` rows. |
| **Recommendation Engine (Decisions)** | `lib/marketing-decisions/decisionEngine.ts` + `scoring.ts` | Groups active opportunities by mapped `recommended_action_type`, scores each opportunity deterministically (`scoreOpportunity`: 50% severity + 30% confidence + 20% time-to-expiry), aggregates a priority/confidence per group (`aggregatePriorityScore`, `aggregateConfidence`), derives `urgency` from `priority_score`. Fully pure, no I/O — `lib/marketing-decisions/service.ts` persists the resulting drafts as `marketing_recommendations`. |
| **Adaptive Recommendation Intelligence** | `lib/recommendation-learning/adaptiveScoring.ts` | Pure, deterministic adjustment layer. Takes the base (current-market-only) score/confidence from the step above plus this business's historical outcome signals (`recommendation-learning/signals.ts`) and produces a **final** score/confidence with structured, per-contribution reasons (action-type/channel/category/seasonal success rates, edit-intensity penalty). Explicitly documented as never modifying the base engine, only adjusting on top of it. |
| **Recommendation Execution** | `lib/recommendation-execution/engine.ts` | Turns one eligible, still-open recommendation into a real `content_approvals` draft via the existing content-generation workflow (`marketing-decisions/create-content.ts`) — never duplicates that generation logic. Idempotent via a partial unique index, not a new mechanism. |
| **Recommendation Explainability** | `lib/recommendation-presentation/service.ts` | **This is where explainability is added.** Combines the recommendation, its linked draft, the PR #27 outcome summary, and a freshly recomputed adaptive-score breakdown into one client-safe package: `whyNow` (recommendation.reasoning), `supportingReasons` (translated from the adaptive breakdown's per-contribution reasons), `expectedBenefit`, a `confidenceLabel`/`confidenceLabelText`/`confidenceExplanation` triad, and `outcomeStatus`. Never returns raw score arithmetic or internal weights to the client. |
| **Recommendation Outcomes** | `lib/recommendation-outcomes/service.ts` | Append-only `recommendation_outcome_events` log (8 recorder functions: draft created/edited, approved, rejected, do-more-like-this, publishing queued/result, performance measured) plus a lifecycle summarizer. The single source of truth outcome data flows through — both **Publishing** (`publishingEngine.ts`) and **Analytics** (`analyticsEngine.ts`'s `syncContentPerformanceRecords`) write into this same table via this same service, never a parallel mechanism. |

### 2.3 Execution & measurement

| Stage | Module | What it does |
|---|---|---|
| **Publishing** | `lib/publishing/`, `lib/publishing-queue/` | Purely mechanical execution. Nothing in the recommendation/decision layer auto-queues a publish — every entry into `publishing_queue` requires an already-`approved` `content_approvals` row and a customer/UI-driven API call. Scheduled jobs process strictly FIFO by `scheduled_for`; no prioritization logic anywhere in this layer. |
| **Analytics** | `lib/analytics/` | Captures periodic GBP/publishing snapshots, analyzes performance/trends, and feeds outcome measurement back via `recordPerformanceMeasuredOutcome` (the same funnel as above). **Also independently generates its own heuristic recommendation drafts** into an isolated `ai_recommendations` table via `lib/analytics/recommendationEngine.ts` — see §5.2, this is a real duplication finding. |

### 2.4 Customer-facing presentation

| Stage | Module | What it does |
|---|---|---|
| **Marketing Health** | `lib/head-of-marketing/marketingHealth.ts` | Threshold-based state classifier (excellent / healthy / needs_attention / at_risk) over `overallScore`, `gbpConnected`, `pendingApprovals`, `unansweredReviews`, `publishFailures`, `openRecommendations`. Computed once per briefing, its `state` fans out to every other Head-of-Marketing module. |
| **Weekly Briefing** | `lib/head-of-marketing/weeklyBriefing.ts` | **The de facto orchestrator of the presentation layer.** `buildWeeklyBriefing` computes health, then calls `buildPrimaryAction` (the CTA), `buildRecommendation` (the "what I'd recommend" card), `estimateReviewMinutes`, then in turn calls `buildHeadOfMarketingJournal`, `buildMonthlyFocus`, and `buildProactivePresence` — each fed a hand-picked subset of the same upstream signals via manually constructed input objects. |
| **Monthly Focus** | `lib/head-of-marketing/monthlyFocus.ts` | Presentation over plan themes/goals + a seasonal hint; pulls up to 4 priorities (plan themes first, then goals, then seasonal hint, then hard-coded fallbacks) — source-order prioritization, not scored. |
| **Recent Activity (Journal)** | `lib/head-of-marketing/journal.ts` | `buildCandidates` assigns each of ~10 possible narrative candidates a hand-tuned numeric priority (40–100), sorts descending, keeps the top 5 as day-labeled entries with an `eventKind` classification (celebration/milestone/decision_requested/recommendation/completed_work/progress/observation). |
| **Proactive presence** | `lib/head-of-marketing/proactive.ts` | The newest module. `buildPrimary` implements a documented hierarchy (decision requested → opportunity → celebration → progress → reassurance) to select the single "primary moment" shown as the briefing's lead message, plus `buildCelebrations` (capped secondary list). |

### 2.5 Where signals actually converge

`lib/command-center/context.ts`'s `loadCommandCenterContext` is the shared signal fan-out for the Command Center **and** for `lib/head-of-marketing/service.ts` — it pulls content-generation context, website analysis, approval stats, task data, GBP data, plan data, and publishing stats in one `Promise.all`. Notably, it does **not** include Market Context or the rich recommendation-presentation/explainability package — Head-of-Marketing gets only a bare `openRecommendations` count (a separate, single, correctly-deduplicated query in `service.ts`), not the `whyNow`/`supportingReasons`/`confidenceLabel` explainability already computed for the Approval Center. This is a real gap: the richest "why" data in the system (§2.2's Explainability step) never reaches the customer-facing narrative layer today.

---

## 3. Data Flow Diagram

```
┌─────────────────┐     ┌──────────────────┐
│ Website Analysis │     │  Market Context   │   (input signals)
│  (OpenAI/scrape)  │     │ (7 providers,     │
│  1 snapshot/user  │     │  contextScoring)  │
└─────────┬────────┘     └─────────┬─────────┘
          │                        │
          ▼                        ▼
   ┌──────────────────────────────────────┐
   │        Marketing Opportunities         │   deterministic detectors
   │        (detectionEngine.ts)            │   persist marketing_opportunities
   └──────────────────┬──────────────────┘
                       ▼
   ┌──────────────────────────────────────┐
   │     Recommendation Engine (Decisions)   │   scoring.ts: severity/confidence/
   │     (decisionEngine.ts + scoring.ts)    │   time → priority_score → urgency
   └──────────────────┬──────────────────┘
                       ▼
   ┌──────────────────────────────────────┐
   │  Adaptive Recommendation Intelligence   │   + historical outcome signals
   │  (adaptiveScoring.ts)                   │   → final score/confidence + reasons
   └──────────┬───────────────────┬───────┘
              ▼                   ▼
   ┌─────────────────┐   ┌──────────────────────┐
   │  Recommendation   │   │  Recommendation        │
   │  Execution         │   │  Explainability         │  ◄── "where explainability is added"
   │  (→ content draft)  │   │  (presentation/service) │
   └─────────┬────────┘   └───────────┬──────────┘
             │                        │
             ▼                        │  (feeds Approval Center only today —
   ┌──────────────────┐              │   NOT the Head-of-Marketing layer)
   │  Approval (human)  │              │
   └─────────┬────────┘              │
             ▼                        │
   ┌──────────────────┐              │
   │     Publishing      │              │
   │  (mechanical, FIFO)  │              │
   └─────────┬────────┘              │
             ▼                        │
   ┌───────────────────────────────────────┐
   │   Recommendation Outcomes                │◄── single write funnel, also fed
   │   (recommendation_outcome_events)         │    by Analytics' performance sync
   └──────────────────┬────────────────────┘
                       │ (feeds back into Adaptive scoring's
                       │  historical signals — the learning loop closes here)
                       └──────────────────────────────────┐
                                                            │
   ┌────────────────────────────────────────────────────┐ │
   │                  Analytics                            │◄┘
   │  (snapshots, trends, performance; ALSO an isolated     │
   │   ai_recommendations table — a dead-end 4th "rec" list)│
   └────────────────────────────────────────────────────┘

                    ── separately ──

   ┌──────────────────────────────────────────────────┐
   │        lib/command-center/context.ts                │  shared signal fan-out
   │  (approvals, GBP, plan, publishing, website — NOT     │
   │   market-context, NOT recommendation-presentation)     │
   └───────────────────────┬──────────────────────────┘
                            ▼
   ┌──────────────────────────────────────────────────┐
   │       lib/head-of-marketing/service.ts                │  + one extra openRecommendations count
   └───────────────────────┬──────────────────────────┘
                            ▼
   ┌──────────────────────────────────────────────────┐
   │    weeklyBriefing.ts  (de facto orchestrator)         │
   │  ┌──────────────┬──────────────┬─────────────────┐  │
   │  ▼              ▼              ▼                 │  │
   │ journal.ts   monthlyFocus.ts  proactive.ts        │  │
   │ (own priority (own priority   (own "primary       │  │
   │  weights)      ordering)       moment" waterfall)   │  │
   └──────────────────────────────────────────────────┘
```

---

## 4. Decision Flow Diagram — Where "what matters most" is decided today

```
                    marketing_recommendations
                    (priority_score, urgency — from
                     scoring.ts + adaptiveScoring.ts)
                              │
              ┌───────────────┴────────────────┐
              │   NOTHING reads this ranked      │
              │   list to decide "the one thing" │
              │   for the customer-facing layer  │
              │   — only a bare COUNT crosses    │
              │   the boundary.                  │
              └───────────────────────────────────┘
                              │
       ┌──────────────────────┴──────────────────────┐
       ▼                                               ▼
┌─────────────────────┐                    ┌──────────────────────────┐
│  buildPrimaryAction()  │                    │  buildPrimary() (proactive)│
│  weeklyBriefing.ts:226 │                    │  proactive.ts:36           │
│                        │                    │                            │
│  Decides: the CTA       │                    │  Decides: the lead message  │
│  (button + href)        │◄──reads kind───────│  (headline shown first)     │
│                        │   as ONE of many    │                            │
│  Inputs: gbpConnected,  │   inputs, then       │  Inputs: healthState,       │
│  pendingApprovals,       │   RE-DERIVES the     │  gbpConnected,               │
│  openRecommendations,    │   same raw facts      │  pendingApprovals,          │
│  unansweredReviews       │   independently       │  primaryAction.kind,        │
│                        │                    │  seasonalHint, weeklyWins,   │
│  own 5-branch waterfall │                    │  isEarlyCustomer             │
└─────────────────────┘                    │                            │
                                              │  own 10-branch waterfall      │
                                              └──────────────────────────┘
       ▲                                               ▲
       │                                               │
       └──────────── kept consistent ONLY by ───────────┘
                     convention (both authors read the
                     same docs), NOT by shared code or
                     a single source of truth.

     Also independent, lower collision risk (about WHAT to
     narrate/list, not WHAT to act on):
       • journal.ts buildCandidates — own priority weights (40-100)
       • monthlyFocus.ts buildPriorities — own source-order ranking
       • marketingHealth.ts — own threshold classifier
```

**This is the central finding of this review.** Two functions already independently answer "what's the single most important thing" from overlapping-but-not-identical inputs. A Marketing Director Intelligence layer that sits *beside* rather than *replaces* these two would be a third.

---

## 5. Ownership Matrix

| Decision | Current owner | Should own it going forward? |
|---|---|---|
| Which opportunities exist right now | `marketing-opportunities/detectionEngine.ts` | **Yes, unchanged.** Deterministic detection is correctly isolated. |
| Base priority score of an opportunity | `marketing-decisions/scoring.ts` | **Yes, unchanged.** Pure, tested, no I/O. |
| Historically-adjusted final score + why | `recommendation-learning/adaptiveScoring.ts` | **Yes, unchanged.** This *is* explainable scoring already — reuse, don't rebuild. |
| Client-safe "why now / supporting reasons / expected benefit / confidence" | `recommendation-presentation/service.ts` | **Yes, unchanged.** This is the explainability package — Marketing Director should consume it, not reimplement it. |
| Whether a recommendation becomes a draft | `recommendation-execution/engine.ts` | **Yes, unchanged.** |
| Outcome history / lifecycle status | `recommendation-outcomes/service.ts` | **Yes, unchanged.** |
| Marketing Health state | `head-of-marketing/marketingHealth.ts` | **Consolidate.** Currently a real classifier living in a "presentation" module — should become an explicit input *to* Marketing Director rather than a sibling of it. |
| **The single highest-value action across recommendations + reviews + approvals** | **Nobody, cleanly** — split across `buildPrimaryAction` and `buildRecommendation` | **New: Marketing Director Intelligence.** |
| **The single primary customer-facing moment/message** | `proactive.ts`'s `buildPrimary` | **Becomes a formatter of the Marketing Director's decision**, not an independent decider. |
| What Recent Activity narrates and in what order | `journal.ts`'s hand-tuned priorities | **Should read from the same decision weights** so Recent Activity never contradicts the stated top priority. |
| What Monthly Focus lists | `monthlyFocus.ts`'s source-order logic | **Should be informed by** (not owned by) Marketing Director — Monthly Focus is a longer horizon than "right now," so it's a distinct but related concern. |
| Analytics' own recommendation list (`ai_recommendations`) | `analytics/recommendationEngine.ts` | **Retire or fold in as an input signal** — see §5.2. It is currently a disconnected fourth list nobody outside Analytics reads. |
| Publishing order/timing | `publishing/publishingScheduler.ts` | **Yes, unchanged.** Mechanical FIFO is correct — publishing should never make judgment calls; it executes decisions already made upstream. |

### 5.1 Responsibilities by component (current, unchanged by this review)

- **Website Analysis** — one-time-ish business intelligence snapshot; input only.
- **Market Context** — weekly external-signal digest with its own relevance scoring; input only. Reaches Head-of-Marketing only indirectly today (via the monthly plan), and `competitorWatchMessage` is currently hardcoded `null` — a real, dormant field.
- **Marketing Opportunities** — deterministic signal-to-opportunity translation.
- **Recommendation Engine (Decisions)** — deterministic opportunity-to-recommendation scoring/grouping.
- **Adaptive Recommendation Intelligence** — deterministic historical recalibration of the above, with reasons.
- **Recommendation Execution** — turns an eligible recommendation into content.
- **Recommendation Explainability** — assembles the client-safe "why" package for one recommendation (Approval Center only, today).
- **Recommendation Outcomes** — the append-only event log and lifecycle summarizer; single write funnel from Publishing and Analytics.
- **Marketing Health, Weekly Briefing, Monthly Focus, Recent Activity, Proactive presence** — pure presentation orchestration, each independently deciding a slice of "what matters," fed by `command-center/context.ts` + one extra recommendation count.
- **Publishing** — mechanical execution, customer-gated, no judgment calls.
- **Analytics** — measurement + a disconnected, isolated secondary recommendation list.

### 5.2 Duplication and gaps found (this review's contribution beyond `ARCHITECTURE_REVIEW_2026.md`)

Building on the prior architecture review's finding that three systems already compete for "what should this business do next" (Marketing Recommendations, Tasks, Marketing Plan — see `docs/ARCHITECTURE_REVIEW_2026.md` §3.1), this review adds:

1. **A fourth, previously-unflagged competing list**: `lib/analytics/recommendationEngine.ts` generates its own heuristic recommendations into an isolated `ai_recommendations` table. Confirmed via grep: nothing outside `lib/analytics/` reads this table. It never becomes a `marketing_recommendations` row, never flows through explainability, outcomes, or execution. It is Analytics-dashboard-only content that happens to be named "recommendations."
2. **Two independently-coded "primary decision" resolvers already exist in the presentation layer** (§4): `buildPrimaryAction` (weeklyBriefing.ts) and `buildPrimary` (proactive.ts), reading overlapping inputs, kept consistent by convention only. This is the highest-priority structural finding of this review — see §8.
3. **Five more independent decision/ranking functions** beyond those two, each with its own bespoke rule: `resolveMarketingHealthState` (threshold classifier), `buildRecommendation` (separate waterfall from `buildPrimaryAction`), `monthlyFocus.ts`'s `buildPriorities`, `journal.ts`'s `buildCandidates` priority sort, `proactive.ts`'s `buildCelebrations`. None share a common rule engine or weight table.
4. **Three genuinely separate scoring systems exist** beyond the core recommendation scorer, solving different problems and not literal duplicates of each other, but a new orchestration layer must know they exist so it doesn't reinvent a fourth: `market-context/contextScoringService.ts` (signal relevance/inclusion), `analytics/performanceAnalyzer.ts` (dashboard `engagementScore`/`opportunityScore`), `website-analysis/content-opportunities.ts` (heuristic `seoScore`/`competition` for article-title generation).
5. **The richest explainability data never reaches the customer narrative.** `recommendation-presentation/service.ts`'s `whyNow`/`supportingReasons`/`confidenceLabel` package is built for the Approval Center but Head-of-Marketing only ever sees a bare `openRecommendations` count. Marketing Director Intelligence is the natural place to finally connect these.
6. **Business logic living in modules documented as "presentation only"**: `marketingHealth.ts`'s numeric thresholds (35/55/80, `>2` recommendations), `journal.ts`'s hand-tuned 40–100 priority weights, `monthlyFocus.ts`'s regex-based theme classification. Each is individually small, but collectively they are the informal, scattered predecessor of the decision logic a real orchestration layer should own explicitly and consistently.
7. **`proactive.ts` re-derives raw signals rather than trusting `buildPrimaryAction`'s output.** It receives `primaryActionKind` but also independently re-checks `!gbpConnected` and `pendingApprovals > 0` directly — redundant re-derivation of facts already resolved one level up, not pure pass-through.

---

## 6. Pain Points (ranked)

1. **No single "why this, not that, right now" answer exists anywhere in the system.** Recommendations are scored individually; nothing ranks *across* recommendations, pending reviews, and monthly-plan items together, and nothing explicitly records what was *not* chosen and why.
2. **Two presentation functions already silently compete** for "what's most important" (§4) — the single biggest risk that a new layer gets bolted on beside instead of replacing them.
3. **A fourth recommendation-shaped system (`analytics/recommendationEngine.ts`) is fully disconnected** from the outcome-tracked, explainable pipeline — its output is customer-visible (Analytics dashboard) but has none of the rigor (no adaptive scoring, no outcome tracking, no explainability package) of the main pipeline.
4. **Explainability is computed but doesn't reach the narrative layer** — a real, already-built asset (`recommendation-presentation/service.ts`) going unused by the surface that most needs to say "why now."
5. **Scattered, undocumented-as-such decision logic** inside modules labeled "presentation only" (marketingHealth, journal, monthlyFocus) — each is defensible in isolation, but together they're an unowned, unconsolidated decision layer in disguise.
6. **Market Context reaches the customer narrative only indirectly** (via the monthly plan), and `competitorWatchMessage` is a currently-dead hardcoded `null` — a signal the docs already anticipated wiring up (see `WEEKLY_BRIEFING.md`'s `noticed` section) but never connected.

None of these are urgent bugs — Project Magic V1 ships correctly today. They are the reasons a naive "add a smart layer on top" approach would make the system worse, not better, without the design in §8–9.

---

## 7. Decision Philosophy

The Marketing Director should be able to answer six questions for its single top recommendation, every time, using only data the pipeline already computes:

| Question | Answered from |
|---|---|
| **Why now?** | `MarketingOpportunity.expires_at` / time-urgency component already in `scoring.ts`, plus Market Context timeliness scores. |
| **Why this?** | `recommendation-presentation/service.ts`'s existing `whyNow` + `supportingReasons` (adaptive breakdown, already explainable). |
| **Why not something else?** | The *rest* of the ranked `marketing_recommendations` list, currently computed but never surfaced as a "here's what's waiting" set. This is new synthesis, not new scoring — reuse the existing ranked list, add a rendering of "the next N, and why they're not #1 right now." |
| **What outcome are we trying to improve?** | The recommendation's `related_opportunity_ids` → category → the same category vocabulary `recommendation-outcomes` already tracks success against (approval rate, edit rate, publish success). No new taxonomy needed. |
| **How confident are we?** | `recommendation-presentation/service.ts`'s existing `confidenceLabel`/`confidenceExplanation` — already computed, already explainable, currently only reaches the Approval Center. |
| **What should we intentionally NOT do?** | New: an explicit "deferred" list — the next-highest-ranked recommendations that exist but were not selected, with a one-line reason (lower score, waiting on a dependency, recently declined, etc.). This is the one genuinely new piece of synthesis this layer adds; everything else is composition of existing outputs. |

---

## 8. Proposed Orchestration Layer: Marketing Director Intelligence

### 8.1 Placement

A new, small module — proposed as `lib/marketing-director/` — sitting **between** the existing decision/scoring/explainability outputs and the existing presentation functions:

```
marketing-decisions (ranked recommendations)
recommendation-learning (adaptive scores + reasons)
recommendation-presentation (explainability package)
recommendation-outcomes (lifecycle/history)
command-center context (approvals, reviews, publishing stats)
                    │
                    ▼
        lib/marketing-director/   ← NEW, pure orchestration
        (decide.ts / types.ts)
                    │
                    ▼
   MarketingDirectorDecision (one value)
      { topAction, why, deferred[], confidence, outcomeGoal, notDoing }
                    │
        ┌───────────┼────────────────┐
        ▼           ▼                ▼
  buildPrimaryAction  buildPrimary   journal/monthlyFocus
  (becomes a thin      (proactive.ts, (read decision.topAction's
   formatter of         becomes a      priority to avoid
   decision.topAction)  thin formatter) contradicting it)
```

### 8.2 Responsibilities (explicit "does" / "never does")

**Determines:**
- The single highest-value action right now, by reading the already-ranked `marketing_recommendations` (with adaptive scores) together with pending-approval and unanswered-review counts already available from `command-center/context.ts` — genuinely new synthesis is only "which of these several already-scored things wins," not new scoring math.
- Which recommendations should wait, and a one-line reason each (reusing the same score/urgency data, not new logic).
- Tradeoffs and outcome targets, entirely by composing `recommendation-presentation/service.ts`'s existing explainability fields — **it must call into this module, never reimplement it.**
- A confidence read, directly from the same `confidenceLabel`/`confidenceExplanation` already computed.

**Coordinates existing engines by calling them, never reimplementing them:**
- `marketing-decisions` (via `recommendation-presentation/service.ts` for the ranked, explainable set)
- `recommendation-learning` (indirectly, through the presentation package)
- `recommendation-outcomes` (for "what outcome are we trying to improve")
- `command-center/context.ts` (for approvals/reviews/publishing counts already fanned out)

**Never:**
- Calls OpenAI directly, or any external API.
- Writes to the database. Pure function of already-fetched inputs, exactly like every module in `lib/head-of-marketing/` today.
- Duplicates `marketing-decisions/scoring.ts`'s or `adaptiveScoring.ts`'s arithmetic — it consumes their outputs.
- Duplicates `recommendation-outcomes`'s event recording.
- Duplicates `publishing`'s execution or scheduling.
- Replaces `marketing-decisions`, `recommendation-execution`, or `publishing` as the system of record — this layer is read-only synthesis over already-authoritative data.

### 8.3 Output contract (illustrative shape, not final)

```ts
type MarketingDirectorDecision = {
  topAction: {
    recommendationId: string | null;      // null when the top action is a review/approval, not a recommendation
    kind: "recommendation" | "approval" | "review" | "connect_google" | "none";
    whyNow: string;                       // reused from recommendation-presentation
    supportingReasons: string[];          // reused from recommendation-presentation
    confidenceLabel: ConfidenceLabel;      // reused from recommendation-presentation
  };
  deferred: Array<{
    recommendationId: string;
    reason: string;                       // e.g. "lower priority than today's top pick"
  }>;
  outcomeGoal: string;                    // plain-language, derived from the top action's category
  notDoing: string | null;                // explicit "what we're intentionally not doing" — new synthesis
};
```

This is a **design sketch for discussion, not a spec to implement.** Exact field names should be settled when implementation is scoped.

### 8.4 Why this placement avoids the §4 collision

`buildPrimaryAction` and `proactive.ts`'s `buildPrimary` are not deleted or bypassed — they become **consumers** of `decision.topAction` instead of independent re-deriving functions. Both currently branch on the same handful of raw signals (`gbpConnected`, `pendingApprovals`, `openRecommendations`, `unansweredReviews`); once `MarketingDirectorDecision.topAction.kind` exists, both functions collapse to a lookup/formatting step keyed on that one value, eliminating the "kept consistent by convention" risk identified in §4 — without changing their public output shape or the customer experience.

---

## 9. Migration Strategy

Non-breaking, additive, reversible at every step.

**Phase 0 (`project-magic-decision-architecture-review`):** Document only. No code. ✅ Done.

**✅ IMPLEMENTED (`project-magic-marketing-director-foundation`) — Phases 1–3, combined into one PR:** `lib/marketing-director/` was built as a pure function library (`resolveDecision.ts` + `types.ts`) with full unit test coverage, and — rather than landing as a silent unconsumed field first — `buildPrimaryAction` and `proactive.ts`'s primary-moment function were migrated to consume the shared decision in the same PR, each verified output-identical to its prior behavior against the full existing test suite plus a new end-to-end regression test proving the two can no longer disagree. See [`MARKETING_DIRECTOR_FOUNDATION.md`](./MARKETING_DIRECTOR_FOUNDATION.md) for exactly what shipped, the precedence model as implemented, and known limitations. (The originally-planned intermediate "silent field, not yet consumed" step was judged unnecessary once full before/after test parity was established directly — the risk profile is the same either way, and skipping it avoided a throwaway intermediate commit.)

**Phase 4 (next) — Feed `journal.ts` and `monthlyFocus.ts`'s ordering from the same decision/candidate data**, so Recent Activity and Monthly Focus can never visibly contradict the stated top priority. Lower risk than the implemented phase since these are narrative/listing surfaces, not the primary CTA. Not implemented in this PR — see `MARKETING_DIRECTOR_FOUNDATION.md`'s "Known limitations."

**Phase 5 (separate decision, not sequenced here) — Resolve the disconnected systems** flagged in §5.2: retire or explicitly fold `analytics/recommendationEngine.ts`'s output in as a Marketing Director input signal (rather than a silent fourth list), and revisit the three-competing-systems finding from `ARCHITECTURE_REVIEW_2026.md` (Recommendations/Tasks/Marketing Plan) now that a real consolidation point exists to fold them into. Not implemented in this PR.

At every phase, `marketing-decisions`, `recommendation-learning`, `recommendation-execution`, `recommendation-outcomes`, and `publishing` remain completely unchanged — this migration only ever adds a consumer on top of their existing outputs.

---

## 10. Future Extensibility

The design in §8 is deliberately data-composition-only so it can absorb future capability without restructuring:

- **Cross-recommendation sequencing** ("do X before Y because Y depends on X being live") — a natural addition to `deferred[]`'s reason field, no new data source required.
- **Management styles** (Hands-On sees more detail, Trusted sees less) — `MarketingDirectorDecision` is a single value; different presentation depths are a rendering concern for `buildPrimaryAction`/`buildPrimary`/journal, exactly mirroring the `BriefingCadenceSupport`/`JournalDetailSupport` hooks already shipped and intentionally left unproductized in Weekly Briefing and the Journal.
- **Quarterly/Annual planning, competitor memory, seasonality memory, goal tracking** — all listed as future Journal/Monthly Focus extensions in their own docs; a Marketing Director that already composes from `recommendation-outcomes`' history and Market Context's seasonal signals is the natural home for any "we did this last spring" synthesis those future features need, without inventing a second history mechanism.
- **Multi-recommendation "campaigns"** (several recommendations forming one narrative arc) — `topAction`/`deferred` as designed already groups by recommendation; a `campaignId` grouping key could be added to the output type later without changing the contract's shape.

None of these require touching `marketing-decisions`, `recommendation-learning`, `recommendation-execution`, `recommendation-outcomes`, or `publishing` — by design, they are all pure consumers of the Marketing Director's output, which is itself a pure consumer of those five systems' already-stable outputs.

### 10.1 Marketing Memory (reviewed and designed separately; Phase 1 now implemented)

A durable evidence layer beneath the Marketing Director — observations, learnings, customer preferences, decisions, outcomes — was reviewed and designed in [`MARKETING_MEMORY_ARCHITECTURE.md`](./MARKETING_MEMORY_ARCHITECTURE.md) and [`MARKETING_MEMORY_DATA_MODEL.md`](./MARKETING_MEMORY_DATA_MODEL.md). **Phases 1–3 of Marketing Memory and Phase 4 consumption are implemented** — see [`MARKETING_MEMORY_FOUNDATION.md`](./MARKETING_MEMORY_FOUNDATION.md), [`MARKETING_MEMORY_LEARNINGS.md`](./MARKETING_MEMORY_LEARNINGS.md), [`MARKETING_MEMORY_PREFERENCES.md`](./MARKETING_MEMORY_PREFERENCES.md), and [`MARKETING_DIRECTOR_MEMORY_INTEGRATION.md`](./MARKETING_DIRECTOR_MEMORY_INTEGRATION.md). `resolveMarketingDirectorDecision` accepts an optional `memoryEvidence` package (same pattern as `topRecommendationDetail`) — evidence only, never a second decision authority (§8.2 still holds). Cold-start / absent memory preserves prior decision behavior.

### 10.2 Executive Briefing Engine (summarization only)

The Executive Briefing Engine ([`EXECUTIVE_BRIEFING_ENGINE.md`](./EXECUTIVE_BRIEFING_ENGINE.md)) turns the already-resolved Marketing Director decision plus existing briefing signals into a short structured Morning Brief (Weekly/Monthly types supported, not yet surfaced). It **explains** MD priorities; it does not re-rank recommendations or invent actions. Composition stays inside `buildWeeklyBriefing` so there is still exactly one `resolveMarketingDirectorDecision` call per briefing load.

### 10.3 Campaign Intelligence Engine (execution only)

The Campaign Intelligence Engine ([`CAMPAIGN_INTELLIGENCE_ENGINE.md`](./CAMPAIGN_INTELLIGENCE_ENGINE.md)) executes multi-step campaigns **after** Marketing Director decides that a campaign should exist (type, objective, priority). The engine never self-initiates, never creates recommendations, and never overrides Director priority. Completion feeds Marketing Memory as observations only. `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains `false`.

### 10.4 Strategic Marketing Calendar (presentation only)

The Strategic Marketing Calendar ([`STRATEGIC_MARKETING_CALENDAR.md`](./STRATEGIC_MARKETING_CALENDAR.md)) aggregates dated Marketing Director priorities and other authoritative systems into a read-only day/week/month view. It does not reinterpret strategy, invent priorities, or mutate any source system.

### 10.5 Marketing Experimentation Engine (proposal-gated measurement)

The Marketing Experimentation Engine ([`MARKETING_EXPERIMENTATION_ENGINE.md`](./MARKETING_EXPERIMENTATION_ENGINE.md)) is the one Phase 2 execution engine whose Director-gating is enforced structurally rather than by convention alone: since Director decisions are computed per-request and never persisted (§2.2, §8.2 — nothing in this pipeline writes `MarketingDirectorDecision` to the database), an early version of this engine accepted a client-supplied provenance string as its only gate, which a direct API call could forge. The current design instead treats a new table, `marketing_experiment_proposals`, as the first durable artifact of a specific Director determination: a deterministic eligibility rule (`lib/marketing-director/experimentEligibility.ts`) evaluates recommendations and writes proposals server-side only (RLS has no INSERT policy for the `authenticated` role at all — only the service-role client, from an admin-gated route, can create one). The user approves a proposal; the server copies its authoritative fields into exactly one experiment. Measurement reports an honest aggregate over the experiment's KPI window and never fabricates a per-variant winner — existing analytics have no per-variant attribution to give it. Completion feeds Marketing Memory as observations only. `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains `false`.

### 10.6 Decision Intelligence & Learning Impact (explanation and traceability only)

Decision Intelligence ([`DECISION_INTELLIGENCE_AND_LEARNING_IMPACT.md`](./DECISION_INTELLIGENCE_AND_LEARNING_IMPACT.md)) answers "what did Marketing Director decide, and why" from existing evidence — it never makes a decision. Since §2.2 established that `MarketingDirectorDecision` is computed per-request and never persisted, this phase implements `marketing_memory_decision_links` — a table `MARKETING_MEMORY_DATA_MODEL.md` §7 had already proposed as a Phase 4 Marketing Memory concept — as the first durable, server-authored snapshot of an already-computed decision. A small additive change to `lib/marketing-director/memoryComposition.ts` (`appliedPreferenceIds`/`consideredLearningIds`) exposes the explicit learning/preference IDs a decision consulted, which were previously available only as descriptive text — this is what lets evidence tracing use real IDs instead of matching on titles. Every trace, comparison, and explanation is computed at read time from those explicit IDs; nothing is inferred from timing proximity. `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains `false`.

---

## 11. Verification

This PR changes documentation only. Confirmed:

- `npm run lint` — clean, identical to `main`.
- TypeScript (`next build`'s type check) — clean, identical to `main`.
- `npm run test:unit` — identical pass/fail counts to `main` (no test file touched).
- `npm run build` (production build) — succeeds, identical route output to `main`.
- No files under `lib/`, `app/`, `components/`, `supabase/`, or `trigger/` were modified — `git diff --stat` against the merge base shows only `docs/MARKETING_DIRECTOR_ARCHITECTURE.md` added.
- `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains `false` (`lib/trigger/scheduleActivation.ts:13`) — untouched.
- No schedules activated. No recommendation, analytics, or publishing behavior changed.

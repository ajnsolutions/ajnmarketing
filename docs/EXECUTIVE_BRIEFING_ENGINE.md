# Executive Briefing Engine

**Branch:** `project-magic/executive-briefing-engine`  
**Phase:** Project Magic Phase 2 — first capability (Morning Brief surfaced)

The Executive Briefing Engine **summarizes** existing platform intelligence into a short, structured briefing. It does **not** generate recommendations. Marketing Director remains the only decision-maker.

---

## 1. Architecture

```
getHeadOfMarketingBriefingForCurrentUser()
  └─ buildWeeklyBriefing()
        ├─ resolveMarketingDirectorDecision()   ← sole priority authority
        ├─ buildMorningBrief / Weekly / Monthly ← summarize that decision + signals
        └─ HeadOfMarketingBriefing.executiveBrief (+ executiveBriefs.*)
```

| Piece | Path |
|---|---|
| Types | `lib/executive-briefing/types.ts` |
| Headlines | `lib/executive-briefing/headlines.ts` |
| Pure builders | `lib/executive-briefing/buildBrief.ts` |
| Refresh / delivery entry | `lib/executive-briefing/service.ts` |
| Manual refresh API | `app/api/executive-brief/route.ts` |
| Dashboard card | `components/dashboard/executive-brief-section.tsx` |

---

## 2. Brief types

| Type | Key | Surfaced |
|---|---|---|
| Morning Brief | `morning_brief` | Yes — dashboard card |
| Weekly Strategy Brief | `weekly_strategy_brief` | Built, not surfaced |
| Monthly Executive Report | `monthly_executive_report` | Built, not surfaced |

All three share the same structured shape and the same Marketing Director priorities; weekly/monthly only adjust summary framing.

---

## 3. Structured model (`ExecutiveBrief`)

- `headline` — one deterministic sentence  
- `summary` — 2–4 customer-friendly sentences  
- `topPriorities[]` — explained from MD primary action / deferred  
- `wins[]` / `watchItems[]` / `today[]` / `recentChanges[]`  
- `supportingEvidence[]` — internal context kinds (preference, learning, market context, etc.) without raw scores  
- `generatedAt`, `briefType`  

No markdown. No HTML.

---

## 4. Why there is no recommendation logic

Priorities come from `resolveMarketingDirectorDecision` only. The brief:

- copies the MD primary action into `topPriorities`
- explains wins/watch/today from already-loaded counts
- cites memory evidence the MD already consulted

It never reorders candidates, never invents action types, and never calls adaptive scoring.

---

## 5. Data flow / reuse

Reads are batched upstream in `getHeadOfMarketingBriefingForCurrentUser` (command center, recommendations, memory evidence). The brief builders are pure and receive those results — no N+1, no duplicate MD resolve.

---

## 6. Presentation

Dashboard card near the top of Head of Marketing (after proactive presence, before Monthly Focus):

- Collapsed: headline + summary + Refresh  
- Expandable `<details>`: priorities, today, wins, watch, recent changes, supporting context  
- Manual refresh via `POST /api/executive-brief` (no Trigger.dev / no cron)

---

## 7. Future extension points

`EXECUTIVE_BRIEF_FUTURE_DELIVERY_HOOKS` reserves:

- email Morning Briefs  
- mobile push  
- Slack / Teams  
- weekly emails / monthly reports  

None are implemented. `getExecutiveBriefForCurrentUser(briefType)` is the adapter entry for those channels later.

---

## 8. Engineering constraints

- No LLM, no ML, no new providers  
- `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains `false`
- Strategic Marketing Calendar may surface brief `today` items as dated priority markers; it does not create a second briefing system (see [`STRATEGIC_MARKETING_CALENDAR.md`](./STRATEGIC_MARKETING_CALENDAR.md)).  

- No background refresh jobs  

# Project Magic — Monthly Focus

**Status:** Implemented (presentation / orchestration layer)  
**Branch / PR theme:** `project-magic-monthly-focus`  
**Integrates with:** Your Head of Marketing (`/dashboard`) — not a new nav destination  
**Constraint:** No schedule activation; `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains `false`. No schema or engine changes.

---

## Purpose

A Head of Marketing always has priorities.

Monthly Focus is the living answer to:

> What are we working toward this month?

It is **not** a traditional Marketing Plan document, strategy deck, or planning engine. It is how the Head of Marketing naturally communicates shared direction so every recommendation, journal entry, and weekly briefing feels like one conversation.

---

## Relationship philosophy

| The Head of Marketing | The customer |
|---|---|
| Owns the strategy | Owns the business |
| Proposes focus collaboratively | Decides what matters for the business |

Tone examples:

- “I'd like us to focus on…”  
- “I believe this gives us the biggest opportunity…”  
- “This will help your business…”  
- “Everything I'm doing this month supports these priorities.”

Never expose: Marketing Strategy, Objectives, Campaign Management, Planning Engine, Roadmap, KPI, OKR.

Prefer: **This Month's Focus**, what we're working toward, why it matters, what success looks like.

---

## How Monthly Focus connects

```
Weekly Briefing  →  supports the focus
Journal          →  documents progress toward the focus
Recommendations  →  advance the focus
Publishing       →  executes the focus
Analytics        →  measure the focus
Marketing Health →  reflects the focus
```

No isolated experiences. One Head of Marketing remains the single source of truth.

### Journal

The Journal shows quiet day-by-day work. That work should feel consistent with Monthly Focus priorities (visibility, reviews, seasonal prep, competitors) without inventing a second plan.

### Weekly Briefing

The Weekly Briefing is the organized check-in. Monthly Focus sits near the top of the same `/dashboard` experience so “what we're working toward” frames “what I handled this week.”

### Marketing Health

Health language references the focus without guilt:

- We're on track.  
- We're making excellent progress.  
- I'd like to shift our attention slightly.

### Future Quarterly Reviews

`FocusHorizonSupport` already records `quarterly` as a supported horizon. Quarterly Priorities can reuse the same shape later — deeper review, same relationship language — without a new planning engine.

### Future Annual Planning

`annual` is likewise reserved on the horizon hook for Annual Vision. Not implemented yet.

---

## Orchestration (engineering)

`lib/head-of-marketing/monthlyFocus.ts` + types:

- **Reads** existing marketing plan themes/goals (when present), seasonal hints, and live HoM signals already loaded for the Weekly Briefing  
- **Does not** call or rewrite recommendation, analytics, publishing, or planning engines  
- **Does not** invent a fourth decision system  
- Attached as `HeadOfMarketingBriefing.monthlyFocus` from `buildWeeklyBriefing`

Engines remain the single source of truth. Monthly Focus is presentation only.

---

## Navigation

No new destination.

Lives inside **Your Head of Marketing** at `/dashboard`.

---

## Future management-style integration

`FocusStyleSupport` records Hands-On / Weekly / Monthly / Trusted.

Styles will later change how often Focus is discussed; the Focus remains the shared anchor. Do not expose automation settings yet.

---

## Magic Moments

- Here's what I'd like us to accomplish together.  
- Everything I'm doing this month supports this.  
- We're making steady progress.  
- Nothing needs to change.  
- Go enjoy your month.

---

## Claude review checklist (pre-merge)

- [ ] Presentation/orchestration only  
- [ ] No duplicated planning logic  
- [ ] Existing engines remain the source of truth  
- [ ] Monthly Focus strengthens the Head of Marketing relationship  
- [ ] Weekly Briefing, Journal, Marketing Health, and Monthly Focus form one executive communication rhythm  

---

## Verification notes

- Cron gate unchanged: `ATTACH_DECLARATIVE_PRODUCTION_CRONS = false`

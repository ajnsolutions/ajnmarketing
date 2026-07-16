# Project Magic — Weekly Briefing

**Status:** Implemented (presentation / orchestration layer)  
**Branch / PR theme:** `project-magic-weekly-briefing`  
**Integrates with:** Your Head of Marketing (`/dashboard`) — not a new nav destination  
**Constraint:** No schedule activation; `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains `false`. No schema or engine changes.

---

## Purpose

A great Head of Marketing does not interrupt the owner all week.

They work quietly, then provide **one calm, organized update**.

The Weekly Briefing is that update — the primary customer communication surface for AJN Marketing.

Everything else (Plan, Tasks, Recommendations, Publishing, Analytics, Approvals) **supports** the briefing. None of them should compete as a separate “what should I do next?” center.

---

## Customer psychology

| Feeling we want | Feeling we avoid |
|---|---|
| Someone capable is handling marketing | I have software to assemble |
| I know exactly how long this will take | Endless unread surfaces |
| One clear ask, or none | Competing CTAs |
| Continuity and trust | Cold, transactional dashboards |

Tone: professional, calm, confident, helpful. Never technical. Never guilt-inducing.

---

## Information hierarchy

1. Greeting + relationship continuity (real history only)  
2. **This Month's Focus** — what we're working toward (see [`MONTHLY_FOCUS.md`](./MONTHLY_FOCUS.md))  
3. **This Week** — what I handled  
4. **What I noticed** — signals worth knowing  
5. **What I'd recommend next** — one primary recommendation + why + expected benefit  
6. **Marketing Health** — Excellent / Healthy / Needs Attention / At Risk + why (references the monthly focus)  
7. **Next Week** — what I'll be working on  
8. **Time respect** — estimated review minutes or “Nothing to review”  
9. **One primary CTA** (or a calm Magic Moment)

---

## Relationship philosophy

- The briefing is a **meeting**, not a report.  
- Skipped work becomes recommendations later — never shame.  
- Relationship memory uses only real timestamps (e.g. profile created). Never fabricate seasons or outcomes.  
- New customers get gentle first-week language.

---

## Orchestration (engineering)

`lib/head-of-marketing/weeklyBriefing.ts` + `service.ts`:

- **Reads** existing command-center context, health scoring helpers, plan calendar, approvals/publishing/GBP stats, open recommendation counts  
- **Does not** call or rewrite recommendation, analytics, publishing, or planning engines  
- **Does not** invent a fourth decision system  
- **Also builds** the [Head of Marketing Journal](./HEAD_OF_MARKETING_JOURNAL.md) (`briefing.journal`) from the same signals, via `buildHeadOfMarketingJournal` — a narrative companion surfaced through progressive disclosure on this same experience, never a second decision center  
- **Also builds** [Monthly Focus](./MONTHLY_FOCUS.md) (`briefing.monthlyFocus`) from plan themes/goals and the same live signals — shared direction for the month, not a planning engine

Engines remain the single source of truth. The briefing summarizes.

---

## Navigation

No new destination.

Lives inside **Your Head of Marketing** at `/dashboard`.

“More tools” remains progressive disclosure for power paths.

---

## Future management-style integration

Architecture includes `BriefingCadenceSupport`:

- Supported styles: Hands-On, Weekly, Monthly, Trusted  
- Active cadence today: **weekly**  
- Future styles change depth/frequency of the same briefing foundation — not a new product surface  

Do not expose automation settings yet.

---

## Magic Moments

- Everything is under control.  
- Go enjoy your week.  
- I've already started preparing next week.  
- Nothing urgent today.  
- I'll let you know if anything changes.  

---

## Claude review checklist (pre-merge)

- [ ] Presentation/orchestration only  
- [ ] No duplicated business logic  
- [ ] Engines remain single sources of truth  
- [ ] No new customer-facing decision center  
- [ ] Strengthens Head of Marketing relationship (not another dashboard)  

---

## Verification notes

- Cron gate unchanged: `ATTACH_DECLARATIVE_PRODUCTION_CRONS = false`

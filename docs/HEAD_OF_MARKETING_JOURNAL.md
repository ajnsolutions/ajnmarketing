# Project Magic — Head of Marketing Journal

**Status:** Implemented (presentation / orchestration layer)  
**Branch / PR theme:** `project-magic-head-of-marketing-journal`  
**Integrates with:** Your Head of Marketing (`/dashboard`) via progressive disclosure  
**Constraint:** No schedule activation; `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains `false`. No schema or engine changes.

---

## Purpose

The Journal answers one question:

> What has my Head of Marketing been working on?

It is **not** an activity log, audit log, or notification center.

It is the customer’s window into quiet, capable work while they run the business.

Desired feeling:

> My Head of Marketing has been working all week.

---

## Relationship philosophy

- Narrative first — categories stay internal.  
- Reassure; never overwhelm.  
- Quality over quantity (concise day entries).  
- Never fabricate history; reuse real profile/signal history only.  
- Never expose engines, jobs, queues, pipelines, or sync language.  

Voice patterns: I noticed… / I prepared… / I’m monitoring… / I’m learning… / I’ve completed…

---

## Narrative rules

1. Each entry reads like a short update from a trusted Head of Marketing.  
2. Prefer day labels (Monday–Friday) for rhythm, not timestamps.  
3. If little happened: “Everything is running smoothly. I’m continuing to monitor your business.”  
4. Reinforce Marketing Health in plain language when signals support it.  
5. Forbidden customer terms: Tasks, Jobs, Pipelines, Engines, Queues, Synchronization, “Analysis complete.”

---

## Information hierarchy

On Your Head of Marketing:

1. Greeting + **Weekly Briefing** (decision surface — see [`WEEKLY_BRIEFING.md`](./WEEKLY_BRIEFING.md))  
2. **This Month’s Focus** — shared direction (see [`MONTHLY_FOCUS.md`](./MONTHLY_FOCUS.md))  
3. **Journal** — progressive disclosure (“While you were busy”)  
4. More tools — advanced paths  

The Journal supports the Weekly Briefing and reinforces Monthly Focus; it does **not** become another “what should I do next?” center, and it never replaces or duplicates the briefing. One primary CTA remains on the briefing.

---

## Integration with Weekly Briefing

- Journal = mid-week / ongoing presence narrative.  
- Weekly Briefing / HoM check-in = organized decision meeting.  
- Friday-style journal lines can point to the briefing (“I’ve prepared your Weekly Briefing… Estimated review time…”).  
- Both orchestrate the same underlying engines; neither replaces them.

---

## Management styles (foundation)

`JournalDetailSupport` records Hands-On / Weekly / Monthly / Trusted as future detail levels.

Today: `activeDetail: "standard"`.

Later: Hands-On may see more entries; Trusted may see fewer, higher-level summaries — same module, different selection depth.

---

## Future evolution (no redesign required)

Journal candidates can later absorb:

- Quarterly planning notes  
- Annual reviews  
- Competitor memory  
- Seasonality memory  
- Goal tracking  
- Strategic planning  

…as additional narrative candidates sourced from existing systems.

---

## Engineering

| Module | Role |
|---|---|
| `lib/head-of-marketing/journal.ts` | Pure narrative builder from HoM signals |
| `lib/head-of-marketing/journalTypes.ts` | Entry + detail-support types |
| `components/dashboard/head-of-marketing-journal.tsx` | Progressive disclosure UI |
| `lib/head-of-marketing/weeklyBriefing.ts` | Calls `buildHeadOfMarketingJournal` inside `buildWeeklyBriefing` and attaches the result as `HeadOfMarketingBriefing.journal` |

Reuses signals already loaded for the Weekly Briefing (GBP, reviews, publishing stats, plan, recommendations count, Marketing Health). No new engines. `lib/head-of-marketing/briefing.ts` is a compatibility re-export only — `weeklyBriefing.ts` is the single orchestrator both the briefing and the Journal are built from.

---

## Magic Moments

- While you were serving customers…  
- I’ve got everything covered.  
- Go enjoy your weekend.  
- I’m continuing to monitor — I’ll let you know if anything changes.  

---

## Claude review checklist (pre-merge)

- [ ] Presentation/orchestration only  
- [ ] No duplicated business logic  
- [ ] Engines remain single sources of truth  
- [ ] No additional customer decision center  
- [ ] Strengthens Head of Marketing relationship  
- [ ] Management-style detail hook remains easy to extend  

---

## Verification notes

- Cron gate unchanged: `ATTACH_DECLARATIVE_PRODUCTION_CRONS = false`

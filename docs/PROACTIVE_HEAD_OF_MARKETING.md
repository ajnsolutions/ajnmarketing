# Project Magic — Proactive Head of Marketing

**Status:** Implemented (presentation / orchestration layer)  
**Branch / PR theme:** `project-magic-proactive-head-of-marketing`  
**Integrates with:** Your Head of Marketing (`/dashboard`) — Weekly Briefing, Journal, Monthly Focus, Marketing Health  
**Constraint:** No schedule activation; `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains `false`. No schema or engine changes.

---

## Purpose

The Head of Marketing should feel alive — paying attention even when the customer isn’t looking.

Without new backend intelligence, presentation/orchestration turns existing signals into calm, conversational proactive moments.

---

## Design philosophy

Every proactive moment must either:

1. **Celebrate progress**  
2. **Provide reassurance**  
3. **Surface an opportunity**  
4. **Request a meaningful decision**

Do **not**:

- Create fake urgency  
- Generate meaningless notifications  
- Interrupt without purpose  

This is a trusted colleague checking in — not a notification system.

---

## Trust model

Never exaggerate. Never pressure. Never use fear-based messaging.

| Avoid | Prefer |
|---|---|
| URGENT | I'd recommend… |
| CRITICAL | I noticed… |
| WARNING | We're making good progress… |
| Action required | Everything looks healthy… |

Honesty over drama. If nothing needs the customer, say so.

---

## Message hierarchy

Only **one** primary proactive moment is shown above the fold.

Selection priority (highest first):

1. Meaningful decision (connect Google / review this week)  
2. Opportunity (seasonal preparation)  
3. Celebration (Excellent health, review wins, visibility)  
4. Progress (preparing content, working on Monthly Focus)  
5. Reassurance (everything on track)

Additional updates live under progressive disclosure:

- **More updates** (celebrations + calm secondary lines)  
- **Recent Activity** (expanded Journal timeline)  
- Weekly Briefing body  

---

## Activity types

Journal / Recent Activity entries carry an `eventKind`:

| Kind | Customer label |
|---|---|
| progress | Progress |
| completed_work | Completed |
| observation | Observation |
| milestone | Milestone |
| recommendation | Recommendation |
| celebration | Celebration |
| decision_requested | Needs your opinion |

Chronological storytelling remains. Categories stay internal.

---

## Celebration philosophy

Small confidence reinforcements — not gamification.

Examples:

- Marketing Health reached Excellent.  
- We received three new reviews this week.  
- Search visibility improved.  
- This month's focus is on track.  

Cap celebrations. Never invent badges or streaks.

---

## Reassurance philosophy

Many sessions should simply reassure:

- Everything is running smoothly.  
- Nothing needs your attention today.  
- I'll continue monitoring things.  

Those messages are valuable. Silence that feels abandoned is worse than a calm “all clear.”

---

## Orchestration (engineering)

`lib/head-of-marketing/proactive.ts` + `proactiveTypes.ts`:

- **Reads** health, wins, approvals, publishing readiness, seasonal hints, Monthly Focus, primary action  
- **Attaches** as `HeadOfMarketingBriefing.proactive` from `buildWeeklyBriefing`  
- **Does not** call recommendation, analytics, publishing, or planning engines  
- Journal entries gain `eventKind` from the same signal map in `journal.ts`

Engines remain the source of truth.

---

## Claude review checklist (pre-merge)

- [ ] Conversation quality (calm, collaborative)  
- [ ] Message hierarchy (one primary moment)  
- [ ] Trust-building (no fear / fake urgency)  
- [ ] Information architecture (not a notification center)  
- [ ] Consistency with Project Magic  
- [ ] Feels like a Head of Marketing, not software alerts  

---

## Verification notes

- Cron gate unchanged: `ATTACH_DECLARATIVE_PRODUCTION_CRONS = false`

# Project Magic — First Five Minutes

**Status:** Implemented (experience layer only)  
**Branch / PR theme:** `project-magic-first-five-minutes`  
**Constraint:** No schedule activation; `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains `false`. No recommendation-engine, publishing, analytics, Trigger.dev, auth, or schema changes.

---

## Goal

Make the first minutes after signup feel like hiring a Head of Marketing — not configuring software.

The customer should never wonder “What do I do?”

---

## What shipped

### Conversational onboarding (`components/onboarding/onboarding-wizard.tsx`)

One question per screen:

1. Welcome — Head of Marketing framing  
2. Website  
3. Business name (minimal identity for the workspace)  
4. Local vs Online  
5. Google Business Profile — Yes / No / Not Sure  
6. Reassurance when No / Not Sure — never a blocker  
7. Facebook — optional; skip OK  
8. Instagram — optional; skip OK  
9. Progress moments — learning / customers / plan / first week  
10. Completion — “I’m already getting to work” → **Go to Dashboard**

Skipped connections become deferred notes (future recommendations), not blockers.

Audience + deferred socials map into existing `business_profiles` fields (`marketing_goals`, `voice_notes`) — **no migration**.

### First dashboard (`/dashboard` for early customers)

Calm home instead of Command Center overwhelm:

- Time-of-day greeting  
- “I’m getting started…” / “While you were busy…”  
- Setup progress  
- What’s happening next  
- One primary action (Finish Google / Review recommendations / Nothing — everything underway)

### Focused navigation

Until early setup matures (GBP connected and no deferred social skips), sidebar shows a quiet subset: Home, Google, Recommendations, Approvals, Settings.

Full nav remains available after that — no global IA redesign.

---

## Magic Moments added

- “I’m excited to become your Head of Marketing.”  
- “I’m already learning your business.”  
- Progress: Learning / Understanding customers / Preparing plan / Building first week  
- “I’m already getting to work.” / “Go enjoy your day.” / “I’ll let you know when I need you.”  
- First home: “Nothing. Everything is underway.” when no action is needed  

---

## StoryBrand alignment

- Customer is the hero running the business.  
- AJN is the guide (Head of Marketing).  
- Plan is short and clear.  
- Success = marketing underway without anxiety.  
- Avoided AI/tool jargon and system labels in the first path.

---

## Explicit non-goals (this PR)

- Do not redesign every authenticated page  
- Do not change recommendation / publishing / analytics engines  
- Do not activate Trigger.dev schedules  
- Do not change auth or database schema  
- Do not merge or deploy from this workstream alone  

---

## Future follow-on work

| Phase | Follow-on |
|---|---|
| B+ | Deeper “learning” animation tied to real analysis progress (still calm copy) |
| C | Marketing Health badge on first home |
| C | Full nav consolidation (Dashboard / Marketing / Results / Business) |
| D | Weekly approval as the hero loop after first week |
| Later | Real Facebook / Instagram connect flows when product-ready |

---

## Verification notes

- Experience-only changes under onboarding + dashboard shell/home  
- Existing website-analysis kickoff on finish retained (same as prior onboarding)  
- Cron gate unchanged: `ATTACH_DECLARATIVE_PRODUCTION_CRONS = false`

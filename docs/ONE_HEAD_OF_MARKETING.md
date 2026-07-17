# Project Magic — One Head of Marketing

**Status:** Implemented (presentation / orchestration layer)  
**Branch / PR theme:** `project-magic-one-head-of-marketing`  
**Constraint:** No schedule activation; `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains `false`. No engine rewrites.

---

## Philosophy

There is **one** customer-facing answer to:

> What should I do next?

That answer lives on **Your Head of Marketing** (`/dashboard`).

Marketing Plan, Tasks, Recommendations, Command Center, Assisted Pilot, and Analytics remain valuable **systems** — they are no longer competing **decision centers** in the customer UI.

---

## Unified decision layer

`lib/head-of-marketing/` is a presentation/orchestration layer:

| Module | Role |
|---|---|
| `service.ts` | Loads existing command-center context + profile signals |
| `briefing.ts` | Pure builder → one weekly-style briefing |
| `marketingHealth.ts` | Marketing Health v1 (Excellent / Healthy / Needs Attention / At Risk) |
| `types.ts` | Customer-facing model + nav constants |

**Reuses (does not duplicate):**

- Command Center context loader + health scoring helpers  
- Approvals, publishing stats, GBP, plan summary, agent task priorities  
- Open recommendation counts (read-only)  

**Does not call / rewrite:** recommendation engine, planner OpenAI path, analytics engine, publishing mutations, Trigger.dev.

---

## Customer experience

Landing feels like checking in with a Head of Marketing via the **Weekly Briefing** (same `/dashboard` surface — see [`WEEKLY_BRIEFING.md`](./WEEKLY_BRIEFING.md)):

- Greeting + Marketing Health  
- **Proactive presence** — one calm primary moment (+ More updates) — see [`PROACTIVE_HEAD_OF_MARKETING.md`](./PROACTIVE_HEAD_OF_MARKETING.md)  
- **This Month’s Focus** — shared priorities for the month — see [`MONTHLY_FOCUS.md`](./MONTHLY_FOCUS.md)  
- This Week / What I noticed / What I’d recommend / Next Week  
- Estimated review time  
- **One** primary CTA (`Review This Week` or connect Google or calm “nothing needed”)  
- Magic Moments when clear (“Everything is under control”, “Go enjoy your week”)  
- **Recent Activity / Journal** (progressive disclosure): day-by-day narrative with activity kinds — see [`HEAD_OF_MARKETING_JOURNAL.md`](./HEAD_OF_MARKETING_JOURNAL.md)

Early customers still get First Five Minutes setup when Google isn't connected.

---

## Navigation simplification

**Primary nav** (Great Simplification)

- Your Head of Marketing  
- Results  
- Library  
- Settings  

**Progressive disclosure**

- “More tools” reveals This Week, Google Profile, Plan, Tasks, Recommendations, Preparing for publication, Detailed workspace, etc.  
- No functionality removed — only demoted from equal peer status. See [`GREAT_SIMPLIFICATION.md`](./GREAT_SIMPLIFICATION.md).

Customer language examples:

| Old | New |
|---|---|
| Marketing Plan | Here's what I'd like to accomplish this month |
| Recommendation | Here's what I'd recommend next |
| Task | Here's what I'm working on |
| Analytics | Here's what's improving |
| Publishing Queue | Here's what I'm preparing |

---

## Marketing Health v1

Composed from existing scores/signals (GBP connection, pending approvals, unanswered reviews, publish failures, overall score). Calm copy — no guilt language.

---

## Architecture review alignment

Addresses `ARCHITECTURE_REVIEW_2026.md` §3.1 and `ARCHITECTURE_DECISIONS.md` competing “what next” systems by choosing:

- **Authoritative customer surface:** Your Head of Marketing  
- **Data sources:** existing engines (folded in, not retired)  
- **Not created:** a fourth recommendation engine  

---

## Future follow-on

- Deeper Marketing Health inputs (cadence, reputation velocity)  
- Weekly package as default “Review This Week” destination when present  
- Further IA consolidation (Marketing / Results / Business shells)  
- Trust progression UI on the same briefing surface  

---

## Verification notes

- Experience/orchestration only  
- Cron gate unchanged: `ATTACH_DECLARATIVE_PRODUCTION_CRONS = false`

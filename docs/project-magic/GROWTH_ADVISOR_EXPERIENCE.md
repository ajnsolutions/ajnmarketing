# Growth Advisor Experience

**Status:** Shipped (conversational weekly meeting experience)  
**Branch:** `project-magic/growth-advisor-experience`  
**Cron gate:** `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains **false** — untouched

The Growth Advisor is the primary destination after login. The user should feel like they are meeting with an experienced marketing advisor — not using software.

This sprint improves the experience using the **existing** Marketing Director / Head of Marketing / Business Brain architecture. It does **not** redesign the application shell and does **not** re-rank recommendations.

Companion: [`GROWTH_ADVISOR.md`](./GROWTH_ADVISOR.md) · [`BUSINESS_BRAIN.md`](./BUSINESS_BRAIN.md) · [`CUSTOMER_VOICE.md`](./CUSTOMER_VOICE.md) · [`EXTERNAL_INTELLIGENCE.md`](./EXTERNAL_INTELLIGENCE.md) · [`GOALS_AND_STRATEGY.md`](./GOALS_AND_STRATEGY.md)

---

## Conversation flow

Fixed order — never reordered:

```
Greeting
  ↓
This Week
  ↓
What I Noticed (3–5 when evidence allows)
  ↓  (each observation includes Why It Matters + trust certainty)
What I'm Still Learning (only when evidence is thin)
  ↓
Progress toward goals
  ↓
Recommendation (exactly one)
  ↓  Expected Impact (business language)
  ↓  Why I Believe This (progressive disclosure)
Next Week (what I'll monitor)
  ↓
One Action (singular CTA)
  ↓
Supporting context
```

Implemented in `components/dashboard/growth-advisor/growth-advisor-page.tsx`.

---

## Evidence hierarchy

Presentation layers read Business Brain packages — they never re-analyze raw providers:

1. **Weekly Briefing signals** (`HeadOfMarketingBriefing`) — This Week, noticed categories, next-week prep, primary action
2. **Customer Voice** — authentic customer language (Observed / Likely)
3. **Goals & Strategy** — progress and Supports Goal annotation
4. **External Intelligence** — market/seasonal/local context when available
5. **Business Discovery** — profile understanding (Known / Assumed → Observed / Likely)

`buildGrowthAdvisorBriefing` remains a **pure presentation transform**. Marketing Director remains the sole prioritizer of the single recommendation.

---

## Trust model

Every observation and the recommendation carries an honest certainty label:

| Label | Meaning |
|---|---|
| **Observed** | Grounded in real activity or high-confidence evidence |
| **Likely** | Reasonable inference from recurring or multi-source signals |
| **Predicted** | Forward-looking with thinner corroboration — never overstated |
| **Suggested** | Recommended action (always the CTA itself) |

Never expose chain-of-thought. Explainability uses supporting evidence, confidence labels, business impact language, and related goals only.

---

## Briefing generation

`lib/growth-advisor/buildGrowthAdvisorBriefing.ts` plus:

| Module | Role |
|---|---|
| `observations.ts` | 3–5 What I Noticed from Business Brain |
| `expectedImpact.ts` | Business-language outcomes — no fake numbers |
| `nextWeek.ts` | Monitoring expectations |
| `trust.ts` | Observed / Likely / Predicted / Suggested |

Empty / thin-evidence states explain what the advisor is still learning and suggest connections/activity that would improve recommendations — never fabricate insights.

---

## Recommendation philosophy

- Exactly **one** primary recommendation
- One primary CTA ("One action")
- Secondary detail behind progressive disclosure ("Why I believe this")
- Expected impact in business language (e.g. More phone calls, Higher review velocity) — **never fake numbers**
- Customer Voice and goals annotate; they do not re-rank

---

## Explicit non-goals

- No application redesign
- No second recommendation engine
- No schedule activation
- No fabricated metrics or invented market events

---

## Module map

| Path | Role |
|---|---|
| `lib/growth-advisor/buildGrowthAdvisorBriefing.ts` | Presentation transform |
| `lib/growth-advisor/observations.ts` | What I Noticed |
| `lib/growth-advisor/expectedImpact.ts` | Expected impact vocabulary |
| `lib/growth-advisor/nextWeek.ts` | Next week monitoring |
| `lib/growth-advisor/trust.ts` | Trust certainty labels |
| `components/dashboard/growth-advisor/*` | Conversational UI |

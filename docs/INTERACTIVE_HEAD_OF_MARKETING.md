# Interactive Head of Marketing

**Project Magic Phase 2C.** Primary customer conversation surface for explaining existing marketing intelligence.

## Architecture

The Interactive Head of Marketing is a **presentation and explanation layer**.

```
Customer question
    → classify (deterministic)
    → grounded context from existing services
    → answer engine (deterministic copy)
    → Ask panel (session history)
```

It does **not** introduce a second planning or recommendation pipeline.

| Layer | Role |
|---|---|
| Marketing Director | Sole strategic decision-maker |
| Recommendation Engine | Creates/ranks recommendations (unchanged) |
| Executive Brief / Campaigns / Memory / Market Context | Existing evidence sources |
| Interactive HoM | Explains those outputs in conversation |

## Data flow

1. `POST /api/interactive-hom` receives a question (manual, on demand).
2. Service loads the existing Head of Marketing briefing plus Marketing Memory evidence (and light operational counts from command-center context).
3. `buildInteractiveHomContext` assembles customer-safe facts only.
4. `classifyInteractiveHomQuestion` maps the question to a supported category.
5. `answerInteractiveHomQuestion` returns grounded copy—or an honest insufficient-data response.

No background schedules. No Trigger.dev tasks. `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains `false`.

## Supported question types

- What should I work on today?
- Why is this recommended?
- What changed this week?
- How is my campaign doing?
- What have we learned?
- What risks should I know about?
- What opportunities do you see?
- Explain this priority.
- Summarize the Executive Brief
- Why did the plan change? *(Phase 2F — Decision Intelligence)*
- Did this experiment change anything? *(Phase 2F)*
- Which customer preferences affected the plan? *(Phase 2F)*
- What evidence was ignored? *(Phase 2F)*
- Did this campaign affect future decisions? *(Phase 2F)*
- Why was this recommendation deprioritized? *(Phase 2F)*

Suggested prompts ship in the Ask panel for keyboard- and mobile-friendly entry.

The six Phase 2F categories above all read from `ctx.decisionIntelligence`, a `DecisionIntelligenceSummary` computed once by [`DECISION_INTELLIGENCE_AND_LEARNING_IMPACT.md`](./DECISION_INTELLIGENCE_AND_LEARNING_IMPACT.md)'s service and passed into the grounded context — no trace, comparison, or evidence logic is duplicated in `answerEngine.ts`. Like every other category, each answer discloses missing evidence (`insufficientData: true`) rather than guessing when decision history isn't available yet.

## Guardrails

Interactive HoM **may**:

- Answer questions
- Explain recommendations in customer-friendly language
- Summarize campaigns, Executive Briefs, Marketing Memory, Market Context, priorities, trends, and progress

Interactive HoM **may never**:

- Create recommendations independently
- Approve recommendations
- Publish content
- Modify Marketing Memory directly
- Change campaign state directly
- Speculate when evidence is missing
- Expose internal weights, scores, or engine jargon

Answers are deterministic for identical grounded inputs. No new LLM provider path was added for this layer.

## Relationship to Marketing Director

Marketing Director remains the only strategic decision-maker. Interactive HoM reads the already-composed Weekly Briefing / Executive Brief / primary action / recommendation explainability that Director already produced. It never re-ranks candidates and never overrides Director priority.

## Modules

| Path | Purpose |
|---|---|
| `lib/interactive-hom/types.ts` | Categories, context, answer contracts |
| `lib/interactive-hom/classifyQuestion.ts` | Deterministic classification |
| `lib/interactive-hom/answerEngine.ts` | Grounded answer composition |
| `lib/interactive-hom/buildContext.ts` | Context assembly from existing briefing/memory |
| `lib/interactive-hom/answerQuestion.ts` | classify → answer |
| `lib/interactive-hom/prompts.ts` | Suggested prompts |
| `lib/interactive-hom/service.ts` | Authenticated load + ask |
| `app/api/interactive-hom/route.ts` | GET prompts / POST ask |
| `components/dashboard/ask-head-of-marketing.tsx` | Dashboard panel |

## UX

The **Ask Your Head of Marketing** panel on `/dashboard` provides:

- Prompt suggestions
- Current-session conversation history (client-side only)
- Loading / busy states (`aria-live`, `aria-busy`)
- Keyboard-accessible form controls (`hom-focusable`)
- Mobile-friendly stacked layout

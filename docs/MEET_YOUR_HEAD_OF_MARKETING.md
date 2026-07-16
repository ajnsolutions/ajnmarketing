# Project Magic — Meet Your Head of Marketing

**Status:** Implemented (presentation layer only)  
**Branch / PR theme:** `project-magic-meet-your-head-of-marketing`  
**Builds on:** First Five Minutes + One Head of Marketing  
**Constraint:** No schedule activation; `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains `false`. No schema or engine changes.

---

## Conversation philosophy

Onboarding is not software configuration.

It is the customer **introducing their business** to a new Head of Marketing.

Every screen answers:

> Why does my Head of Marketing need to know this?

Never:

> Fill out this form.

Tone: professional, friendly, confident, calm — never robotic, overly casual, or technical.

---

## Conversation flow

One question at a time:

1. Welcome — excited to become your Head of Marketing  
2. Website — how I start learning  
3. Business name — how I should refer to you  
4. Local vs Online — how growth priorities differ  
5. Where customers come from — local / regional / national  
6. Google Business Profile — Yes / No / Not Sure  
7. Reassurance when No / Not Sure  
8. Facebook / Instagram / LinkedIn — skip always available  
9. Learning-language progress (tailored by local vs online)  
10. Completion → **Meet Your Head of Marketing**

Skipped connections become deferred recommendations in existing `voice_notes` — never blockers.

Audience + customer origin encode into existing `marketing_goals` markers — **no migration**.

---

## Progressive setup

Nothing beyond a short introduction is required on day one.

Skip language:

> I'd recommend we connect this later.

Customers reach the Head of Marketing briefing quickly.

---

## Customer introduction (tailoring)

| Local | Online |
|---|---|
| Google, reviews, community | Website, content, authority |
| Nearby customers / service area | Discovery & thought leadership |

Progress copy and GBP/LinkedIn “why” copy adapt lightly. Engines are reused, not duplicated.

---

## Magic Moments

- “I've already started learning about your business.”  
- Learning / customers / community or discovery / strategy / first week  
- “I already have enough to get started.”  
- “I'll take it from here.” / “I'll let you know when I need you.” / “Go enjoy your day.”  

---

## Trust introduction

Quiet plant on completion (no automation settings exposed):

> As I learn your business, you'll be able to give me more responsibility.

---

## Navigation

Onboarding remains a focused path (logo only). Post-onboarding uses the One Head of Marketing primary nav with progressive disclosure.

---

## Future follow-on

- Deeper local/online playbooks on the HoM briefing  
- Real social connect flows when product-ready  
- Trust stage UI when Trust Model ships  

---

## Verification notes

- Presentation/orchestration only over existing save/load + website-analysis kickoff  
- Cron gate unchanged: `ATTACH_DECLARATIVE_PRODUCTION_CRONS = false`

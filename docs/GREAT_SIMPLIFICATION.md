# Project Magic — The Great Simplification

**Status:** Implemented (presentation layer only)  
**Branch / PR theme:** `project-magic-great-simplification`  
**Constraint:** No schedule activation; `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains `false`. No schema, Trigger.dev, recommendation, publishing, or analytics engine changes.

---

## Purpose

This is not a feature sprint and not a redesign.

It is a **simplification sprint**: reduce visible complexity by at least ~30% while preserving 100% of functionality.

Guiding question for every change:

> Does this make the customer feel more like they're working with a trusted Head of Marketing, or more like they're operating software?

If the answer is “software,” simplify again.

---

## Simplification philosophy

Every visible element must justify its existence.

- Prefer **contextual** actions (HoM primary CTA) over permanent nav peers.  
- Prefer **progressive disclosure** over equal peer destinations.  
- Prefer **one primary action** per page.  
- Prefer **customer language** over implementation language.  
- Demote, don’t delete — routes and engines remain.

---

## Navigation reductions

### Before (One Head of Marketing)

**Primary (4):** Your Head of Marketing · This Week · Google Profile · Business Settings  

**More tools (~12):** Detailed workspace, tasks, publishing, plan, recommendations, analytics, content, reviews, website analysis, brand voice, notifications, billing

### After (Great Simplification)

**Primary (4):**

| Nav item | Destination | Job |
|---|---|---|
| Your Head of Marketing | `/dashboard` | What next? Weekly Briefing + Monthly Focus |
| Results | `/dashboard/results` | What's improving — outcomes, not raw analytics |
| Library | `/dashboard/library` | Everything we've created together |
| Settings | `/dashboard/settings` | Configuration hub (separate from the relationship) |

**Removed from primary (now contextual / More tools):**

- This Week → advanced + HoM CTA “Review This Week”  
- Google Profile → advanced + Settings hub  

**Removed from More tools (promoted or folded):**

- What’s improving / Analytics → primary **Results**  
- Content → primary **Library**  
- Notifications + Billing → Settings hub (still reachable; not equal peers in More)

**Net customer decisions eliminated from the shell:** ~4 fewer primary/peer choices competing with the Weekly Briefing (This Week + Google no longer peer to HoM; Analytics + Content no longer advanced peers once promoted into clearer destinations).

---

## Pages consolidated

| Before | After | Notes |
|---|---|---|
| `/dashboard/analytics` | `/dashboard/results` | Canonical Results; analytics route redirects |
| `/dashboard/content` | `/dashboard/library` | Canonical Library; content route redirects |
| Settings placeholder | Settings hub | Links to Google, brand voice, website understanding, notifications, billing |

Functionality preserved: same data loaders and components; presentation aliases only.

---

## Progressive disclosure strategy

1. **Weekly review** arrives from HoM primary CTA — not a permanent nav peer.  
2. **Detailed workspace** (former Command Center) stays under More tools; quick actions collapsed under “Advanced actions”.  
3. **Technical publishing / recommendation / task** surfaces remain available under More tools with customer labels.  
4. **Early customers** still get focused primary nav (four destinations) until setup matures.  
5. Advanced analytics detail remains on Results; raw engine language is demoted.

---

## Primary action philosophy

Every customer-facing page should have **one** obvious primary action.

Examples applied:

| Page | Primary | Secondary |
|---|---|---|
| Your Head of Marketing | Review This Week / Connect Google / calm Magic Moment | More tools disclosure |
| This Week (approvals) | Review This Week | Preview email delivery (text link) |
| Library | Create something new | Review This Week (text link) |
| Preparing for publication | Open Library | Review This Week (text link) |
| Results | Refresh results | — |
| Settings | (hub links — no competing CTA) | Pointer back to HoM |

Avoid equal peer CTA pairs (former Approval Center + Content Hub pattern).

---

## Language shifts (customer-facing)

| Before | After |
|---|---|
| Approval Center | This Week / Review This Week |
| Analytics Intelligence | Results / What's improving |
| Content Hub | Library |
| Publishing Queue | Preparing for publication |
| Marketing Recommendations | What I'd recommend |
| Today's Marketing Tasks | What I'm working on |
| AI Marketing Command Center | Detailed workspace |
| Business Settings (empty) | Settings (configuration hub) |

---

## Results

Results is the customer destination for **outcomes**:

- Visibility  
- Reviews  
- Engagement  
- Progress over time  
- Plain-English “how things look”

Not a raw analytics console. Same underlying analytics data; presentation reframed.

---

## Library

Library is **everything we've created together** — content, posts, assets — without technical organization as the lead story.

---

## Settings

Settings must never interrupt the Head of Marketing relationship. It is a configuration hub only.

---

## Future simplification opportunities

- Fold Reviews outcomes into Results more deeply.  
- Nest generator under Library as a single create flow.  
- Further reduce KPI card density on advanced pages.  
- Management-style depth (Hands-On → Trusted) controlling how much More tools shows.  
- Retire remaining software phrases in generator / GBP copy when those surfaces are next touched.  
- Admin-only for website analysis internals when admin console expands.

---

## Engineering confirmations

- Presentation layer only  
- No backend / schema / Trigger.dev / recommendation / publishing / analytics behavior changes  
- `ATTACH_DECLARATIVE_PRODUCTION_CRONS = false`  
- No schedules activated  

---

## Claude review checklist

- [ ] Navigation consistency  
- [ ] Information architecture  
- [ ] Progressive disclosure  
- [ ] Visual hierarchy  
- [ ] Duplicate customer journeys reduced  
- [ ] Remaining customer friction called out  
- [ ] Feels like Head of Marketing, not software  

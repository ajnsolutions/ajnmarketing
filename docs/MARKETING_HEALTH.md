# Marketing Health

**Companion to:** [`DASHBOARD_PHILOSOPHY.md`](./DASHBOARD_PHILOSOPHY.md) · [`MAGIC_BLUEPRINT.md`](./MAGIC_BLUEPRINT.md)

Marketing Health replaces “stare at charts” as the primary results language for customers.

---

## 1. Customer-facing states

| State | Owner should feel | Primary message pattern |
|---|---|---|
| **Excellent** | Pride / calm | “Your marketing is in great shape.” |
| **Healthy** | Confidence | “Things look solid — here’s what I’m doing next.” |
| **Needs Attention** | Focused, not panicked | “One or two items need you (or me) this week.” |
| **At Risk** | Clear urgency without shame | “Visibility or reputation needs action now — here’s the plan.” |

Never lead with letter grades, arbitrary percentages, or vanity SEO scores as the hero metric.

---

## 2. Inputs (conceptual)

Health is a **composed signal**, not a single vanity number. Inputs should be explainable in plain English.

| Domain | Example inputs (product-true) | Customer translation |
|---|---|---|
| Presence | GBP connection health, profile completeness, posting freshness | “Can customers find accurate info about you?” |
| Reputation | Review velocity, reply latency, sentiment flags | “Are you earning and keeping trust?” |
| Consistency | Content cadence vs plan, approval backlog age | “Are we showing up regularly?” |
| Responsiveness | Owner approval lag vs management style | “Are decisions keeping work moving?” |
| Learning | Outcome feedback availability *(internal)* | Not shown raw; informs recommendations |
| Risk | Failed jobs, revoked OAuth, publish failures | “Something needs a fix” |

Admin may see deeper diagnostics; customers see state + why + next step.

---

## 3. Messaging rules

- **One primary reason** for the current state (optional 2 supporting bullets).  
- **One primary action** (approve, reconnect Google, review reply, etc.).  
- Prefer “we’ll handle X” over “you must configure Y” when the platform can act.  
- At Risk copy must include **what AJN is doing** and **what only the owner can do**.

### Example copy

- Excellent: “Reputation and visibility look strong. I’ll keep the weekly rhythm going.”  
- Healthy: “You’re in good shape. This week I’m focused on [plain action].”  
- Needs Attention: “Two review replies are waiting — approve when you have a minute.”  
- At Risk: “Google disconnected. Reconnect so I can keep your profile updated.”

---

## 4. Visual presentation

- Single health badge/pill on Dashboard home (not a wall of gauges).  
- Color: calm green (Excellent/Healthy), amber (Needs Attention), restrained red (At Risk).  
- Avoid alarmist animation.  
- Expandable “Why this status” — progressive disclosure.  
- Do not show internal engine names (opportunity detectors, decision engine, etc.).

---

## 5. Recommended actions by state

| State | Typical next steps |
|---|---|
| Excellent | Continue; optional celebrate win; light upsell to trust stage only if earned |
| Healthy | Review weekly package; no busywork |
| Needs Attention | Complete 1–3 approvals; fix one completeness gap |
| At Risk | Reconnect integration; resolve failed publish; reply to critical review |

---

## 6. Relationship to analytics

Analytics remain available for deeper curiosity and admin ops.

**Rule:** Analytics never outrank Marketing Health on the primary Results experience.

Celebrate business outcomes (calls, direction requests, reputation stability, visibility narrative) — not “we posted 8 times.”

---

## 7. Implementation notes (future)

- Start with rule-based composition from existing signals (GBP status, approval backlog, review reply queue, job failures).  
- Add learning/outcome inputs as feedback loops mature.  
- Keep scoring internal; expose states + explanations only.  
- Unit-test translation: raw signals → state → customer copy.

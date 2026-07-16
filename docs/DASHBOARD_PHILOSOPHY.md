# Dashboard Philosophy

**Companion to:** [`MARKETING_HEALTH.md`](./MARKETING_HEALTH.md) · [`NAVIGATION_PHILOSOPHY.md`](./NAVIGATION_PHILOSOPHY.md) · [`VOICE_AND_PERSONALITY.md`](./VOICE_AND_PERSONALITY.md)

---

## 1. The dashboard’s only job

Answer four questions, in this order:

1. **How is my business doing?** → Marketing Health  
2. **What needs my attention?** → One clear list (ideally ≤3)  
3. **What has AJN Marketing done?** → “While you were busy…”  
4. **What should I know?** → Calm notices (seasonal, guarantee, trust)

Everything else is secondary and must not compete for first-screen attention.

---

## 2. Conceptual layout

```
┌─────────────────────────────────────────────┐
│ Greeting (voice) + Marketing Health         │
├─────────────────────────────────────────────┤
│ Needs your attention (primary actions)      │
├─────────────────────────────────────────────┤
│ What I handled / prepared recently          │
├─────────────────────────────────────────────┤
│ Worth knowing (optional, collapsed-friendly)│
└─────────────────────────────────────────────┘
```

Mobile: same order, stacked. No dense scoreboard above the fold.

---

## 3. Attention rules

- If nothing needs the owner: celebrate with **“Everything looks great.”**  
- If something needs the owner: **one primary CTA** per item.  
- Never show raw job tables, engine statuses, or internal IDs on the customer home.  
- Background job health belongs in admin or progressive disclosure (“Details”).

---

## 4. Relationship to today’s Command Center

Command Center aggregates useful signals but currently reads like an internal ops wall (priorities, scores, jobs).

**Magic target:** keep the *data*, change the *story* — Health + attention + done-for-you narrative.

New customers get a getting-started path; established customers get the calm weekly home.

---

## 5. Design principles (dashboard-specific)

1. One primary action above the fold when attention items exist.  
2. Progressive disclosure for power details.  
3. No fake social proof or fake metrics.  
4. Empty states that reduce anxiety.  
5. Copy passes the Voice checklist.  
6. Align with management style (Hands-On sees more items; Trusted HoM sees exceptions).

---

## 6. Success criteria for a future dashboard PR

- Owner can answer the four questions in under 15 seconds.  
- No requirement to understand “opportunities,” “decision engine,” or “command center.”  
- Pilot owners report lower anxiety vs current first login.  
- Admin diagnostics remain available separately.

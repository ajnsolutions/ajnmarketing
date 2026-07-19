# Project Magic — Implementation Roadmap

**Companion to:** [`MAGIC_BLUEPRINT.md`](./MAGIC_BLUEPRINT.md)  
**Constraint:** No schedule activation; `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains false until explicit ops approval. No silent auto-publish.

---

## Phase overview

| Phase | Focus | Depends on |
|---|---|---|
| **A** | Public experience | Manifesto + voice |
| **B** | Onboarding | A messaging |
| **C** | Customer dashboard | Health model, nav philosophy |
| **D** | Marketing workflow | C, trust/styles (light) |
| **E** | Results & Marketing Health | C |
| **F** | Admin operating console | Ops needs |
| **G** | Trust progression | D + E data |
| **H** | Autonomous Head of Marketing | G + strict gates |

---

## Phase A — Public experience

- **Scope:** Head-of-Marketing positioning across public site; demo as proof; confidence/simplicity/guarantee; StoryBrand alignment; local + online messaging; factual AI-search education without ranking claims.  
- **Dependencies:** Voice doc; existing homepage/demo foundations.  
- **Risk:** Overclaiming; drifting into AI-tool marketing.  
- **Acceptance:** Five-second clarity; demo → signup path obvious; no fabricated proof; Privacy/Terms linked when pages exist.

---

## Phase B — Onboarding

- **Scope:** Emotion-first onboarding (“I’m learning…”); minimal steps to first value; GBP connect clarity; end with “I’ll take it from here.”  
- **Dependencies:** A copy patterns.  
- **Risk:** Still too many fields; dead ends.  
- **Acceptance:** New owner reaches first meaningful insight/approval path without support call.  
- **Shipped (First Five Minutes):** Conversational one-question flow, progress magic moments, completion CTA, early-customer focused nav + calm `/dashboard` home. See [`FIRST_FIVE_MINUTES.md`](./FIRST_FIVE_MINUTES.md).  
- **Shipped (Meet Your Head of Marketing):** Introduction framing (“why I need to know this”), customer origin + LinkedIn skip path, learning-language progress by local/online, trust seed, CTA to HoM briefing. See [`MEET_YOUR_HEAD_OF_MARKETING.md`](./MEET_YOUR_HEAD_OF_MARKETING.md).

---

## Phase C — Customer dashboard

- **Scope:** Recompose home around Health + attention + done summary; begin nav consolidation toward Dashboard/Marketing/Results/Business.  
- **Dependencies:** Marketing Health v1 rules; nav philosophy.  
- **Risk:** Big-bang redesign; losing power users.  
- **Acceptance:** Four questions answerable in 15 seconds; no placeholder peers in primary nav without honesty.  
- **Shipped (One Head of Marketing):** `/dashboard` is the single “what next?” briefing; Marketing Health v1; primary nav simplified with progressive disclosure for former decision centers. See [`ONE_HEAD_OF_MARKETING.md`](./ONE_HEAD_OF_MARKETING.md).  
- **Shipped (Weekly Briefing):** Structured weekly conversation on the same HoM surface (This Week → Noticed → Recommend → Health → Next Week); cadence hook for future management styles. See [`WEEKLY_BRIEFING.md`](./WEEKLY_BRIEFING.md).  
- **Shipped (Head of Marketing Journal):** Narrative “While you were busy” journal nested inside the Weekly Briefing via progressive disclosure (orchestration only). See [`HEAD_OF_MARKETING_JOURNAL.md`](./HEAD_OF_MARKETING_JOURNAL.md).  
- **Shipped (Executive Briefing Engine — Morning Brief):** Structured under-one-minute executive summary on the HoM dashboard; priorities explained from Marketing Director only (no new recommendation logic). Weekly/Monthly brief types built but not surfaced. See [`EXECUTIVE_BRIEFING_ENGINE.md`](./EXECUTIVE_BRIEFING_ENGINE.md).  
- **Shipped (Campaign Intelligence Engine — Phase 2B):** Multi-step campaign execution plans initiated only via Marketing Director; declarative templates reuse existing recommendation action types; HoM Campaigns section with timeline/metrics; completion records Marketing Memory observations (not learnings). See [`CAMPAIGN_INTELLIGENCE_ENGINE.md`](./CAMPAIGN_INTELLIGENCE_ENGINE.md).  
- **Shipped (Interactive Head of Marketing — Phase 2C):** Ask Your Head of Marketing panel — grounded, deterministic Q&A over Marketing Director / Executive Brief / Campaigns / Memory / Market Context; presentation only (no new recommendation engine, no autonomous actions). See [`INTERACTIVE_HEAD_OF_MARKETING.md`](./INTERACTIVE_HEAD_OF_MARKETING.md).  
- **Shipped (Strategic Marketing Calendar — Phase 2D):** Read-only day/week/month aggregation of existing priorities, campaigns, publishing, approvals, and market context; HoM preview + dedicated calendar page; no second planner or writable calendar table. See [`STRATEGIC_MARKETING_CALENDAR.md`](./STRATEGIC_MARKETING_CALENDAR.md).  




- **Shipped (Monthly Focus):** Living “This Month’s Focus” on the same HoM surface — presentation over existing plan themes/goals and signals; horizon hook for future Quarterly/Annual. See [`MONTHLY_FOCUS.md`](./MONTHLY_FOCUS.md).  
- **Shipped (Great Simplification):** Primary nav → Your Head of Marketing / Results / Library / Settings; analytics→Results and content→Library presentation aliases; Settings hub; customer language + one-primary-CTA pass. See [`GREAT_SIMPLIFICATION.md`](./GREAT_SIMPLIFICATION.md).  
- **Shipped (Proactive Head of Marketing):** Lightweight proactive presence + Journal activity event kinds + celebrations/reassurance under progressive disclosure (orchestration only). See [`PROACTIVE_HEAD_OF_MARKETING.md`](./PROACTIVE_HEAD_OF_MARKETING.md).  
- **Shipped (Product Readiness):** Copy/a11y/loading/motion polish across primary customer destinations; walkthrough fixes; presentation only. See [`PRODUCT_READINESS.md`](./PRODUCT_READINESS.md).  
- **Shipped (Marketing Director Intelligence — Foundation):** Architecture review (see [`MARKETING_DIRECTOR_ARCHITECTURE.md`](./MARKETING_DIRECTOR_ARCHITECTURE.md)) followed by a shared decision composition layer (`lib/marketing-director/`) that both `buildPrimaryAction` and the proactive presence's primary moment now consume — consolidates duplicate decision authority without adding a new engine. See [`MARKETING_DIRECTOR_FOUNDATION.md`](./MARKETING_DIRECTOR_FOUNDATION.md).

---

## Phase D — Marketing workflow

- **Scope:** Make weekly approval the hero loop; clearer Marketing area; reduce Content/Approvals/Publishing confusion; keep explicit approve → queue → publish.  
- **Dependencies:** C shell.  
- **Risk:** Breaking approval safety.  
- **Acceptance:** Owner completes weekly review in minutes; zero accidental publishes.

---

## Phase E — Results & Marketing Health

- **Scope:** Ship Marketing Health states + explanations; demote raw analytics; celebrate outcomes.  
- **Dependencies:** Signal availability (GBP, approvals, reviews, failures).  
- **Risk:** Arbitrary scoring distrust.  
- **Acceptance:** State always has plain-English why + next step; no letter-grade hero UI.

---

## Phase F — Admin operating console

- **Scope:** Expand allowlisted admin beyond seed ops page: customer health, AI health, pilot, operations, support tools — still separate from customer nav.  
- **Dependencies:** Auth allowlist patterns.  
- **Risk:** Leaking admin links to customers.  
- **Acceptance:** Non-admin sees zero admin chrome; admins can operate pilot without DB console.

---

## Phase G — Trust progression

- **Scope:** Productize stages + management styles; visible promotion/demotion; magic moment copy; still bounded by safety.  
- **Dependencies:** Approval history metrics; D/E.  
- **Risk:** Premature autonomy.  
- **Acceptance:** Style changes never bypass publish gates; promotions are earned and reversible.

---

## Phase H — Autonomous Head of Marketing

- **Scope:** Highest-autonomy behaviors for Trusted HoM / future Executive Partner — only with explicit style, trust stage, and ops-approved schedule/publish policies.  
- **Dependencies:** G + production readiness + schedule activation decision.  
- **Risk:** Highest — trust destruction if wrong.  
- **Acceptance:** Written policy; kill switch; auditability; cron gate flipped only with explicit approval; no silent expansion of publish scope.

---

## Cross-cutting design rules (all phases)

From the manifesto — enforced in review:

- Never expose internal systems as customer IA.  
- Never require unnecessary decisions.  
- Every screen has one primary action.  
- Every page answers “What should I do next?”  
- Every interaction should reduce anxiety.  
- Every feature should feel like the Head of Marketing is working behind the scenes.  
- Magical without pretending magic.

---

## Suggested sequencing for near-term engineering

1. Keep shipping Phase A polish on public + demo (already partially landed).  
2. Phase B onboarding calm pass — **First Five Minutes landed** (see [`FIRST_FIVE_MINUTES.md`](./FIRST_FIVE_MINUTES.md)).  
3. Phase C/E thin slice: Health badge + attention list on home (before full nav rewrite).  
4. Phase D workflow clarity.  
5. Phase F admin as needed for pilot scale.  
6. Phase G/H only after trust metrics exist and ops signs off.

---

## Out of scope for this blueprint PR

- Implementing UI/IA changes  
- Activating Trigger.dev schedules  
- Changing approval or publishing semantics  
- Multi-business agency console (noted as future)

---

## Marketing Memory (cross-cutting, feeds Phase D/E/H)

A durable evidence layer — observations, learnings, customer preferences, decisions, outcomes — sitting beneath the Marketing Director (§8 of [`MARKETING_DIRECTOR_ARCHITECTURE.md`](./MARKETING_DIRECTOR_ARCHITECTURE.md)) so recommendations can eventually cite real history instead of only current-cycle signals. Reviewed and designed in [`MARKETING_MEMORY_ARCHITECTURE.md`](./MARKETING_MEMORY_ARCHITECTURE.md) and [`MARKETING_MEMORY_DATA_MODEL.md`](./MARKETING_MEMORY_DATA_MODEL.md); its own 6-phase plan (observation foundation → learnings/confidence → preferences/overrides → Marketing Director consumption → customer-facing explainability → seasonal/community expansion) runs independently of A–H above and does not block or reorder them. **Phases 1–4 (through Marketing Director consumption) are implemented** — see [`MARKETING_MEMORY_FOUNDATION.md`](./MARKETING_MEMORY_FOUNDATION.md), [`MARKETING_MEMORY_LEARNINGS.md`](./MARKETING_MEMORY_LEARNINGS.md), [`MARKETING_MEMORY_PREFERENCES.md`](./MARKETING_MEMORY_PREFERENCES.md), and [`MARKETING_DIRECTOR_MEMORY_INTEGRATION.md`](./MARKETING_DIRECTOR_MEMORY_INTEGRATION.md). Marketing Director remains the sole decision-maker; Phases 5–6 (explainability UI expansion / seasonal community) remain future work.

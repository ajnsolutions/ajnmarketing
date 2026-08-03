# Current Status

> Machine-readable twin: [`STATUS.json`](./STATUS.json). If the two ever disagree, `STATUS.json` is stale and needs a fix — this file and that one must be updated together.

**Project name:** AJN Marketing ("Project Magic")

**Current product mission:** Make AJN Marketing feel like a small business hired the best Head of Marketing it could ever have — not like it bought another marketing tool. The product is evolving from an AI marketing platform into a broader "AI Growth Engine" for small businesses (Project Magic 2.0), with marketing as the first application of that intelligence.

**Current development phase:** Project Magic 2.0 (AI Growth Engine). Of the four planned waves in `docs/project-magic/IMPLEMENTATION_ROADMAP.md`:
- **Wave I** (Free Marketing Snapshot + Business Brain foundation) — shipped: public pre-auth Snapshot, secure SSRF-hardened backend contract, DNS-pinned continuation bridge, First Impression customer-facing UI, internal-alpha intelligence pass.
- **Wave II** (Connector Framework + Smart Uploads) — shipped: Business Connections foundation, Smart Uploads (PDF/DOCX/TXT/MD), Google Search Console as the first live Website & Search connector.
- **Wave III** (Customer Voice, Market Radar, Seasonal Intelligence) — partially shipped: Goals & Strategy shipped, Customer Voice Phase 1 + 2 shipped (Google Reviews + Website Testimonials providers). Market Radar: owner-managed persistence foundation shipped (`lib/market-radar/`, migration `037_market_radar.sql`, PR #101), and the owner-facing view also shipped (`/dashboard/market-radar`, branch `ai-queue/002-market-radar-view`) — add/remove tracked competitors and benchmarks, reachable via "More tools". The monitoring/detection layer is now **queued** as Tasks 003–005 (not yet built — see "Current active initiative" below); Marketing Director recommendation-evidence integration remains unscoped future work. Seasonal Intelligence is **not yet started**.
- **Wave IV** (Business Pulse + Autopilot) — not started as originally scoped, but several features that read like an organic continuation of it have shipped outside the formal wave numbering (see below).

The 1.0 roadmap (`docs/IMPLEMENTATION_ROADMAP.md`, Phases A–H) runs in parallel and still governs marketing-specific delivery: Phases A–C are largely shipped; **Phases D, E, F, G, H remain scope-only, not shipped.**

**Major completed systems:**
- Authenticated marketing loop: Marketing Director orchestration, recommendations, campaigns, experiments, decision intelligence, strategic calendar, marketing memory (4-layer model), guided onboarding, Assisted Pilot — collectively validated through Release Candidate 1.
- Business Brain intelligence layer (shipped, but **not named in the 2.0 wave roadmap document** — see Open Items): Business Knowledge Graph, Business Learning Engine, Business Brain Inspector, External Intelligence foundation, Business Connections, Opportunity Detection Engine.
- Growth Advisor experience (replaces the previous `/dashboard` composition) and Autonomous Growth Planner (recommend-only, no auto-execution).
- Head of Marketing Orchestrator — the newest merge (PR #96): a daily Executive Review composing Weekly Growth Plan + Executive Brief + Opportunity Engine into one view, at `/dashboard/executive-review` (customer) and `/dashboard/admin/executive-overview` (admin).
- Publishing pipeline with atomic job claiming (background_jobs table + Trigger.dev, two systems not yet merged — see `DECISIONS.md`).

**Current active initiative:** Queue planning — Tasks 003, 004, 005 added to `.ai/queue/RUN_QUEUE.yaml` (branch `prepare-market-radar-intelligence-tasks`, based on `main` @ merge of PR #105). Tasks 001 and 002 (Market Radar persistence + owner-facing view) have both since completed for real, end to end, unattended (PRs #101 and #104, merged), confirming the queue infrastructure works. This branch is **planning only** — it does not implement any of the three tasks, does not create their feature branches, and does not open PRs for them; it defines them so the overnight runner can execute them later. The three tasks build Market Radar's monitoring/detection layer, which 001/002 explicitly deferred:
- **003 — Competitor Observation Engine** (depends on 001 only): evidence model, confidence scoring, persistence — no UI. Cross-references owner-tracked Market Radar entries against the existing `lib/market-context/providers/competitorProvider.ts` signal (the only real signal source in this repo; no new external API, no scraping, no new secret).
- **004 — Business Pulse Integration** (depends on 003): a new `/dashboard/business-pulse` page — verified observations, "What Changed" section, evidence links, confidence filtering. A deliberately narrow first slice of `docs/project-magic/BUSINESS_PULSE.md`'s larger vision, not the full Marketing Health + Growth Momentum composition (still gated behind Wave IV).
- **005 — Weekly Executive Brief: Market Radar section** (depends on 003, sibling of 004 — not stacked on it): extends the existing `lib/executive-briefing/` engine's `weekly_strategy_brief` with a new section (observation, why it matters, suggested action) sourced from 003's confirmed observations.

Full prompts: `.ai/queue/prompts/003-competitor-observation-engine.md` through `005-weekly-executive-brief.md`. `npm run ai:queue:validate` passes against the updated `RUN_QUEUE.yaml`.

**Known safety gates (must not be silently changed by any agent):**
- `ATTACH_DECLARATIVE_PRODUCTION_CRONS` — the Trigger.dev production-schedule activation gate. **Must remain `false`.** Canonical source: `lib/trigger/scheduleActivation.ts`. Referenced/enforced across ~10+ tests, most `docs/` files, and this repo's own `RUNBOOKS.md` (which treats an accidentally-`true` gate as a severe production-safety incident).
- No automatic merges, no automatic deploys, no automatic production migrations, no automatic secret changes — enforced by process (`AGENTS.md`) and by the queue's `safety:` block (`.ai/queue/RUN_QUEUE.yaml`), not by any code-level lock.

**Current blockers:** see `STATUS.json.current_blockers` and `OPEN_ITEMS.md` (security gap, architecture decision debt, production launch blockers, missing recommendation-engine trigger).

**Recommended next step:** Review and merge this branch's PR (adds Tasks 003–005 to the queue definition only — no feature code). Once merged, `npm run ai:queue` (attended, for the first run of a genuinely multi-task sprint) will pick up Task 003 next. Separately: resolve the three-competing-"what should this business do"-systems architecture question (`docs/ARCHITECTURE_REVIEW_2026.md`) before adding further recommendation/decision surface area, and patch the spoofable `x-forwarded-for` rate-limit key on the public interactive-demo endpoint (§3.9 of that same review) — it is an active, unbounded-cost-abuse security gap, not a hypothetical one.

**Date last verified:** 2026-08-03

**Branch/commit used for verification:** `prepare-market-radar-intelligence-tasks`, based on `main` @ `7177304` (merge of PR #105, TypeScript baseline-determinism fix, which already contains PR #101/#104/Tasks 001/002).

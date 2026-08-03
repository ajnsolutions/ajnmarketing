# Current Status

> Machine-readable twin: [`STATUS.json`](./STATUS.json). If the two ever disagree, `STATUS.json` is stale and needs a fix — this file and that one must be updated together.

**Project name:** AJN Marketing ("Project Magic")

**Current product mission:** Make AJN Marketing feel like a small business hired the best Head of Marketing it could ever have — not like it bought another marketing tool. The product is evolving from an AI marketing platform into a broader "AI Growth Engine" for small businesses (Project Magic 2.0), with marketing as the first application of that intelligence.

**Current development phase:** Project Magic 2.0 (AI Growth Engine). Of the four planned waves in `docs/project-magic/IMPLEMENTATION_ROADMAP.md`:
- **Wave I** (Free Marketing Snapshot + Business Brain foundation) — shipped: public pre-auth Snapshot, secure SSRF-hardened backend contract, DNS-pinned continuation bridge, First Impression customer-facing UI, internal-alpha intelligence pass.
- **Wave II** (Connector Framework + Smart Uploads) — shipped: Business Connections foundation, Smart Uploads (PDF/DOCX/TXT/MD), Google Search Console as the first live Website & Search connector.
- **Wave III** (Customer Voice, Market Radar, Seasonal Intelligence) — partially shipped: Goals & Strategy shipped, Customer Voice Phase 1 + 2 shipped (Google Reviews + Website Testimonials providers). Market Radar: owner-managed persistence foundation shipped (`lib/market-radar/`, migration `037_market_radar.sql`, PR #101), and the owner-facing view now also shipped (`/dashboard/market-radar`, branch `ai-queue/002-market-radar-view`) — add/remove tracked competitors and benchmarks, reachable via "More tools". The monitoring/detection layer (and its downstream surfacing into Weekly Briefing / Marketing Director / Business Pulse) remains unbuilt and unscoped. Seasonal Intelligence is **not yet started**.
- **Wave IV** (Business Pulse + Autopilot) — not started as originally scoped, but several features that read like an organic continuation of it have shipped outside the formal wave numbering (see below).

The 1.0 roadmap (`docs/IMPLEMENTATION_ROADMAP.md`, Phases A–H) runs in parallel and still governs marketing-specific delivery: Phases A–C are largely shipped; **Phases D, E, F, G, H remain scope-only, not shipped.**

**Major completed systems:**
- Authenticated marketing loop: Marketing Director orchestration, recommendations, campaigns, experiments, decision intelligence, strategic calendar, marketing memory (4-layer model), guided onboarding, Assisted Pilot — collectively validated through Release Candidate 1.
- Business Brain intelligence layer (shipped, but **not named in the 2.0 wave roadmap document** — see Open Items): Business Knowledge Graph, Business Learning Engine, Business Brain Inspector, External Intelligence foundation, Business Connections, Opportunity Detection Engine.
- Growth Advisor experience (replaces the previous `/dashboard` composition) and Autonomous Growth Planner (recommend-only, no auto-execution).
- Head of Marketing Orchestrator — the newest merge (PR #96): a daily Executive Review composing Weekly Growth Plan + Executive Brief + Opportunity Engine into one view, at `/dashboard/executive-review` (customer) and `/dashboard/admin/executive-overview` (admin).
- Publishing pipeline with atomic job claiming (background_jobs table + Trigger.dev, two systems not yet merged — see `DECISIONS.md`).

**Current active initiative:** Task 002 — Market Radar owner-facing view (branch `ai-queue/002-market-radar-view`, depends on Task 001, PR #101, already merged into `main`). Ships `/dashboard/market-radar`: an owner-facing page listing tracked competitors ("Tracking N competitors") and benchmarks ("Benchmarking", framed as inspiration not comparison) with add/remove actions, calling Task 001's `addMarketRadarEntryForUser`/`removeMarketRadarEntryForUser` via a new `app/api/market-radar/` route pair scoped to the current authenticated user. A new pure helper, `lib/market-radar/display.ts` (`groupMarketRadarEntriesForDisplay`), reuses Task 001's `sortMarketRadarEntries` rather than reimplementing ordering, and is unit-tested directly. Linked from the Growth Advisor's "More tools" progressive-disclosure list only — no new primary nav item, per `NAVIGATION_PHILOSOPHY.md`. Deliberately shows no fabricated "recent activity" or "changes detected" copy — the monitoring/detection layer doesn't exist yet, and wiring into Weekly Briefing / Marketing Director / Business Pulse was explicitly out of scope for this task (see `OPEN_ITEMS.md`). **PR base note:** this branch was created from (and is already up to date with) `origin/main`'s tip, which already contains Task 001's merged work plus two unrelated queue-tooling fixes (PR #102, #103) — opening the PR against the stale `ai-queue/001-market-radar-foundation` branch name would have pulled those two unrelated merges into the diff, so the PR was opened against `main` directly instead, consistent with this repo's own just-built `resolveDependencyBase()` logic (`DECISIONS.md` ADR-0015): a merged dependency's real merge target, not its possibly-stale branch name, is the correct base. See `HANDOFF.md` for full details.

**Known safety gates (must not be silently changed by any agent):**
- `ATTACH_DECLARATIVE_PRODUCTION_CRONS` — the Trigger.dev production-schedule activation gate. **Must remain `false`.** Canonical source: `lib/trigger/scheduleActivation.ts`. Referenced/enforced across ~10+ tests, most `docs/` files, and this repo's own `RUNBOOKS.md` (which treats an accidentally-`true` gate as a severe production-safety incident).
- No automatic merges, no automatic deploys, no automatic production migrations, no automatic secret changes — enforced by process (`AGENTS.md`) and by the queue's `safety:` block (`.ai/queue/RUN_QUEUE.yaml`), not by any code-level lock.

**Current blockers:** see `STATUS.json.current_blockers` and `OPEN_ITEMS.md` (security gap, architecture decision debt, production launch blockers, missing recommendation-engine trigger).

**Recommended next step:** Review and merge PR #101 (Task 001) and this task's PR (Task 002) — in dependency order, 001 before 002, though 002 is opened against `main` directly (see above) since 001 is already merged. Separately: resolve the three-competing-"what should this business do"-systems architecture question (`docs/ARCHITECTURE_REVIEW_2026.md`) before adding further recommendation/decision surface area, and patch the spoofable `x-forwarded-for` rate-limit key on the public interactive-demo endpoint (§3.9 of that same review) — it is an active, unbounded-cost-abuse security gap, not a hypothetical one.

**Date last verified:** 2026-08-02

**Branch/commit used for verification:** `ai-queue/002-market-radar-view`, based on `origin/main` at `912248a` (merge of PR #103, which already contains PR #101/Task 001).

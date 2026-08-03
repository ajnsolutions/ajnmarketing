# Current Status

> Machine-readable twin: [`STATUS.json`](./STATUS.json). If the two ever disagree, `STATUS.json` is stale and needs a fix — this file and that one must be updated together.

**Project name:** AJN Marketing ("Project Magic")

**Current product mission:** Make AJN Marketing feel like a small business hired the best Head of Marketing it could ever have — not like it bought another marketing tool. The product is evolving from an AI marketing platform into a broader "AI Growth Engine" for small businesses (Project Magic 2.0), with marketing as the first application of that intelligence.

**Current development phase:** Project Magic 2.0 (AI Growth Engine). Of the four planned waves in `docs/project-magic/IMPLEMENTATION_ROADMAP.md`:
- **Wave I** (Free Marketing Snapshot + Business Brain foundation) — shipped: public pre-auth Snapshot, secure SSRF-hardened backend contract, DNS-pinned continuation bridge, First Impression customer-facing UI, internal-alpha intelligence pass.
- **Wave II** (Connector Framework + Smart Uploads) — shipped: Business Connections foundation, Smart Uploads (PDF/DOCX/TXT/MD), Google Search Console as the first live Website & Search connector.
- **Wave III** (Customer Voice, Market Radar, Seasonal Intelligence) — partially shipped: Goals & Strategy shipped, Customer Voice Phase 1 + 2 shipped (Google Reviews + Website Testimonials providers). Market Radar's owner-managed persistence foundation shipped this session (`lib/market-radar/`, migration `037_market_radar.sql`, branch `ai-queue/001-market-radar-foundation` — persistence and types only, no UI yet). Seasonal Intelligence is **not yet started**.
- **Wave IV** (Business Pulse + Autopilot) — not started as originally scoped, but several features that read like an organic continuation of it have shipped outside the formal wave numbering (see below).

The 1.0 roadmap (`docs/IMPLEMENTATION_ROADMAP.md`, Phases A–H) runs in parallel and still governs marketing-specific delivery: Phases A–C are largely shipped; **Phases D, E, F, G, H remain scope-only, not shipped.**

**Major completed systems:**
- Authenticated marketing loop: Marketing Director orchestration, recommendations, campaigns, experiments, decision intelligence, strategic calendar, marketing memory (4-layer model), guided onboarding, Assisted Pilot — collectively validated through Release Candidate 1.
- Business Brain intelligence layer (shipped, but **not named in the 2.0 wave roadmap document** — see Open Items): Business Knowledge Graph, Business Learning Engine, Business Brain Inspector, External Intelligence foundation, Business Connections, Opportunity Detection Engine.
- Growth Advisor experience (replaces the previous `/dashboard` composition) and Autonomous Growth Planner (recommend-only, no auto-execution).
- Head of Marketing Orchestrator — the newest merge (PR #96): a daily Executive Review composing Weekly Growth Plan + Executive Brief + Opportunity Engine into one view, at `/dashboard/executive-review` (customer) and `/dashboard/admin/executive-overview` (admin).
- Publishing pipeline with atomic job claiming (background_jobs table + Trigger.dev, two systems not yet merged — see `DECISIONS.md`).

**Current active initiative:** TypeScript baseline-determinism fix (branch `fix/queue-typescript-baseline-determinism`). This is the third infrastructure bug found by successive attempts to actually run Task 002: with the dependency-base fix merged (PR #103), Task 002 started and resolved its base correctly — then failed its own quality gate. `baseline.json` recorded `typescriptErrorCount: 2`; the later comparison capture reported `18`; `compareQualitySnapshots()` treated the 16-error gap as a regression and failed the task after three auto-repair attempts each independently re-confirmed the same real 18 errors with nothing to fix. **Root cause**, independently reproduced from a clean checkout before any code was changed (per this task's own mandate not to trust prior repair-attempt conclusions): baseline and comparison capture already called the same shared `captureQualitySnapshot()` function — so the discrepancy could only come from ambient on-disk state that function's `tsc` invocation reads, not from differing commands. Two confirmed causes: (1) the real `tsconfig.json`'s `incremental: true` leaves a persistent, gitignored `tsconfig.tsbuildinfo` cache never reset between captures, vulnerable to corruption by `subprocess.ts`'s SIGKILL-on-timeout; (2) `tsconfig.json`'s `include` pulls in Next.js's auto-generated `.next/types`/`.next/dev/types` route validators, and a stale `.next/` built from a different branch leaks phantom errors (reproduced directly: 18 clean vs. 24 with a stale `.next/` from the Market Radar branch present). Fixed (see `DECISIONS.md` ADR-0016): a dedicated `tsconfig.quality-gate.json` (repo root, `incremental: false`, excludes `.next/**/*`) used by a new shared `runTypescriptCheck()` helper — verified deterministic (18/18/18 across repeated runs) and immune to injected stale `.next` content, via real (non-mocked) `tsc` invocations in `unit-tests/ai-queue-typescript-determinism.test.ts`. Does not touch the 18 pre-existing historical errors themselves. See `HANDOFF.md` for full details and exact next-step commands.

**Known safety gates (must not be silently changed by any agent):**
- `ATTACH_DECLARATIVE_PRODUCTION_CRONS` — the Trigger.dev production-schedule activation gate. **Must remain `false`.** Canonical source: `lib/trigger/scheduleActivation.ts`. Referenced/enforced across ~10+ tests, most `docs/` files, and this repo's own `RUNBOOKS.md` (which treats an accidentally-`true` gate as a severe production-safety incident).
- No automatic merges, no automatic deploys, no automatic production migrations, no automatic secret changes — enforced by process (`AGENTS.md`) and by the queue's `safety:` block (`.ai/queue/RUN_QUEUE.yaml`), not by any code-level lock.

**Current blockers:** see `STATUS.json.current_blockers` and `OPEN_ITEMS.md` (security gap, architecture decision debt, production launch blockers, missing recommendation-engine trigger).

**Recommended next step:** Resolve the three-competing-"what should this business do"-systems architecture question (`docs/ARCHITECTURE_REVIEW_2026.md`) before adding further recommendation/decision surface area. In parallel, patch the spoofable `x-forwarded-for` rate-limit key on the public interactive-demo endpoint (§3.9 of that same review) — it is an active, unbounded-cost-abuse security gap, not a hypothetical one.

**Date last verified:** 2026-08-02

**Branch/commit used for verification:** `fix/queue-typescript-baseline-determinism`, based on `main` at `912248a` (merge of PR #103).

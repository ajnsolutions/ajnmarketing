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

**Current active initiative:** Dependency-base resolution fix (branch `fix/queue-merged-dependency-base-resolution`). This is the direct sequel to the completion-state fix (PR #102, merged): once Task 001's `QUEUE_STATUS.json` entry was corrected, `npm run ai:queue` correctly selected Task 002 — and then failed trying to branch it, because Task 001's local branch had been (correctly) deleted after PR #101 merged: `git checkout -b ai-queue/002-... ai-queue/001-market-radar-foundation` → `fatal: 'ai-queue/001-market-radar-foundation' is not a commit`. **Root cause:** the old `determineBranchBase()` unconditionally reused a completed dependency's *recorded branch name* forever, with no check for whether it still existed — silently requiring every merged dependency branch to survive indefinitely. Fixed (see `DECISIONS.md` ADR-0015): `scripts/ai/reconcile.ts`'s new `resolveDependencyBase()` resolves a merged dependency to its real, GitHub-verified merge target (normally `origin/main`), independently verifying the merge commit's ancestry before trusting it — a merged dependency's branch is never required to still exist. An open (unmerged) dependency still uses its own branch; an unverifiable dependency stops the run with an actionable error rather than guessing. This now runs as a cheap preflight step, before the expensive quality-gate baseline is captured — directly motivated by the real failed run's own evidence (`.ai/runs/2026-08-02T151115309Z/`), which shows a full baseline was captured before the cheap failure was discovered. Task 002's `QUEUE_STATUS.json` entry was reset from `"failed"` back to `"pending"` in this PR (Task 001's `"completed"` entry untouched) — **Task 002 is confirmed eligible again**, and `resolveDependencyBase()` was independently verified against this repo's real, live `gh`/`git` state to correctly resolve its base to `origin/main`. See `HANDOFF.md` for full details and exact next-step commands.

**Known safety gates (must not be silently changed by any agent):**
- `ATTACH_DECLARATIVE_PRODUCTION_CRONS` — the Trigger.dev production-schedule activation gate. **Must remain `false`.** Canonical source: `lib/trigger/scheduleActivation.ts`. Referenced/enforced across ~10+ tests, most `docs/` files, and this repo's own `RUNBOOKS.md` (which treats an accidentally-`true` gate as a severe production-safety incident).
- No automatic merges, no automatic deploys, no automatic production migrations, no automatic secret changes — enforced by process (`AGENTS.md`) and by the queue's `safety:` block (`.ai/queue/RUN_QUEUE.yaml`), not by any code-level lock.

**Current blockers:** see `STATUS.json.current_blockers` and `OPEN_ITEMS.md` (security gap, architecture decision debt, production launch blockers, missing recommendation-engine trigger).

**Recommended next step:** Resolve the three-competing-"what should this business do"-systems architecture question (`docs/ARCHITECTURE_REVIEW_2026.md`) before adding further recommendation/decision surface area. In parallel, patch the spoofable `x-forwarded-for` rate-limit key on the public interactive-demo endpoint (§3.9 of that same review) — it is an active, unbounded-cost-abuse security gap, not a hypothetical one.

**Date last verified:** 2026-08-02

**Branch/commit used for verification:** `fix/queue-merged-dependency-base-resolution`, based on `origin/main` at `952df6e` (merge of PR #102).

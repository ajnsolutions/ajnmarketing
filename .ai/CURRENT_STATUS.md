# Current Status

> Machine-readable twin: [`STATUS.json`](./STATUS.json). If the two ever disagree, `STATUS.json` is stale and needs a fix — this file and that one must be updated together.

**Project name:** AJN Marketing ("Project Magic")

**Current product mission:** Make AJN Marketing feel like a small business hired the best Head of Marketing it could ever have — not like it bought another marketing tool. The product is evolving from an AI marketing platform into a broader "AI Growth Engine" for small businesses (Project Magic 2.0), with marketing as the first application of that intelligence.

**Current development phase:** Project Magic 2.0 (AI Growth Engine). Of the four planned waves in `docs/project-magic/IMPLEMENTATION_ROADMAP.md`:
- **Wave I** (Free Marketing Snapshot + Business Brain foundation) — shipped: public pre-auth Snapshot, secure SSRF-hardened backend contract, DNS-pinned continuation bridge, First Impression customer-facing UI, internal-alpha intelligence pass.
- **Wave II** (Connector Framework + Smart Uploads) — shipped: Business Connections foundation, Smart Uploads (PDF/DOCX/TXT/MD), Google Search Console as the first live Website & Search connector.
- **Wave III** (Customer Voice, Market Radar, Seasonal Intelligence) — partially shipped: Goals & Strategy shipped, Customer Voice Phase 1 + 2 shipped (Google Reviews + Website Testimonials providers). Market Radar and Seasonal Intelligence are **not yet started**.
- **Wave IV** (Business Pulse + Autopilot) — not started as originally scoped, but several features that read like an organic continuation of it have shipped outside the formal wave numbering (see below).

The 1.0 roadmap (`docs/IMPLEMENTATION_ROADMAP.md`, Phases A–H) runs in parallel and still governs marketing-specific delivery: Phases A–C are largely shipped; **Phases D, E, F, G, H remain scope-only, not shipped.**

**Major completed systems:**
- Authenticated marketing loop: Marketing Director orchestration, recommendations, campaigns, experiments, decision intelligence, strategic calendar, marketing memory (4-layer model), guided onboarding, Assisted Pilot — collectively validated through Release Candidate 1.
- Business Brain intelligence layer (shipped, but **not named in the 2.0 wave roadmap document** — see Open Items): Business Knowledge Graph, Business Learning Engine, Business Brain Inspector, External Intelligence foundation, Business Connections, Opportunity Detection Engine.
- Growth Advisor experience (replaces the previous `/dashboard` composition) and Autonomous Growth Planner (recommend-only, no auto-execution).
- Head of Marketing Orchestrator — the newest merge (PR #96): a daily Executive Review composing Weekly Growth Plan + Executive Brief + Opportunity Engine into one view, at `/dashboard/executive-review` (customer) and `/dashboard/admin/executive-overview` (admin).
- Publishing pipeline with atomic job claiming (background_jobs table + Trigger.dev, two systems not yet merged — see `DECISIONS.md`).

**Current active initiative:** AI overnight queue reliability hardening (branch `harden-ai-queue-unattended-execution`). The queue's first real, *live, unattended* run (2026-08-02, run id `2026-08-02T065749882Z`, evidence preserved under `.ai/runs/2026-08-02T065749882Z/`) surfaced a real bug: `scripts/ai/adapters/claude.ts` invoked `claude -p` with no permission-bypass flag, so every Write/Edit/Bash tool call silently blocked on an approval no one was present to give — Claude exited 0 having done zero work, and the adapter reported success anyway (it only checked exit code). Fixed this session: the adapter now passes `--dangerously-skip-permissions` and independently inspects the JSON response body (`permission_denials`, `is_error`) instead of trusting exit code alone (see `DECISIONS.md` ADR-0013 for the full safety reasoning). Also hardened more broadly for reliability: every subprocess call now has an explicit timeout (`scripts/ai/subprocess.ts`), `QUEUE_STATUS.json` writes are atomic, a crash mid-task still produces a normal run summary, and the whole run now has a wall-clock ceiling (`queue.max_run_duration_minutes`, default 360 min). **The fix's success path is still unverified** — no `claude` binary was on `PATH` in this fix's own build sandbox either; see `OPEN_ITEMS.md`'s "Live dry-run incident" entry before trusting an unattended overnight run. Both Market Radar tasks in `RUN_QUEUE.yaml` (`001` persistence foundation, `002` owner-facing view, depends on `001`) are unaffected in content — still `status: pending`, ready to retry once the fix is verified. Otherwise, main is caught up through PR #99 with no other open product-track PR or unmerged product branch. See `recommended_next_task` below and `OPEN_ITEMS.md` for what a human should prioritize next on the product/intelligence track.

**Known safety gates (must not be silently changed by any agent):**
- `ATTACH_DECLARATIVE_PRODUCTION_CRONS` — the Trigger.dev production-schedule activation gate. **Must remain `false`.** Canonical source: `lib/trigger/scheduleActivation.ts`. Referenced/enforced across ~10+ tests, most `docs/` files, and this repo's own `RUNBOOKS.md` (which treats an accidentally-`true` gate as a severe production-safety incident).
- No automatic merges, no automatic deploys, no automatic production migrations, no automatic secret changes — enforced by process (`AGENTS.md`) and by the queue's `safety:` block (`.ai/queue/RUN_QUEUE.yaml`), not by any code-level lock.

**Current blockers:** see `STATUS.json.current_blockers` and `OPEN_ITEMS.md` (security gap, architecture decision debt, production launch blockers, missing recommendation-engine trigger).

**Recommended next step:** Resolve the three-competing-"what should this business do"-systems architecture question (`docs/ARCHITECTURE_REVIEW_2026.md`) before adding further recommendation/decision surface area. In parallel, patch the spoofable `x-forwarded-for` rate-limit key on the public interactive-demo endpoint (§3.9 of that same review) — it is an active, unbounded-cost-abuse security gap, not a hypothetical one.

**Date last verified:** 2026-08-02

**Branch/commit used for verification:** `harden-ai-queue-unattended-execution`, based on `origin/main` at `dc537d2` (merge of PR #99).

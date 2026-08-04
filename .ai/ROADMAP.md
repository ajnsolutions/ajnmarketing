# Roadmap

This file summarizes two companion roadmap documents that both remain in force:
- `docs/IMPLEMENTATION_ROADMAP.md` — Project Magic **1.0**, Phases A–H, still governs marketing-specific delivery.
- `docs/project-magic/IMPLEMENTATION_ROADMAP.md` — Project Magic **2.0** (AI Growth Engine), Waves I–IV.

Do not treat either source doc as replaced by this summary — this file is a synthesis for quick agent orientation, not the authoritative text. When in doubt, read the source doc.

## Completed

**1.0, Phases A–C** (public experience, onboarding, customer dashboard) — largest concentration of shipped work: One Head of Marketing, Weekly Briefing, HoM Journal, Executive Briefing Engine, Campaign Intelligence Engine, Interactive HoM, Strategic Marketing Calendar, Marketing Experimentation Engine, Decision Intelligence & Learning Impact, Customer Experience Polish, Guided Onboarding & Setup, Assisted Pilot Readiness, Pilot Validation & Go-Live Readiness (RC-1), Monthly Focus, Great Simplification, Proactive HoM, Product Readiness (UX polish pass), Marketing Director Intelligence Foundation. Marketing Memory sub-track: Phases 1–4 (through Marketing Director consumption) implemented.

**2.0, Wave I** (Free Marketing Snapshot + Business Brain foundation) — AI Business Discovery orchestration, secure public/pre-auth Snapshot backend (SSRF-hardened, DNS-pinned, rate-limited, 15-min TTL cache), First Impression customer-facing UI, snapshot continuation (resolve/claim/confirm + onboarding prefill), internal-alpha intelligence pass.

**2.0, Wave II** (Connector Framework + Smart Uploads) — Business Connections foundation, Smart Uploads (PDF/DOCX/TXT/Markdown → "I learned..." pipeline), Google Search Console as the first live Website & Search connector.

**2.0, Wave III (partial)** — Goals & Strategy (goal model, strategy-layer relevance, Goal Progress, goal-aware Growth Advisor briefing), Customer Voice Phase 1 (provider-agnostic intelligence engine, Google Reviews) and Phase 2 (customer-facing experience; Website Testimonials as the second provider).

**Shipped outside the formal wave sequence** (not named in `docs/project-magic/IMPLEMENTATION_ROADMAP.md` — see Open Items for the reconciliation flag): Business Connections foundation, Business Knowledge Graph & cross-source reasoning, Business Learning Engine, External Intelligence foundation, Growth Advisor Experience, Autonomous Growth Planner, Business Brain Inspector, Opportunity Detection Engine, Project Magic Phase 2 (experience simplification), Head of Marketing Orchestrator (newest merge, PR #96).

## In progress

Nothing is currently mid-flight on the product track: no open PR, no unmerged product branch tied to an active doc (verified 2026-07-31). Two unmerged remote branches exist but are not confirmed active work — see `OPEN_ITEMS.md`.

## Next

Per `docs/project-magic/IMPLEMENTATION_ROADMAP.md`, Wave III's remaining scope:
- **Market Radar** — owner-facing add/remove/prioritize/benchmark controls over the existing `lib/market-context/` competitor provider (expansion, not a rebuild, per `EXISTING_SYSTEM_AUDIT.md`). Persistence foundation shipped (`lib/market-radar/`, migration `037_market_radar.sql`, PR #101). The owner-facing view (Task 002, branch `ai-queue/002-market-radar-view`) has also shipped: `/dashboard/market-radar` (add/remove competitors and benchmarks, reachable via "More tools"). **Task 003 (Competitor Observation Engine) has now shipped** on branch `ai-queue/003-competitor-observation-engine`: evidence model, confidence scoring (`lib/competitor-observations/scoring.ts`'s pure `scoreCompetitorSignal`), and tenant-scoped persistence (`lib/competitor-observations/persistence.ts`, migration `038_competitor_observations.sql`) — no UI. It scores `lib/market-context/providers/competitorProvider.ts`'s existing profile-declared signal against the owner's Market Radar tracked competitors; still no live external monitoring anywhere in this repo. Tasks 004 and 005 remain **queued, not yet built**: 004 (Business Pulse Integration: a first honest slice — verified observations, "What Changed", evidence links, confidence filtering, depends on 003) and 005 (Weekly Executive Brief: Market Radar section — executive summary, why it matters, suggested actions, depends on 003, sibling of 004). See `.ai/queue/RUN_QUEUE.yaml` and `.ai/queue/prompts/004-*.md`/`005-*.md` for full scope. Marketing Director recommendation evidence integration remains unscoped future work.
- **Seasonal Intelligence** — forward-looking, lead-time-aware forecasts on top of the existing `lib/marketing-memory/seasonality.ts` recurrence classification (expansion, not a rebuild).

Per `docs/ARCHITECTURE_REVIEW_2026.md`, the highest-priority non-feature work: resolve the three-competing-decision-systems question (Marketing Recommendations vs. Tasks vs. Marketing Plan, plus Assisted Pilot as a fourth adjacent layer) before shipping further recommendation surface area.

## Later

**2.0, Wave IV** (Business Pulse + Autopilot) — Growth Momentum composed from Marketing Health + Customer Voice + Market Radar + Seasonal Intelligence; monthly Business Pulse report; broadened Trust Model gating from marketing-only to Growth-Engine-wide; Autopilot framing at the top of the existing trust ceiling. Explicitly depends on Waves I–III shipping with **real production signal** first (per that wave's own anti-padding rule), and does **not** itself flip the production-schedule gate.

**1.0, Phases D–H** — still scope-only in the source roadmap doc, not shipped: further marketing workflow, results & Marketing Health, admin operating console, trust progression, and Phase H's "Autonomous Head of Marketing." Some of this scope may already be substantially covered by the out-of-sequence Business Brain / Orchestrator work above — recommend a human reconcile before treating Phases D–H as fully open.

## Pre-launch requirements

From `docs/LAUNCH_CHECKLIST.md` and `docs/PRODUCTION_READINESS.md` (dated 2026-07-14, status "Launch-ready with conditions"):
1. Confirm Supabase service-role key rotation.
2. Decide assisted-vs-scheduled pilot operating mode.
3. Provision production environment variables (Supabase, Trigger.dev, OpenAI, GBP OAuth, email).
4. **Do not flip `ATTACH_DECLARATIVE_PRODUCTION_CRONS`** — remains a separate, explicit, ops-approved decision, not a side effect of any feature work.
5. Run migrations, smoke tests, verify monitoring/alerting, confirm rollback plan, obtain sign-off (full checklist in `LAUNCH_CHECKLIST.md`).

Known remaining risk items from `docs/RELEASE_CANDIDATE_END_TO_END_AUDIT.md`: Opportunity/Decision Engine has no trigger anywhere in the product; `GET /api/publishing` executes due jobs as a page-load side effect; Approval Center overstates automation in its copy; GBP Disconnect is a no-op; Regenerate silently severs the recommendation link; the analytics→opportunities feedback loop is dead in production. See `OPEN_ITEMS.md` for the full list with severities.

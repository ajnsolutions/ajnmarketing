# Architecture Decision Records

Only decisions supported by the repository (its docs, tests, or code) or clearly marked initial-framework decisions belong here. When a decision is revisited, add a new dated entry rather than editing history — link back with `Supersedes: ADR-000N`.

Numbering follows `docs/ARCHITECTURE_DECISIONS.md`, the primary source for ADR-0001 through ADR-0010. Consult that file for full rationale; this is an index, not a replacement.

## ADR-0001 — Tenant scoping via `*ForUser` / `*ForCurrentUser`
Every tenant-scoped data access takes an explicit `userId` (`*ForUser(userId, supabaseClient?)`) or resolves the current session (`*ForCurrentUser()`). Enforced additionally by Postgres RLS. Source: `docs/ARCHITECTURE_DECISIONS.md`.

## ADR-0002 — `patchContentApprovalForUser` as the single authoritative mutation
Content approval state changes go through exactly one function, not scattered ad-hoc writes. Source: `docs/ARCHITECTURE_DECISIONS.md`.

## ADR-0003 — Two separate signed-token families
Weekly-package "open" links and email-action tokens are deliberately separate token families with different scope/lifetime, not one generalized token system. Source: `docs/ARCHITECTURE_DECISIONS.md`.

## ADR-0004 — `ATTACH_DECLARATIVE_PRODUCTION_CRONS` as the production-activation gate
Flipping this flag is "a real production decision requiring its own sign-off, not a refactor." No PR, feature, or automated agent may flip it. Source: `docs/ARCHITECTURE_DECISIONS.md`; enforced further by this repo's `.ai/queue/` safety validator (see `ARCHITECTURE.md`).

## ADR-0005 — Two live job/queue systems, not yet merged
`background_jobs` (Postgres, polled) and Trigger.dev (v4 SDK) co-exist. Acknowledged as unmerged, not accidental duplication. Source: `docs/ARCHITECTURE_DECISIONS.md`.

## ADR-0006 — `lib/google-business` vs. `lib/google-business-profile`
A real split (auth vs. operations) kept as two folders. Flagged as friction in `docs/ARCHITECTURE_REVIEW_2026.md` §3.2, not defended as correct — recorded so a future refactor knows the *intent* even though the *execution* needs cleanup. Source: `docs/ARCHITECTURE_DECISIONS.md`.

## ADR-0007 — Three parallel "what should this business do" systems
Marketing Recommendations, Tasks, and Marketing Plan currently compete as separate answers to the same underlying customer question. **Status: unresolved as of 2026-07-31** — see `OPEN_ITEMS.md`. Source: `docs/ARCHITECTURE_DECISIONS.md`.

### Sub-decision (2026-07-16, One Head of Marketing)
`lib/head-of-marketing` → `/dashboard` is the authoritative customer-facing answer among these competing systems, at least for the primary dashboard surface. Source: `docs/ARCHITECTURE_DECISIONS.md`.

## ADR-0008 — Admin/ops as a separate, un-productized console
Internal operator tooling is deliberately kept out of the customer-facing product surface. Source: `docs/ARCHITECTURE_DECISIONS.md`.

## ADR-0009 — Assisted Pilot as an autonomy on-ramp, not a fifth decision system
Assisted Pilot exists to build trust toward more autonomous execution — it composes existing systems' outputs, it does not add its own competing "what to do" logic. Source: `docs/ARCHITECTURE_DECISIONS.md`.

## ADR-0010 — Documentation-first product definition
`docs/` (especially `docs/project-magic/`) is treated as authoritative product design ahead of implementation. Source: `docs/ARCHITECTURE_DECISIONS.md`. **Caveat added 2026-07-31**: this repo's own investigation found `docs/project-magic/IMPLEMENTATION_ROADMAP.md` has drifted out of sync with shipped work (see `OPEN_ITEMS.md`) — documentation-first does not mean documentation-is-infallible; verify against code and Git history per `AGENTS.md`.

## ADR-0011 — Shared AI project memory + overnight task queue (2026-07-31)
**Status:** Initial framework decision, this build.

**Decision:** Introduce `.ai/` as the repository's shared, versioned memory for every AI coding tool (Claude Code, ChatGPT via manual upload, Grok/Cursor, future tools), plus a sequential, file-based task queue (`.ai/queue/`) that can run multiple pre-approved prompts through Claude Code non-interactively, with a hard safety validator that rejects any task requesting merge, deploy, production migrations, secret changes, or production-schedule activation.

**Why:** Prior to this, project context lived only in chat history (lost between sessions/tools) and in `docs/*.md` (rich, but not structured for machine consumption or fast agent orientation, and prone to drifting stale — see ADR-0010's caveat above). Multiple AI tools working on this repo need one shared, low-ceremony source of truth, and any automation that can run overnight needs an explicit, auditable safety boundary rather than relying on each tool's own judgment every time.

**Alternatives considered:** Rely solely on `docs/`. Rejected — not structured for a "read this before starting" workflow, and this build's own research found it already drifting (ADR-0010 caveat). Rely solely on chat-history continuity. Rejected — explicitly the problem being solved (per this task's own primary objective).

**Consequences:** Every agent (per `AGENTS.md`) must now read `.ai/` before starting work and update it before finishing, in the same branch/PR as the implementation. The queue's Claude adapter (`scripts/ai/adapters/claude.ts`) is implemented against documented Claude Code CLI conventions but has **not been end-to-end verified in this build's sandbox**, because no `claude` CLI binary was present on `PATH` here — see `OPEN_ITEMS.md` and `docs/AI_OVERNIGHT_QUEUE.md` for the required first daytime dry run before any unattended overnight use. The Cursor/Grok adapter is an explicit placeholder (`scripts/ai/adapters/cursor-placeholder.ts`) that reports itself unavailable — it makes no functionality claim.

# Architecture Decisions

A record of *why* the major systems in this codebase exist and are shaped the way they are — for developers joining after the fact who need to know which quirks are load-bearing and which are historical accidents. Companion to [`ARCHITECTURE_REVIEW_2026.md`](./ARCHITECTURE_REVIEW_2026.md), which assesses whether these decisions are still the right foundation going forward.

---

## 1. Tenant scoping: `*ForUser(userId, supabaseClient?)` + `*ForCurrentUser()`

**What:** Nearly every service function that touches tenant data comes in two forms — an explicit-`userId` + injectable-client version, and a zero-argument version that reads the session cookie and calls the first.

**Why:** Two different call sites need two different things. HTTP route handlers have a request-scoped session and want the cookie-bound convenience wrapper. Trigger.dev tasks, admin tools, and unit tests have neither a request nor a cookie — they have a `userId` in hand (from a queue payload, an admin form, or a test fixture) and a Supabase client they constructed themselves (service-role, or a fake for tests). Writing every service function only in the `ForCurrentUser` shape would make it impossible to call from any of those contexts without faking `next/headers`.

**Tradeoff accepted:** Two exported functions per service instead of one. **Future expectation:** any new mutating service should ship both forms from day one — retrofitting the split later (as §3.7 of the architecture review flags for `content-approval` and `background-jobs`) is strictly more expensive than doing it up front.

---

## 2. `patchContentApprovalForUser` as the single authoritative mutation

**What:** Every path that can approve, reject, edit, regenerate, or record positive feedback on a content draft — the Approval Center UI, the weekly email package, one-click email actions — ultimately calls the same function in `lib/content-approval/service.ts`.

**Why:** Approval state (`content_approvals.status`) drives outcome-event recording, audit logging, and (eventually) publishing eligibility. The moment two code paths can independently flip that status, they can disagree about whether an outcome event was recorded, whether the audit log has an entry, or whether a draft is safe to queue — and that class of bug is exactly the kind that's invisible until a customer's weekly package silently double-processes an approval.

**Tradeoff accepted:** Every new "approve from X" entry point (there have been three: dashboard, weekly email, one-click email) must resist the temptation to special-case its own status transition and instead thread through this one function. **Future expectation:** if a fourth approval surface is ever added (e.g. Slack, SMS), it must call this function too, not reimplement a fourth copy of "what does approving mean."

---

## 3. Two separate signed-token families (weekly-package "open" links vs. email-action tokens)

**What:** `lib/weekly-approval-package/signedLinks.ts` and `lib/email-actions/tokens.ts` are both HMAC-signed, both use the same base64url + `timingSafeEqual` construction, and can even share the same fallback secret — but they are deliberately incompatible with each other via a domain-separation constant mixed into the signature.

**Why:** The weekly-package tokens are **redirect-only** — clicking one can never mutate state, so their only job is proving "this link came from us and hasn't expired" before routing an already-authenticated user into the dashboard. The email-action tokens **execute a mutation** (approve/reject), so they need a richer payload (`action`, `nonce`, `tokenVersion`, an immutable id snapshot) and a stricter contract: a bare `GET` on an email-action link must never execute anything, because email security scanners automatically pre-fetch links. Building one token format to serve both purposes would mean either (a) redirect links carrying mutation-shaped fields they never use, or (b) mutation links inheriting the redirect token's weaker guarantees. Keeping them separate, with automated tests proving neither family can be replayed as the other, is more code but a smaller blast radius if either format ever needs to change.

**Tradeoff accepted:** Two token modules to maintain instead of one. **Future expectation:** do not "simplify" these into one shared token type without preserving the GET-never-mutates guarantee and the domain separation — that would reintroduce the exact risk this split was built to avoid.

---

## 4. The Trigger.dev production-activation gate (`ATTACH_DECLARATIVE_PRODUCTION_CRONS`)

**What:** Every Trigger.dev task capable of running on a schedule is defined, deployed, and fully functional — but whether it actually attaches a live cron schedule in production is gated by one boolean in `lib/trigger/scheduleActivation.ts`, currently `false`.

**Why:** This lets the team build, deploy, and manually exercise the entire autonomous pipeline (recommendation generation, analytics capture, publishing) via admin-triggered one-off runs, with full confidence the code path works, *before* committing to it running unattended on every tenant on a schedule. Flipping the boolean is the single, reviewable moment that decision gets made — not something that can happen by accident via a stray schedule definition somewhere in a task file.

**Tradeoff accepted:** Every test that cares about "is autonomous execution live" has to check this one flag rather than infer it from schedule definitions — which is intentional (single source of truth), even though the review found it's *also* independently re-asserted in ~10 unrelated test files as a tripwire. **Future expectation:** flipping this to `true` is a real production decision requiring its own sign-off, not a refactor — do not casually "clean up" the gate check during unrelated work.

---

## 5. Two live job/queue systems (`background_jobs` + Trigger.dev), not yet merged

**What:** Some background work still dispatches via a request-scoped `after()` callback into a `background_jobs` table (`lib/background-jobs/`); newer work runs via Trigger.dev tasks (`trigger/`, `lib/trigger/`). Both are fully live simultaneously.

**Why:** This is an explicit, staged migration — see `docs/ADR_AUTONOMOUS_SCHEDULER.md`. Trigger.dev didn't exist (or wasn't trusted) when the original background-jobs system was built; rather than a risky big-bang cutover, new autonomous work was built on Trigger.dev while existing `background_jobs` consumers were left alone until they could be migrated deliberately.

**Tradeoff accepted:** Two systems' worth of retry policy, persistence, and mental model to hold at once, for as long as the migration takes. **Future expectation:** this is meant to converge on Trigger.dev only — new background work should default to Trigger.dev, and `background_jobs` should not gain new consumers.

---

## 6. `lib/google-business` vs. `lib/google-business-profile`

**What:** Google Business Profile integration is split across two similarly-named directories: one centered on OAuth/connection/profile state, one on sync/publish/review-reply behavior — but each imports from the other in different files.

**Why (as best reconstructed):** The split reads like an attempt to separate "the account connection" from "the marketing actions performed once connected" — a reasonable instinct, since one concerns auth/token lifecycle and the other concerns content operations. It was not fully carried through: the review found genuine bidirectional imports rather than a one-directional layered dependency.

**Status:** Flagged as real friction in the architecture review (§3.2), not defended here as correct — this is recorded so a future refactor knows the *intent* (auth vs. operations) even though the *execution* needs cleanup, rather than reverse-engineering the split from scratch.

---

## 7. Three parallel "what should this business do" systems

**What:** Marketing Recommendations (deterministic detectors + adaptive learning + outcome tracking), Tasks (`lib/marketing-agent`, OpenAI ad hoc), and Marketing Plan (`lib/marketing-planner`, OpenAI weekly plan) each independently generate guidance for the customer, and all three are live in Command Center today.

**Why they each exist:** They were built to answer the same underlying customer need — "tell me what to do" — from three different angles that arrived at different times: Marketing Recommendations is the most mature, data-driven, and outcome-tracked; Tasks is a lighter-weight, more immediate, conversational framing; Marketing Plan is a longer-horizon, narrative framing. None of them is wrong in isolation.

**Why this is flagged, not defended:** Project Magic's premise is a single, simplified relationship with a "Head of Marketing." Three systems each producing their own version of "what to do" is the opposite of that premise, and is called out as the single highest-priority consolidation decision in the architecture review (§3.1, §8).

**Decision (2026-07-16, One Head of Marketing):** The authoritative **customer-facing** answer to “what should I do next?” is `lib/head-of-marketing` → `/dashboard` (“Your Head of Marketing”). Marketing Recommendations remain the most mature **data-driven** source; Tasks and Marketing Plan are folded in as supporting signals. None of the three engines are retired or rewritten — they are demoted from competing UI decision centers via progressive disclosure. See [`ONE_HEAD_OF_MARKETING.md`](./ONE_HEAD_OF_MARKETING.md).

---

## 8. Admin/ops as a separate, deliberately un-productized console

**What:** `/dashboard/admin/**` and `app/api/admin/**` are gated by a simple `ADMIN_USER_IDS` env-var allowlist (`lib/admin/isAdminUser.ts`) — not a real role system, not a `role`/`is_admin` column anywhere in the schema.

**Why:** There is currently exactly one class of privileged user (AJN staff), and building a general role/permission system for that would be pure speculative complexity. The allowlist is honest about being a stopgap rather than pretending to be more than it is.

**Tradeoff accepted:** If a second privilege tier is ever needed (e.g. read-only support staff vs. full admin), this allowlist doesn't extend cleanly — it will need to become a real model at that point, not before. **Future expectation:** don't invent role granularity ahead of an actual second privilege tier existing.

---

## 9. Assisted Pilot as an autonomy on-ramp, not a fifth "what to do" system

**What:** `lib/assisted-pilot/` models a checklist/readiness progression toward more autonomous execution for a small set of pilot businesses, and can directly trigger the recommendation pipeline and reconciliation on their behalf.

**Why:** Before turning on autonomous behavior for every tenant, the team wanted a controlled, observable, per-business on-ramp — a way to validate "does letting the system act with less human approval actually work" against a handful of real businesses before it's a platform-wide switch (which is exactly what `ATTACH_DECLARATIVE_PRODUCTION_CRONS` gates at the scheduling layer).

**Relationship to Project Magic:** This is directly relevant to, not separate from, Magic's "future autonomous workflows" goal — it should be treated as the existing on-ramp for that vision, not rebuilt from scratch. See architecture review §3.1 for why its relationship to the recommendation-execution layer should be scoped explicitly during the Magic consolidation decision.

---

## 10. Documentation-first product definition (Project Magic docs)

**What:** `docs/NAVIGATION_PHILOSOPHY.md`, `docs/DASHBOARD_PHILOSOPHY.md`, `docs/TRUST_MODEL.md`, `docs/MARKETING_HEALTH.md`, `docs/CUSTOMER_JOURNEYS.md`, `docs/MAGIC_BLUEPRINT.md`, and related docs describe a target product state. As of One Head of Marketing, Marketing Health v1 and the unified briefing surface exist in `lib/head-of-marketing/` (presentation layer). `management_style` / `trust_stage` remain documentation-first until Trust Model UI ships.

**Why:** The product direction was deliberately locked down in writing before implementation, so that incremental PRs (like the ones that built the recommendation pipeline, weekly approval package, etc.) could be evaluated against a stable target rather than a moving one. This is why the architecture review could confidently say "this is greenfield work, not a rename" for Trust Model/Marketing Health — the docs were never meant to describe existing code.

**Future expectation:** keep these docs as the source of truth for target state; when implementation begins, update the docs only when the *decision* changes, not to retroactively describe whatever was shipped.

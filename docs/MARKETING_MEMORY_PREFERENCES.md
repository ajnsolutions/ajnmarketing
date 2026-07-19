# Marketing Memory Preferences — Phase 3 Implementation

**Branch:** `project-magic-marketing-memory-preferences` (from latest `main`, post–PR #53)
**Depends on:** [`MARKETING_MEMORY_ARCHITECTURE.md`](./MARKETING_MEMORY_ARCHITECTURE.md), [`MARKETING_MEMORY_DATA_MODEL.md`](./MARKETING_MEMORY_DATA_MODEL.md), [`MARKETING_MEMORY_LEARNINGS.md`](./MARKETING_MEMORY_LEARNINGS.md) (optional `related_learning_id` / contradicting evidence citation).

This document records what Phase 3 ("customer preferences and overrides") actually implements — not aspirational scope. See §12 for what is deliberately *not* included.

---

## 1. Phase 3 Scope

| Piece | What it is |
|---|---|
| `supabase/migrations/026_marketing_memory_preferences.sql` | `marketing_memory_overrides` + `marketing_memory_preferences`, narrow promotion-link update guard, additive `override` source_type on evidence_links |
| `lib/marketing-memory/preference*.ts` / `override*.ts` | Types, config, validation, idempotency, precedence helpers, persistence, services, request parsers, browser client |
| `app/api/marketing-memory/preferences` / `overrides` | Authenticated, tenant-scoped read/write APIs |
| `app/dashboard/marketing-preferences` + settings hub link | Minimal additive settings surface |

**Preferences and overrides do not influence Marketing Director, recommendation scoring, publishing, or Weekly Briefing behavior in this PR.** They are recorded, validated, auditable, and readable — consumption is Phase 4.

---

## 2. Deviations from the Architecture / Data Model Docs, and Why

1. **`content_tone` is excluded from `preference_type`.** Brand Voice / `business_profiles` voice fields remain the sole authoritative tone surface. Accepting a parallel `content_tone` preference would create competing instructions. Validation also rejects writes that try to smuggle goals/voice into `custom`.

2. **Preference changes soft-supersede instead of rewriting `instruction_text` in place.** When a structured preference identity already has an active row and the instruction (or `active_until`) changes, the old row is set `is_active = false` and a new active row is inserted with `supersedes_preference_id`. Identical re-saves are idempotent. This preserves audit history of prior customer statements.

3. **Multiple active `custom` preferences are allowed.** Each custom row receives a unique `factor_value` (`custom:<uuid>`) so the live partial unique index does not collapse unrelated free-text instructions into one slot.

4. **Overrides are append-only except `promoted_to_preference_id`.** A trigger rejects any other column mutation. This keeps history intact while still allowing the bidirectional promotion link the data model describes.

5. **`decision_link_id` is a nullable uuid without an FK.** `marketing_memory_decision_links` is Phase 4; Phase 3 keeps the column for forward compatibility without inventing the table.

6. **Actor attribution columns (`created_by` / `updated_by`) are required additions.** Every preference/override write sets these from the authenticated session user — never from a background job, never inferred from outcomes.

---

## 3. Authoritative Settings Boundary

These remain outside Marketing Memory and are **not** duplicated or overridden here:

| Concern | Authoritative home |
|---|---|
| Marketing goals / Monthly Focus priorities | `business_profiles.marketing_goals` / Monthly Focus |
| Brand voice / tone / preferred words | Brand Voice settings + `business_profiles` voice fields |
| Legal / compliance / safety rails | Existing publishing and content-approval controls |

Phase 3 preference types are limited to: `channel_priority`, `publishing_day_restriction`, `context_category_toggle`, `approval_requirement`, `custom`.

---

## 4. Actor Attribution and Audit History

- **Overrides:** `created_by` required; RLS insert requires `auth.uid() = created_by`. No delete. No general update.
- **Preferences:** `created_by` required on insert; `updated_by` set on soft-deactivate / supersession bookkeeping. No delete policy — “remove” means `is_active = false`.
- **Supersession chain:** `supersedes_preference_id` links the new active row to the deactivated predecessor.
- **Promotion chain:** permanent override → preference via `promoted_from_override_id` + `promoted_to_preference_id` + `source = promoted_override`.

---

## 5. Preference Precedence (read-time vocabulary only)

Implemented in `lib/marketing-memory/preferencePrecedence.ts` as an ordinal matching architecture §16:

1. Legal / compliance (not modeled in these tables)
2. Explicit customer preferences
3. Current business goals (external)
4. Strong learnings
5. Developing / early learnings
6. Generic best practices

Phase 3 uses this only to sort preference summaries and to list disabled context categories for API honesty. **Nothing in Marketing Director reads it yet.**

---

## 6. Override Capture and Promotion

`recordOverrideForBusiness`:

1. Validates closed `override_type` vocabulary.
2. Inserts an append-only override with a server-built idempotency key.
3. If `marked_learning_incorrect`, best-effort upserts a learning-anchored evidence_link with `source_type = override`, `contribution = contradicting`.
4. If `is_permanent`, promotes into a preference (when a structured mapping or notes exist) without requiring a separate manual step.

One-time overrides (`is_permanent = false`) never become preferences.

---

## 7. RLS Summary

| Table | select | insert | update | delete |
|---|---|---|---|---|
| `marketing_memory_overrides` | own `user_id` | own + `created_by = auth.uid()` | own, promotion-link only (trigger-enforced) | none |
| `marketing_memory_preferences` | own `user_id` | own + `created_by = auth.uid()` | own | none |

---

## 8. Customer Surface

- Settings hub link → `/dashboard/marketing-preferences`
- Minimal controls: disable context category, avoid publishing day, custom standing instruction, list/turn off active preferences, read-only recent overrides
- Copy states clearly that recommendations / Weekly Briefing are **not** changed yet

---

## 9. Files Touched Outside `lib/marketing-memory/`

- `app/api/marketing-memory/preferences/route.ts`
- `app/api/marketing-memory/overrides/route.ts`
- `app/dashboard/marketing-preferences/*`
- `components/dashboard/marketing-memory-preferences-page.tsx`
- `components/dashboard/settings-hub.tsx` (one additive link)
- docs listed in the PR
- unit tests + `fake-supabase-client` `.is()` support

Confirmed non-goals: no edits under `lib/marketing-director/`, `lib/marketing-decisions/`, or recommendation scoring paths that would consume preferences.

---

## 10. Testing

Unit coverage includes validation (including Brand Voice boundary), precedence ordering, persistence supersession/idempotency + tenant filters, override→preference promotion, contradicting evidence citation, and request/idempotency helpers.

---

## 11. Self-Review Checklist

| Check | Finding |
|---|---|
| Preferences inferred from outcomes | Not present — only explicit API/settings writes and permanent-override promotion |
| Competing tone/goals authority | Blocked — `content_tone` absent; custom text rejecting goals/voice language |
| Hard deletes / silent expiry | Not present — soft deactivate; `active_until` only from explicit customer input |
| Weak RLS / missing actor attribution | `created_by` required; insert WITH CHECK ties actor to `auth.uid()` |
| Wired into Marketing Director | Not present — no MD/recommendation imports of these services |
| Override history editable | Blocked by promotion-only update trigger |

---

## 12. Known Limitations / Next Phase

- Override-capture is API-ready; Weekly Briefing / recommendation UIs do not call it yet.
- `decision_link_id` cannot FK until Phase 4.
- Disabled context categories are listed by API but not applied to market-context ranking yet.
- **Phase 4 — Marketing Director consumption** is the first phase that may consult preferences via `MarketingMemoryEvidencePackage`, still as optional evidence, never a second decision authority.

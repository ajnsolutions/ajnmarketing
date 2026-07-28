# Your Growth Advisor — Wave II Conversational Home

**Status:** Shipped — replaces the previous `/dashboard` page composition, reusing existing engines
**Branch:** `project-magic/2-0-wave2-growth-advisor`
**Depends on:** Wave I (`docs/BUSINESS_DISCOVERY_FIRST_IMPRESSION.md`, `docs/BUSINESS_DISCOVERY_INTERNAL_ALPHA_REPORT.md`), and everything already documented in `MARKETING_DIRECTOR_FOUNDATION.md`, `EXECUTIVE_BRIEFING_ENGINE.md`, `HEAD_OF_MARKETING_JOURNAL.md`, `MARKETING_HEALTH.md`
**Cron gate:** `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains **false** — untouched

---

## Naming

**"Your Growth Advisor" is the customer-facing name for the authenticated home experience** — it replaces "Your Head of Marketing" everywhere a customer actually reads it: the nav label, the page header, the Ask panel, onboarding copy, page `<title>`/meta descriptions, and every other rendered string that named the persona.

**Internal architecture keeps its existing names.** `lib/head-of-marketing/`, `lib/marketing-director/`, `lib/interactive-hom/`, the `HeadOfMarketingBriefing` type, `buildWeeklyBriefing()` — none of this was renamed. This was an explicit, deliberate choice: renaming the module structure would have touched dozens of files for zero customer-facing benefit and meaningfully raised risk in a sprint about presentation, not architecture. The new customer-facing layer is `lib/growth-advisor/` — a thin transform over the existing, unchanged `HeadOfMarketingBriefing`.

---

## Philosophy

The old `/dashboard` had genuinely good underlying intelligence (Marketing Director's single decision, Marketing Health, the Journal, real relationship memory) but presented it as a stack of cards: a confidence panel, a proactive-presence card, an executive-brief card, a primary-action bar, then more cards. Functionally correct, but it read like a dashboard, not a relationship.

**The goal was never to build a better dashboard — it was to stop building a dashboard at all** for the first screen, and let the same underlying intelligence read as one continuous thought from an advisor who already knows the business, in the order a person would actually say it out loud.

## Conversation hierarchy

Fixed, never reordered:

```
Greeting
  ↓
What changed
  ↓
What I noticed (top 3)
  ↓
What I recommend (exactly one)
  ↓
Primary action (one button)
  ↓
Supporting context (everything else, below the fold)
```

Implemented in `components/dashboard/growth-advisor/growth-advisor-page.tsx`. No card, chart, or metric appears before the primary action — the first thing a customer sees is a sentence, not a grid.

### What changed

Sourced directly from `HeadOfMarketingBriefing.thisWeek` — already-grounded, real signals (posts published, reviews received, items prepared for publishing, tasks completed, profile views, plan progress). **Never fabricated**: when nothing meaningful happened, the underlying `buildThisWeek()` function's own honest one-line fallback ("Started learning your business so I can take ownership.") is shown instead of a padded list — `buildGrowthAdvisorBriefing.ts`'s `hasMeaningfulChange` flag treats a single-item result as the signal that nothing real happened this cycle, since the fallback path is the only way `thisWeek` ever produces exactly one item.

### What I noticed

Up to 3 observations, each split into a headline ("what happened") and a why-it-matters clause, parsed from `HeadOfMarketingBriefing.noticed`'s existing category-prefixed strings ("Search visibility: ...", "Review trends: ...", etc.) via a fixed, auditable lookup table — never freshly generated language. When real signals are thin (fewer than 3), a single Business Discovery growth-opportunity observation can supplement the list — **only as a filler, never displacing a real signal** — see Personalization below.

### What I recommend

Exactly one recommendation, sourced from `HeadOfMarketingBriefing.recommendation` (Marketing Director's own single decision — never a second prioritization pass) enriched with `HeadOfMarketingBriefing.topRecommendationDetail` when the recommendation came from a real ranked marketing recommendation rather than a rule-based fallback like "Finish connecting Google." Every recommendation carries:

- **Why now** — `topRecommendationDetail.whyNow` or the fallback `recommendation.why`
- **Expected impact** — `topRecommendationDetail.expectedBenefit` or `recommendation.expectedBenefit`
- **Estimated effort** — reuses `HeadOfMarketingBriefing.timeRespectLabel` (the same time estimate already shown elsewhere), phrased as "About N minutes of your time" or "No effort needed from you right now."
- **Why I believe this** — reuses `lib/recommendation-presentation/confidenceLabels.ts`'s existing `confidenceExplanation()`/`confidenceLabelText()` functions when a real confidence label exists; otherwise an honest fallback ("This is the clearest next step based on where things stand today.") — never a fabricated confidence claim.

**No new recommendation logic was written.** `buildGrowthAdvisorBriefing.ts` computes zero scores or decisions — everything traces back to a value Marketing Director or Recommendation Presentation already produced.

### Primary action

One button, sourced from `HeadOfMarketingBriefing.primaryAction` — the same single CTA the rest of the product already agrees on. `GrowthAdvisorPrimaryAction` (`components/dashboard/growth-advisor/primary-action.tsx`) fires `primary_action_selected`, and additionally fires `recommendation_accepted` when the action kind implies acting on the shown recommendation (`review_recommendation`/`approve_weekly_package`) — one physical button, two semantically accurate analytics events.

### Supporting context

Everything else, positioned below the primary action in `components/dashboard/growth-advisor/supporting-context.tsx`: Marketing Health (now a single line + badge, not a hero card), the customer confidence/trust strip, proactive-presence celebrations, the full Executive Brief, Monthly Focus, Why the Plan Changed, the Strategic Calendar preview, Campaigns, Experiments, the Ask panel, Recent Activity (the Journal), and a collapsed "More tools" link list. **None of this is new** — every one of these components already existed and was already tested; they were relocated from the old page's flat, competing card stack into one clearly-labeled "Supporting context" region, exactly the reuse `SCOPE_BOUNDARIES.md`'s "understanding, not operating" test asks for.

---

## Marketing Memory / continuity

The advisor references real prior work in two places, both already-existing, real data — never invented:

1. **`relationshipMemory`** (`HeadOfMarketingBriefing.relationshipMemory`, built by `buildRelationshipMemory()` in `weeklyBriefing.ts`) — a real sentence derived from the account's actual creation date ("Since we began working together in March, I've been building on what we already know."). Surfaced directly under "What changed."
2. **The Journal's `relationshipPrefix()`** — day-labeled entries in Supporting Context's "Recent Activity" section, narrating real prior work, not a notification log.

**A genuine "since your last visit" tracker also exists and was kept**: `CustomerConfidencePanel` reads/writes a real `localStorage` timestamp (`LAST_VISIT_STORAGE_KEY`) client-side and computes `buildSinceLastVisitItems()` from it — this is the actual mechanism behind "since your last visit" language, relocated (unchanged) into Supporting Context.

No new "last visit" tracking, no invented history, no session log was built for this sprint.

---

## Empty states

| State | Where it's handled | Behavior |
|---|---|---|
| New customer | `app/dashboard/page.tsx` → `FirstDaysHome` (unchanged component, renamed header text) | Calm setup checklist, no Marketing Health/Journal/recommendation — those engines are genuinely absent for a brand-new account, never faked. |
| Returning customer, setup incomplete | `SetupHomReadinessPanel` (unchanged component, renamed header text) | "A little more setup first" — explicit, honest readiness gate; never invents a briefing when the underlying data isn't there yet. |
| No recommendation | `GrowthAdvisorBriefing.recommendation === null` → "Nothing urgent right now — I'll let you know as soon as something worth your attention comes up." | `emptyStateKind: "no_recommendation"` |
| Disconnected integration (Google not connected) | Routed to `FirstDaysHome`/reflected via `emptyStateKind: "disconnected_integration"` | Never presents `at_risk` Marketing Health as if a real strategic issue occurred — it's the same honest "I need a quick connection" framing as before. |
| No recent activity | `HeadOfMarketingJournalSection`'s own existing empty handling + `emptyStateKind: "no_recent_activity"` | Journal already degrades gracefully for a quiet week — unchanged. |

`GrowthAdvisorEmptyStateKind` (`lib/growth-advisor/types.ts`) exists so a future iteration can render dedicated empty-state copy for each case explicitly; this phase reuses the already-correct behavior of the underlying components rather than duplicating it.

---

## Personalization

Business Discovery (`runBusinessDiscoveryForCurrentUser()`) is now called from `app/dashboard/page.tsx` for the first time — previously unused on this page. Its only effect: when the primary noticed-signals are thin (fewer than 3 real items), the top `growthOpportunities` insight can fill one remaining "What I noticed" slot, worded as "Your business profile: {insight}." It **never** overrides a real signal, never appears when 3 real signals already exist, and the whole call is wrapped in `.catch(() => null)` — a Business Discovery failure never blocks the page. This is the one place this sprint added a genuinely new (if narrow) data source; every other personalization signal reuses what `HeadOfMarketingBriefing` already computed.

---

## Progressive disclosure

- **"Tell me more"** — the recommendation's Expected impact / Estimated effort / Why I believe this are hidden behind this toggle by default; only the title and one-line "why now" show at first glance.
- **"See performance trends →"** — links out to `/dashboard/results` rather than embedding a chart in Supporting Context.
- **Native `<details>`** — every Supporting Context widget (Executive Brief, Journal, More tools) uses the same `<details>`/`<summary>` disclosure pattern already established across this codebase — no new disclosure mechanism was invented.

---

## Marketing Health

Simplified from a two-place presence (a header badge *and* a fully-expanded card inside a collapsed "Supporting detail" block) to a **single line**: a `StatusBadge` plus its one-sentence message, in a plain `bg-[#F8FAFC]` strip at the top of Supporting Context — never a hero element, exactly per this sprint's "supporting information, not the hero" instruction. The full `label`/`message`/`reason` triplet is still available (nothing was removed from the underlying `resolveMarketingHealth()` logic) — only the presentation was flattened.

---

## Navigation

**Changed:** the primary nav's home item is now labeled "Your Growth Advisor" (`components/dashboard/dashboard-nav.tsx`), matching the renamed page. The route (`/dashboard`) and the rest of the four-item primary nav (Results, Library, Settings) are unchanged.

**Not changed, but recommended for a future pass:**
- The "More tools" list embedded directly in `supporting-context.tsx` still duplicates `advancedDashboardNavItems` from `dashboard-nav.tsx` with slightly different labels for the same routes (e.g., "This Week — needs your opinion" vs. nav's "This Week") — this predates this sprint and wasn't touched, but it's worth reconciling into one source of truth.
- `INFORMATION_ARCHITECTURE.md`'s still-open question — whether future "Business" surfaces (Business Brain view, Connector hub) get a new primary nav item or nest under existing items — remains genuinely undecided and is out of scope here.

No full navigation redesign was performed, per this sprint's explicit instruction.

---

## Accessibility

- Skip link (`hom-skip-link`) jumps directly to the primary action, target `id="growth-advisor-primary-action"`.
- Every section uses a real heading (`<h1>`/`<h2>`) with `aria-labelledby` wiring, including a screen-reader-only `<h2>` for "What changed" (visually implicit from the greeting, but still programmatically announced).
- The recommendation's dismiss confirmation uses `role="status"`; the "Tell me more" toggle uses `aria-expanded`.
- All interactive elements carry `min-h-11` (44px minimum tap target) and the established `hom-focusable` focus-visible treatment.
- Reduced-motion: all disclosure animations reuse the existing `.hom-disclose-content`/`prefers-reduced-motion` CSS already defined in `app/globals.css` — no new animation was introduced.
- Confidence/health is never color-only — `StatusBadge` always pairs its tone with a text label.

## Mobile

- The primary action button is full-width (`w-full`) below the `sm:` breakpoint, auto-width above it.
- Supporting Context widgets use native `<details>` — collapsible by default on every viewport, no custom JS toggle needed.
- No horizontal layout depends on a fixed card grid in the hero — it's a single-column vertical read throughout, which is naturally mobile-safe without a separate mobile layout.

## Analytics

`lib/growth-advisor/experienceAnalytics.ts` (server) + `lib/growth-advisor/clientAnalytics.ts` (client, fire-and-forget) + `app/api/growth-advisor/events/route.ts` — mirrors the First Impression funnel's exact pattern (`lib/snapshot-ui/`), but authenticated: the route requires a real session (`401` otherwise) and resolves `tenantUserId`/`businessProfileId` server-side rather than trusting client-supplied IDs.

Events: `growth_advisor_viewed` (page load), `recommendation_expanded`, `recommendation_accepted`, `recommendation_dismissed`, `tell_me_more`, `primary_action_selected`.

**Redaction**: metadata is restricted to `{ section, recommendationId }` — enforced independently on both the client's TypeScript type and the route's runtime allowlist (`sanitizeMetadata`, 80-character cap per value). No conversation content, recommendation titles, or copy is ever logged.

---

## Known limitations

- "Recommendation dismissed" is a **client-side-only** UI action — it hides the card for the current page view and fires the analytics event, but does **not** mutate the underlying recommendation's status in the database. Building a real dismiss-to-database flow was out of scope for a presentation-layer sprint; the existing Approve/Reject flow (Approval Center) remains the actual mutation path.
- No new eval/regression coverage was added for the "What changed" honesty heuristic (`thisWeek.length > 1` as a proxy for "something real happened") beyond the unit tests in this PR — a more precise signal would require threading the raw weekly-wins counts through to this presentation layer, deliberately not done to keep `buildGrowthAdvisorBriefing` a pure, narrow transform over the existing briefing.
- The "More tools" list duplication between `dashboard-nav.tsx` and `supporting-context.tsx` (noted above) predates this sprint and wasn't reconciled.
- No authenticated Playwright coverage (repo-wide limitation, not specific to this feature) — covered instead by unit tests against the real `buildWeeklyBriefing` → `buildGrowthAdvisorBriefing` pipeline and source-level Playwright assertions matching this repo's established convention.

## Recommended next sprint

1. Reconcile the "More tools" duplicate label list into one source of truth.
2. Build a real dismiss-to-database action for "Not now," if product wants dismissal to actually suppress a recommendation from resurfacing rather than just hiding it for the current view.
3. Resolve `INFORMATION_ARCHITECTURE.md`'s open "Business" nav placement question now that Wave II has shipped a real customer-facing surface to anchor the decision against.
4. Consider surfacing a Business Discovery-informed "What I noticed" item even when real signals aren't thin, once there's a product decision about how to rank AI-derived observations against rule-based ones (deliberately not done here to avoid a second, competing prioritization concept).

---

## Product Decision Filter — verified

| Question | Answer |
|---|---|
| Simplifies the experience? | Yes — one conversational read replaces a stack of 6+ competing cards; nothing new to learn, several things removed from the primary view. |
| Increases trust? | Yes — every recommendation now visibly states why now/impact/effort/confidence in one place, and Marketing Health's one-line honesty replaces a more elaborate (but not more truthful) card. |
| Helps the business grow? | Yes — a single, clear recommendation with real reasoning is more actionable than a wall of context the owner has to synthesize themselves. |
| Preserves conversation-first design? | Yes — the entire hero is prose and short lists; the first chart-or-card-shaped element appears only after the primary action, in Supporting Context. |
| Makes the advisor feel attentive? | Yes — "What changed," relationship memory, and the real since-last-visit tracker all say, honestly, "I've been paying attention," never a fabricated familiarity claim. |

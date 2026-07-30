# Google Search Console Integration

**Status:** Shipped (first live Website & Search connection)
**Branch:** `project-magic/google-search-console-integration`
**Cron gate:** `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains **false** — untouched

The purpose of this integration is not to display Search Console metrics. The
purpose is to improve the Business Brain — so Growth Advisor observations and
Weekly Growth Plans get sharper, evidence-backed, and never fabricated.

Companion docs: [`BUSINESS_CONNECTIONS.md`](./BUSINESS_CONNECTIONS.md) ·
[`GROWTH_ADVISOR_EXPERIENCE.md`](./GROWTH_ADVISOR_EXPERIENCE.md)

---

## Architecture

Search Console reuses the existing Business Connections, External Intelligence,
Growth Advisor, and Weekly Growth Plan architecture end to end — it does not
introduce a second connection model, a second insight format, or a second
evidence pipeline.

```
lib/google-search-console/
  oauth.ts          OAuth scopes + state, reusing the shared Google OAuth app
  config.ts         (reused from lib/google-business-profile/config.ts)
  types.ts          Connection / property / metric row shapes
  persistence.ts     CRUD against google_search_console_* tables (tenant-scoped)
  auth.ts           Access-token resolution + refresh (mirrors lib/google-business/auth.ts)
  api.ts            Thin fetch wrappers over the Search Console v3 REST API
  service.ts        OAuth orchestration, property discovery/selection, disconnect
  sync.ts           Fetches + stores a current/previous period comparison
  normalize.ts       Pure functions: metric rows -> ProviderSignalInput[]
  dashboard.ts       Manage-page data (connection health + Business Brain preview)
```

Everything downstream of `normalize.ts` is existing, unmodified architecture:

```
google_search_console_metrics (current + previous period)
        |  normalize.ts (rising/declining/gaining/losing/opportunity/seasonal)
        v
ProviderSignalInput[]  --  lib/external-intelligence/providers/designed.ts
        |                  (createSearchConsoleProvider — the only new provider)
        v
getExternalIntelligence()  --  already called from app/dashboard/page.tsx
        |
        v
ExternalIntelligence.searchDemandTrends
        |            \
        v             v
buildGrowthAdvisorBriefing   buildWeeklyGrowthPlan (lib/growth-planner/evidence.ts
(lib/growth-advisor/          already had an `ei.searchDemandTrends` branch —
 observations.ts already        this sprint is the first time it ever receives
 has a generic top-insight       real signals instead of empty test fixtures)
 observation over any
 ExternalIntelligence source)
```

Because `getExternalIntelligence()` already defaulted to
`createDesignedExternalProviders()` (which already listed a Search Console
provider id) and `app/dashboard/page.tsx` already awaited it and threaded the
result into both Growth Advisor and the Weekly Growth Plan, implementing
`createSearchConsoleProvider()` for real was the only change needed to make
Search Console evidence flow through the whole product — no changes to
`buildGrowthAdvisorBriefing.ts`, `buildWeeklyGrowthPlan.ts`, or
`app/dashboard/page.tsx` were required.

## Business Connections

Search Console was previously a `catalog.ts` placeholder
(`implementation: "placeholder"`, `connectHref: null`) reserved under the
`website_and_search` category with provider id `google_search_console` and
capability `search_performance`. This sprint:

- Flips the catalog entry to `implementation: "live"` with real
  `connectHref`/`manageHref` values.
- Adds `resolveSearchConsole` to `lib/business-connections/resolve.ts`
  (mirrors `resolveGbp`): connected+scopes-valid+property-selected -> healthy;
  expired/revoked/missing-scopes/no-property-selected -> needs attention;
  otherwise not connected.
- Adds the search-console signals to `getBusinessConnectionsSnapshotForCurrentUser`
  (`lib/business-connections/service.ts`), fetched alongside the existing GBP
  and website-analysis signals.

No changes to the Business Connections page component, readiness spec list, or
recommendation logic were needed — both already read capability-level state
generically.

## OAuth flow

Search Console reuses the **same Google Cloud OAuth client** (`GOOGLE_CLIENT_ID`
/ `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI`) as Google Business Profile —
one OAuth app, two independently-connectable scopes. It does **not** reuse the
Business Profile *connection* — Search Console has its own
`google_search_console_connections` row, so a customer can connect/disconnect
either independently.

1. `GET /api/google-search-console/connect` — auth + config checks, sets an
   httpOnly `gsc_oauth_state` cookie (10 min TTL), redirects to Google's
   consent screen requesting `webmasters.readonly` (+ identity scopes).
2. `GET /api/google-search-console/callback` — validates state/cookie/user
   match, exchanges the code, stores the encrypted tokens, and immediately
   discovers available properties (`sites.list`), auto-selecting when there is
   exactly one verified site.
3. Property selection: `GET/POST /api/google-search-console/properties` lists
   / re-discovers sites; `POST /api/google-search-console/properties/select`
   sets the chosen `site_url` on the connection.
4. Sync: `POST /api/google-search-console/sync` queues a
   `google_search_console_sync` background job (mirrors the existing GBP sync
   job) that fetches a current 28-day period (offset 3 days for Search
   Console's normal data-finalization lag) and the 28 days before that,
   grouped by query and by page, and stores both as
   `google_search_console_metrics` rows.
5. Reconnect: re-running step 1 re-consents and re-upserts the same connection
   row (`onConflict: "user_id"`).
6. Disconnect: `POST /api/google-search-console/disconnect` **deletes** the
   connection row outright (real token removal — not a UI-only stub).

Connection health resolution (`getGoogleSearchConsoleConnectionStatusForUser`)
mirrors the Google Business Profile pattern exactly: cheap local checks first
(config, stored connection status, stored scopes), then a cached live-token
verification (reusing the existing generic `verifyGoogleAccessTokenLive`
tokeninfo check, 5-minute TTL), then a real refresh attempt as the single
source of truth for "still valid" vs. "revoked."

## Normalization

`lib/google-search-console/normalize.ts` turns two stored periods of
Search Analytics rows (current vs. previous, by query and by page) into
`ProviderSignalInput[]` — the same shape every other External Intelligence
provider produces. Six kinds of signal, each a plain, checkable comparison
(never an inferred cause):

| Kind | Rule |
|---|---|
| Rising query | current clicks >= 1.5x previous (minimum 3 clicks) |
| Declining query | current clicks <= 0.5x previous (previous had >= 3 clicks) |
| Possible seasonal/trend shift | current clicks >= 3x previous, or newly appeared this period — phrased as "may reflect," never asserted |
| Page gaining visibility | impressions grew >= 1.5x, or average position improved by 2+ |
| Page losing visibility | impressions fell to <= 0.5x, or average position worsened by 3+ |
| Search opportunity | >= 50 impressions with <= 2% CTR — visible in search, not chosen |

`buildSearchConsoleSignals` returns `[]` whenever the two periods are
identical or there isn't enough evidence — it never invents a trend. This is
exactly what `createSearchConsoleProvider()` (in
`lib/external-intelligence/providers/designed.ts`) calls, after checking the
connection is live and a property is selected; any read failure or absence of
data returns empty signals with an honest note, never a fabricated insight.

## Business Brain contribution

Every Search Console signal enters `ExternalIntelligenceCategories.SEARCH_DEMAND_TRENDS`
— an existing bucket. From there, unmodified existing code:

- **Growth Advisor** (`lib/growth-advisor/observations.ts::externalIntelligenceObservation`)
  surfaces the top-confidence insight as an "I noticed" observation, tagged
  `evidence_source: external_intelligence:search_demand_trends`, and Growth
  Advisor's Known/Learning/Waiting vocabulary and trust levels
  (Observed/Likely/Predicted/Suggested) apply exactly as they do to every
  other evidence source — nothing here fabricates a "Recommended" conclusion
  the underlying rule didn't produce. The mission's worked example —
  *Observed: organic visibility increased for "emergency plumber." Likely:
  search demand is increasing. Recommended: publish additional emergency
  plumbing content.* — is produced this way: the "Observed" line comes
  verbatim from a `rising_query` signal's summary, "Likely" comes from
  Growth Advisor's own trust-level phrasing (not from this module), and
  "Recommended" comes from a real action hint on that signal, not an
  invented one.
- **Weekly Growth Plan** (`lib/growth-planner/evidence.ts::synthesizePlanEvidence`)
  already had an `ei.searchDemandTrends.length > 0` branch (an `else if` after
  seasonal opportunities and competitor activity) that turns the top signal
  into a `PlanEvidenceItem` with `source: "external_intelligence"` and
  certainty `Likely`. Search Console is supporting evidence in that branch —
  never the sole driver of `primaryObjective`, `expectedImpact`, or
  `whatIllWatch`, which continue to weigh Business Discovery, goals, and
  Customer Voice as they did before this sprint.

## Business Connections (once connected)

`/dashboard/search-console` shows connection health (status, selected
property, last synced) and a live preview of what it's currently contributing
to the Business Brain — reusing the exact same `normalize.ts` output the
External Intelligence provider computes, so the manage page and the actual
evidence Growth Advisor sees are guaranteed to match.

## Empty states

Search Console's empty states are calm and explain *why*, never implying an
error:

- **Not connected:** explains what the Growth Advisor will learn once
  connected (rising/declining queries, page visibility, opportunities,
  seasonal shifts) — never a blocking gate.
- **Connected, no property selected:** "select a property" prompt, not an
  error state.
- **Connected, no data yet:** explains that Google Search Console usually
  takes 2-3 days to finalize new data and that a newly connected property
  needs time to build history — this is a known, real Search Console
  characteristic, not a fabricated excuse.
- **Connected, synced, nothing notable:** "search performance is steady" —
  explicitly framed as a fine, calm result, not a missing feature.

## Security

- Follows the existing Google OAuth pattern exactly: `access_type=offline`,
  `prompt=consent`, httpOnly state cookie, state/user binding checked on
  callback.
- Tokens are encrypted at rest with the existing
  `lib/security/token-encryption.ts` (AES-256-GCM) — never a new encryption
  scheme, never a real secret in source or tests (unit tests use a
  deterministic non-production key, e.g. `"1".repeat(64)`).
- Requests only `webmasters.readonly` (plus identity scopes) — Search Console
  can never publish, modify, or delete anything through this connection.
- Every table (`google_search_console_connections`, `_properties`, `_metrics`,
  `_sync_log`) enables RLS scoped to `auth.uid() = user_id`, matching every
  other Google integration table in this repo.
- Client-facing components never render `TOKEN_ENCRYPTION_KEY`,
  `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, or encrypted token columns —
  enforced by a Playwright source assertion, same as the Google Business
  Profile connect page.
- Disconnect performs a real delete of the connection row (and its discovered
  properties cascade with it) — this sprint also closes the pre-existing gap
  where Google Business Profile's own "Disconnect" button was UI-only; Search
  Console's is real from the start.

## Future extensions

- Extend `normalize.ts`'s "possible seasonal shift" heuristic with a true
  year-over-year comparison once a connected property has 12+ months of
  stored history (today it only compares two 28-day windows).
- Surface Search Console evidence explicitly in the Weekly Growth Plan's
  "what I'll watch" section (today it only reaches `whatIllWatch` indirectly
  via the generic evidence-to-plan pipeline).
- Location/site-level segmentation for multi-property businesses (today one
  connection selects exactly one property).
- A dedicated Guided Setup milestone for Search Console specifically, rather
  than folding into the existing `website_understanding` milestone via the
  shared `website_and_search` connection category.

## Commands used to validate this sprint

```
npm run test:unit
CI=true NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... npm run test:e2e
npm run lint
npx tsc --noEmit
NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... npm run build
```

No Supabase Edge Functions or Deno tooling exist in this repo (confirmed during
the prior CI-baseline sprint); the only Edge-runtime code is `middleware.ts`,
unaffected by this feature and already covered by the existing
unauthenticated-redirect Playwright tests.

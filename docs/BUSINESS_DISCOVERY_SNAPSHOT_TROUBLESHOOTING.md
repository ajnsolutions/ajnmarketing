# Business Discovery Snapshot — Troubleshooting Guide

**Status:** Written after a release-blocking investigation (production 404 on `/snapshot`, homepage missing "Scan My Business")
**Companion docs:** `docs/BUSINESS_DISCOVERY_FIRST_IMPRESSION.md` (UX), `docs/BUSINESS_DISCOVERY_PUBLIC_SNAPSHOT.md` (backend contract), `docs/LAUNCH_CHECKLIST.md` (broader env var checklist)

---

## The incident, in one sentence

PR #74–#78 were each merged on GitHub ("MERGED" status), but only into a **stacked intermediate branch** (`project-magic/2-0-wave1-business-discovery` → `project-magic/2-0-wave1-snapshot-continuation`) that was **never itself merged into `main`**. Production deploys from `main`. `main` only ever received PR #73 (a backend-only orchestration foundation with no UI). Every file the Snapshot experience actually needs — `app/snapshot/`, the API routes, `HomeScanCta`, the Growth Advisor page — existed and worked correctly on the stacked branch the whole time, but never reached the branch production actually builds from.

**Lesson for future stacked-PR chains:** "MERGED" on GitHub only tells you the PR reached its own *base* branch. If that base branch isn't `main` (or whatever branch your deployment platform builds from), the change has not shipped, no matter how many PRs show a purple "Merged" badge. Always check `git merge-base --is-ancestor <branch> origin/main` before considering a stacked chain done.

---

## Local setup

1. Copy `.env.example` to `.env.local` and fill in real values (see [Required environment variables](#required-environment-variables) below).
2. `npm install`
3. `npm run dev`
4. Open **`http://localhost:3000`** — not a LAN IP (see [LAN IP / mobile testing](#lan-ip--mobile-testing-a-known-gotcha) below for why).

## Restart instructions

Kill any existing dev server before testing a fix — a stale server can be running older code, have a stale in-memory rate-limit bucket, or hold a stale Snapshot cache entry:

```bash
# Find and stop anything on port 3000
lsof -i :3000 -sTCP:LISTEN
kill <pid>

# Start fresh
npm run dev
```

Restarting also clears two in-memory, single-node stores that can otherwise make a retest look like it's "still failing" when it's actually fixed:
- The public Snapshot result cache (`lib/business-discovery/public/cache.ts`, 15-minute TTL, keyed by `sha256(url)`) — a second scan of the same URL within 15 minutes returns the cached result almost instantly, which is correct behavior, not a bug, but can be confusing when debugging.
- The anonymous rate limiter (`lib/interactive-demo/rate-limit.ts`, in-memory `Map`, resets on process restart) — 5 scans/hour/IP for `/api/business-discovery/snapshot`.

## Valid test URLs

| URL | Expected result |
|---|---|
| `http://localhost:3000/` | Homepage, including the "Scan My Business" entry point (`HomeScanCta`) below the hero |
| `http://localhost:3000/snapshot` | The full Snapshot experience — entry form |
| `http://localhost:3000/snapshot?url=https://example.com` | Same, with the website field pre-filled |

## Expected responses / common status codes for `POST /api/business-discovery/snapshot`

| Status | Meaning | When it happens |
|---|---|---|
| `200` | Success | Includes a `result` object. May have `degraded: true` if an AI provider step timed out or wasn't configured — this is a designed fallback, not a bug (see [Degraded results](#degraded-results-are-by-design) below). |
| `400` | Validation failed / blocked URL | Malformed request body, missing `websiteUrl`, or the URL resolves to a private/loopback/metadata address (SSRF protection — see `lib/business-discovery/public/urlSafety.ts`). |
| `413` | Request body too large | Over `PUBLIC_SNAPSHOT_MAX_REQUEST_BYTES`. |
| `415` | Wrong content type | Request wasn't `application/json`. |
| `429` | Rate limited | More than 5 scans/hour from the same IP. Check the `Retry-After` header. Restarting the dev server also resets this locally. |
| `502` | Upstream unavailable | The target website itself failed to respond in a way that wasn't a plain timeout. |
| `504` | Timeout | Fetching the target website took too long (10s fetch timeout) or the overall public-discovery pipeline exceeded its budget. |
| `500` | Internal error | Unhandled exception — check server logs for `[PublicBusinessDiscovery] Unhandled error`. Never leaks the raw error/stack to the client by design. |

### Degraded results are by design

The Snapshot pipeline never fails outright just because an AI provider is slow or unconfigured. `lib/business-discovery/public/service.ts` runs website extraction and AI Marketing Profile synthesis with a **20-second timeout each** (`EXTRACTION_TIMEOUT_MS`, `AI_PROFILE_TIMEOUT_MS`); on timeout, missing configuration, or any thrown error, each step falls back to a deterministic, non-AI placeholder generator and the result is marked `degraded: true`. The visitor still gets a complete, usable Snapshot — just with less specific AI-derived content, and an honest "We learned part of your business" notice. **A `degraded: true` result is a success, not a failure** — confirmed during this investigation via `unit-tests/business-discovery-public-service-degraded-path.test.ts`, which forces `OPENAI_API_KEY` unset and asserts the full pipeline still returns a well-formed result.

If a real scan seems to "hang," check the server terminal for a `public_business_discovery.discovery_partial` log line with a `durationMs` — that's this fallback working as intended, typically triggered by real-world OpenAI latency (each of the two AI-backed steps can legitimately take up to ~20s under load).

## Required environment variables

See `.env.example` for the full list with detailed comments. For the public Snapshot flow specifically:

| Variable | Required locally | Required in Vercel | Public/server | If missing | Validated |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Yes | Public | **Every page fails**, not just `/snapshot` — `middleware.ts` runs on every request and calls `createServerClient()` unconditionally, which throws synchronously if this is empty. | Request time (every request, via middleware) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Yes | Public | Same as above — middleware throws on every request. | Request time (every request, via middleware) |
| `OPENAI_API_KEY` | Recommended | Recommended | Server-only | Snapshot flow **still works** — every scan returns `degraded: true` results from the deterministic placeholder generators instead of AI-derived content. Never crashes, never blocks the request. | Request time, lazily, non-fatal (`isOpenAiConfigured()` checked per-request, not at startup) |

The Snapshot's own business logic (`lib/business-discovery/public/service.ts`) never imports Supabase — by design, nothing about an anonymous scan touches the database. But the app-wide `middleware.ts` still requires the two `NEXT_PUBLIC_SUPABASE_*` variables to be present for **any** route (including `/snapshot`) to load without a 500, since it runs before any page-specific code.

Variables **not required** for the Snapshot flow specifically (but required elsewhere in the app — see `.env.example`/`docs/LAUNCH_CHECKLIST.md` for the full picture): `SUPABASE_SECRET_KEY`, `TOKEN_ENCRYPTION_KEY`, `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REDIRECT_URI`, `TRIGGER_PROJECT_REF`/`TRIGGER_SECRET_KEY`, `ADMIN_USER_IDS`.

## LAN IP / mobile testing: a known gotcha

Testing the dev server from another device on your network (e.g. `http://10.0.0.160:3000`, a phone) requires that address to be in `next.config.ts`'s `allowedDevOrigins`. **Next.js dev mode blocks cross-origin HMR/dev-asset requests from any origin not in that list** — and when that happens, client-side hydration fails *completely* (not partially): no React event handler attaches to anything on the page, including the Snapshot form's submit button. The button click either does nothing or falls back to a native, non-JavaScript HTML form submission, which never calls the API at all. In the browser console this shows up as repeated `ws://<your-lan-ip>/_next/webpack-hmr` connection failures — that console noise is a **symptom** of the blocked origin, not an unrelated dev annoyance, and not the Snapshot backend's fault.

`next.config.ts` currently allowlists `127.0.0.1`, `localhost`, and `10.0.0.160` (a common home/office-router-assigned address, added after this investigation). **If your LAN IP is different, add it locally** — this can't be fully generalized in shared config since every developer's network assigns a different address. This has no bearing on production or on any security boundary (SSRF/DNS-pinning/redirect/TLS validation are all request-time checks inside `lib/business-discovery/public/`, completely unrelated to `allowedDevOrigins`, which only governs the dev server's own HMR asset serving).

**Always confirm a fix using `http://localhost:3000` first.** If it works there but not via a LAN IP, this is almost certainly the cause — add your IP to `allowedDevOrigins` rather than assuming a backend bug.

## Production verification

Before declaring `/snapshot` fixed in production:

1. **Confirm the branch that actually deployed contains the route.** `git log --oneline <deployed-branch> | grep -i snapshot`, or simpler: `git merge-base --is-ancestor <feature-branch> origin/main` before assuming a stacked PR chain shipped anything.
2. **Confirm the production build actually produced the route.** `npm run build` locally against the same commit and check the route table in the build output for `○ /snapshot`, `ƒ /api/business-discovery/snapshot`, the three continuation routes, and `ƒ /dashboard`.
3. **Check the actual deployed commit SHA** in the Vercel dashboard (Deployments → the production deployment → "Source") against `git log origin/main` — a stale deployment pinned to an old commit looks identical to a missing route from the outside.
4. Hit the live URL directly: `curl -s -o /dev/null -w "%{http_code}\n" https://<your-domain>/snapshot` — expect `200`.

## Vercel setup (manual actions — not performed by this investigation)

This investigation intentionally did **not** change any Vercel project settings. The following are documented for a human operator to verify/action:

- **Confirm Vercel's "Production Branch" is set to `main`** (Project Settings → Git). If it's set to something else, that changes which branch this whole investigation applies to.
- **Once the PR from this investigation is reviewed and merged to `main`, trigger (or wait for) a new production deployment.** Merging alone doesn't retroactively fix an already-stale deployment — Vercel needs to build the new `main` commit.
- **Verify all required environment variables are set for the Production environment specifically** in Vercel (Project Settings → Environment Variables) — Vercel scopes variables per environment (Production/Preview/Development), and a variable set only for Preview will not be available in Production.
- **After the new deployment completes, re-run the production verification steps above.**

## Safe troubleshooting checklist

When `/snapshot` or the homepage CTA appears broken, work through these in order — cheapest/safest first:

1. `git branch --show-current` and `git log --oneline -5` — are you even looking at a branch/commit that has the feature?
2. `git merge-base --is-ancestor <this-branch> origin/main` — for a *deployed* environment, has this branch's content actually reached the branch that environment builds from?
3. Restart the dev server (clears stale in-memory caches/rate-limits — see above).
4. Test via `http://localhost:3000`, not a LAN IP.
5. Check the terminal output for `[PublicBusinessDiscovery] Unhandled error` or any `[Workflow]` log with `result: 'error'` / a non-null `failureCategory`.
6. Check environment variables are set (names only — see the table above) with `grep -oE "^[A-Z_]+=" .env.local`.
7. Only after the above: suspect an actual code regression, and reproduce with a direct `curl` to the API route to separate "backend broken" from "frontend/hydration broken" (a raw `curl -X POST .../api/business-discovery/snapshot` bypasses the browser entirely).

**Never** as a first response: weaken SSRF/DNS-pinning/redirect/TLS validation, replace the hardened pinned-request fetch with a plain `fetch()`, or disable rate limiting — none of these are legitimate fixes for a routing, deployment, or environment problem, and all of them reduce real security guarantees documented in `docs/BUSINESS_DISCOVERY_CONTINUATION.md` and `docs/BUSINESS_DISCOVERY_PUBLIC_SNAPSHOT.md`.

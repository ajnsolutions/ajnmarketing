# Interactive AI Marketing Demo

**Route:** `/ai-demo`  
**API:** `POST /api/interactive-demo`  
**Events:** `POST /api/interactive-demo/events`  
**Orchestration:** `lib/interactive-demo/`

---

## Purpose

Let a visitor experience what AJN Marketing would do for their business before signup — website snapshot, marketing profile, recommendations, example content, and weekly approval workflow — in roughly under a minute.

This is **not** an SEO checker and does **not** invent letter grades or fake metrics.

---

## Architecture

```
Browser (AiDemoFlow)
    ↓ POST /api/interactive-demo
IP rate limit + URL safety
    ↓
lib/interactive-demo/orchestrate.ts
    ├─ analyze.ts      → fetchWebsiteContent + createWebsiteExtractor
    ├─ profile.ts      → AiMarketingProfile generator (OpenAI or placeholder)
    ├─ recommendations.ts → synthetic opportunities → decisionEngine + PR #29 presentation
    ├─ content.ts      → createContentGenerator (examples only; no approvals)
    └─ cache.ts        → 15-minute URL hash cache
```

No service-role client. No tenant DB writes for anonymous visitors. Ephemeral stub IDs only.

---

## Reuse strategy

| Capability | Reused module | Notes |
|---|---|---|
| Website analysis | `lib/website-analysis/fetcher.ts`, `extractor.ts` | Pure path; placeholder extractor if no OpenAI |
| Marketing profile | `lib/ai-marketing-profile/*` | Generator only; placeholder fallback |
| Recommendations | `decisionEngine.buildMarketingRecommendationDrafts`, `formatRecommendedActionType`, `getExpectedBenefit`, `translateOpportunityCategoryReasons` | Opportunities synthesized from live extraction signals |
| Content | `lib/content-generator/generator.ts` | Examples only; never creates approvals |
| Weekly workflow | Static truthful copy aligned with product | |

---

## Rate limiting & abuse protection

- **5 demos / IP / hour** on `POST /api/interactive-demo`
- Event endpoint throttled separately (60/hour)
- Blocks localhost / private / link-local hosts (SSRF guard)
- Response caching by website URL hash (15 minutes)
- Does not expose service-role operations

---

## Visitor flow

1. Enter website (optional name / industry / city / state)
2. Progress UI while server analyzes
3. Website snapshot (live findings)
4. Marketing snapshot (generated profile)
5. Top 3 recommendations (client-friendly)
6. Example content (explicitly labeled)
7. Weekly workflow
8. CTA → `/signup` or `/pricing`

Anonymous funnel events: `demo_started`, `demo_completed`, `cta_clicked`.

---

## Future enhancements

- Streaming / staged responses for faster first paint
- Redis-backed distributed rate limits
- Optional lead capture without requiring email up front
- GBP-aware demo once a visitor connects Google after signup
- Agency-specific demo variant

---

## Known limitations

- Content examples require `OPENAI_API_KEY`; otherwise recommendations + website/profile snapshots still return
- In-memory rate limit / cache are per-instance (not multi-region)
- Synthetic opportunities are grounded in extraction text, not live GBP/review API data
- Previous simulated `demo-content.ts` templates were removed
- `/demo` remains a separate human-led demo request form

# Project Magic 2.0 — Customer Types

**Companion to:** [`CUSTOMER_JOURNEYS.md`](./CUSTOMER_JOURNEYS.md) · [`../CUSTOMER_JOURNEYS.md`](../CUSTOMER_JOURNEYS.md) (1.0 persona tables, still valid for local/online detail)

Project Magic 1.0 defined **local** and **online** business personas in detail. 2.0 keeps both, unchanged in spirit, and adds a third type the current model doesn't yet fit cleanly: **platform businesses**, whose primary digital presence is a profile AJN itself hosts rather than an independent website.

---

## 1. Local businesses

**Examples:** HVAC, dentist, restaurant, attorney, landscaper, insurance agency, salon, auto repair.

**Defining trait:** Discovered by proximity and trust. A customer searching for "[service] near me" chooses based on Google Business Profile accuracy, review quality and recency, and how quickly the business responds.

**Primary digital presence:** An owned website (often thin) + Google Business Profile (the real front door).

**What the Business Brain prioritizes:**
- Google Business Profile health and posting cadence
- Review velocity, sentiment, and reply latency (see [`CUSTOMER_VOICE.md`](./CUSTOMER_VOICE.md))
- Local competitor set and service-area seasonality (see [`MARKET_RADAR.md`](./MARKET_RADAR.md), [`SEASONAL_INTELLIGENCE.md`](./SEASONAL_INTELLIGENCE.md))
- Website as a supporting, not primary, signal

**Onboarding emphasis:** Connect Google Business Profile first — it usually matters more than the website. Confirm service area and hours early; these drive everything downstream (seasonal timing, competitor set, local search framing).

**What "growth" means to this type:** More calls, more booked appointments, better reviews, staying visible against nearby competitors.

---

## 2. Digital businesses

**Examples:** SaaS, consultants, agencies, online courses, e-commerce.

**Defining trait:** Discovered by content, search, and referral rather than proximity. Trust is built through consistent presence and demonstrated authority, not a storefront.

**Primary digital presence:** A real website that functions as the storefront, plus owned channels (email list, social, content).

**What the Business Brain prioritizes:**
- Website content quality, consistency, and cadence
- Brand voice and audience clarity (who this is for, what problem it solves)
- Competitive positioning against other digital players, not just proximity-based competitors
- Funnel-relevant signals (traffic sources, conversion moments) where connectable

**Onboarding emphasis:** Brand voice and target audience come first — a digital business's growth depends more on message-market fit than on local visibility. Website analysis carries more onboarding weight than for local businesses.

**What "growth" means to this type:** More qualified leads/signups, clearer authority in a niche, less time spent on content busywork, consistent presence without tool sprawl.

---

## 3. Platform businesses

**Example:** AJN Sports Coaches.

**Defining trait:** The business's primary digital presence is not an independent website — it's a **hosted profile inside a platform AJN operates**. The business doesn't own its own domain, doesn't control its own SEO, and is discovered *within* the platform (search, category browse, referral inside the platform) rather than on the open web.

**Primary digital presence:** The hosted profile page itself — its completeness, its presentation, and its platform-native discoverability signals.

**What the Business Brain prioritizes:**
- Profile completeness and quality (the equivalent of "website analysis," but scoped to the profile schema the platform defines)
- Platform-native engagement signals (profile views, inquiries, bookings) in place of website traffic/GBP data
- Platform messages and booking conversations as the primary Customer Voice source, since there may be no separate review site or call log
- Category/competitive positioning *within the platform*, not the open web

**Onboarding emphasis:** There is no "connect your website" step because there often isn't one. Onboarding starts from the platform profile itself — the Business Brain ingests what's already there and asks the owner to confirm/enrich it, the same way the Free Marketing Snapshot works for a local or digital business, but sourced from platform data instead of a public web crawl.

**What "growth" means to this type:** More inquiries/bookings through the platform, a stronger profile relative to other profiles in the same category, and (where the platform supports it) reputation signals specific to that platform.

**Design implication:** Any part of onboarding, the Business Brain, or the Free Marketing Snapshot that assumes "we can crawl your website" must degrade gracefully to "we can read your platform profile" for this type. This is not an edge case to bolt on later — it's a first-class input path from Wave I (see [`IMPLEMENTATION_ROADMAP.md`](./IMPLEMENTATION_ROADMAP.md)).

---

## How type is determined

Type is inferred, not asked as a blunt multiple-choice question (that would violate [`UX_RULES.md`](./UX_RULES.md)'s one-question-per-screen and plain-language rules). Signals:

- A business connected to AJN via a platform-specific referral or platform-hosted signup flow → **platform business**, profile-first onboarding.
- A business with a real, independently-owned domain and clear service-area language → **local business**, GBP-first onboarding.
- A business with a real, independently-owned domain and no service-area language, or explicit SaaS/consulting/course/e-commerce signals → **digital business**, website/voice-first onboarding.

Type is a *starting emphasis*, not a permanent label — a local business that's also selling an online course, or a digital business that opens a physical location, should be able to pick up the other type's Business Brain inputs without re-onboarding from scratch. The Business Brain is additive by design (see [`BUSINESS_BRAIN.md`](./BUSINESS_BRAIN.md)); type just determines which inputs are asked for first.

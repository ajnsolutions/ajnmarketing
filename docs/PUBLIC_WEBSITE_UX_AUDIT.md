# AJN Marketing — Public Website UX Audit

**Branch:** `audit-public-website-ux` (from latest `main`)  
**Date:** 2026-07-15  
**Scope:** All public/marketing surfaces — `/`, `/how-it-works`, `/pricing`, `/industries`, `/demo`, `/ai-demo`, `/for-agencies`, `/login`, `/signup`, `/forgot-password`, site chrome (header/footer), and default 404. Authenticated `/dashboard/**` and `/onboarding` are out of scope except where public CTAs hand off into them.  
**Companions:** [`PUBLIC_PAGE_INVENTORY.md`](./PUBLIC_PAGE_INVENTORY.md) · [`PUBLIC_UX_IMPLEMENTATION_PLAN.md`](./PUBLIC_UX_IMPLEMENTATION_PLAN.md)

---

## 1. Executive Summary

The public site has a **clear audience** (local trades / service businesses), a **coherent primary CTA** (free demo → `/demo`), and strong done-for-you + approval messaging on How It Works and Pricing. It is **not launch-complete** as a trust and conversion surface:

- Legal/about/contact pages listed in the original brief **do not exist**; the footer previously linked them to `#` (fixed on this branch to real routes + honest “coming soon” note).
- Homepage hero leads with outcome slogans (“More Visibility / More Calls / More Customers”) rather than the canonical tagline in `lib/site-content.ts` (“We make sure your town finds you on Google — and you don't have to do anything”), so the five-second “what is this / who is it for / why different” test is only partly passed.
- Pre-launch **social proof claimed unverifiable scale** (250+ businesses, 4.9★ / 128+ reviews, avatar initials). Softened on this branch to product-true trust signals (weekly approval, GBP focus, 90-day guarantee). Named testimonials remain generic and should be replaced with real case studies before broad acquisition spend.
- **SEO foundations are thin:** root title/description only; no Open Graph / Twitter cards, no `robots.ts` / `sitemap.ts`, no JSON-LD, no dedicated Features / About / Contact / FAQ / legal routes.
- **Business-plan differentiators** Market Context and Learning are product concepts with almost no public-site presence; weekly human approval and GBP expertise are present but unevenly weighted across pages.

**No P0 security or broken auth/signup paths were found in this pass.** Footer `#` dead links and unverifiable trust stats were the highest-confidence customer-visible defects and received limited fixes here.

### 1.1 Finding counts

| Severity | Count | Definition |
|---|---|---|
| **P0** | **0** | Broken auth/signup, security exposure, or catastrophic SEO (e.g. noindex entire site). None found. |
| **P1** | **8** | Conversion / trust / messaging blockers for launch. |
| **P2** | **12** | Friction, IA gaps, mobile/SEO/a11y gaps. |
| **P3** | **6** | Polish and consistency. |
| **Total** | **26** | |

---

## 2. Methodology and limitations

- Code-and-route review of `app/{page,how-it-works,pricing,industries,demo,ai-demo,for-agencies,login,signup,forgot-password}`, `components/{site-*,home/*,cta-*,pricing-*,final-cta,demo/*}`, and `lib/site-content.ts`.
- **No separate Product & Business Plan file exists in-repo.** Alignment uses the audit brief checklist plus de facto positioning in `lib/site-content.ts`, public pages, and prior website positioning work.
- Playwright today covers **homepage title/H1 only** (`tests/homepage.spec.ts`). No authenticated public-flow e2e beyond that.
- Lighthouse / live multi-viewport browser review should be re-run on the PR preview; this pass used local code inspection + build/test verification.
- Accessibility: inspection only (labels, headings, FAQ `aria-expanded`); no axe/Lighthouse a11y score committed here.

---

## 3. Personas (findings)

| Persona | What works | Where they struggle |
|---|---|---|
| **Small business owner** | How It Works “approve by email/text”; Pricing guarantee; Demo FAQ “we handle it” | Homepage doesn’t lead with done-for-you; missing About/Contact/Privacy; generic testimonials |
| **Contractor (mobile)** | Sticky header; Menu button labeled; short demo FAQ | Dense card grids; demo form styling feels unfinished vs marketing chrome; no sticky mobile CTA bar |
| **Agency owner** | `/for-agencies` exists with white-label story | Not in primary nav; “Partner With Us” dumps into consumer demo form |
| **Search visitor** | Decent title template; industry keywords in Industries meta | No sitemap/OG; Features/FAQ/About missing; H1 is slogan not searchable value prop |

---

## 4. Current information architecture

**Primary nav** (`lib/site-content.ts` → `SiteHeader`): Home · How It Works · Pricing · Industries · Free Demo (+ Log In · CTA).

**Present but not in primary nav:** `/for-agencies`, `/ai-demo`, `/signup`.

**Missing vs brief:** Features, About, Contact, standalone FAQ, Privacy, Terms, Careers, blog.

**Auth (no marketing chrome):** `/login`, `/signup`, `/forgot-password` via `SiteChrome` exclusion.

**404:** Custom `app/not-found.tsx` added on this branch (home + demo CTAs).

---

## 5. Marketing evaluation

| Dimension | Assessment |
|---|---|
| Headline clarity | Outcome-clear, product-unclear on home H1 |
| Subheadline | Strong GBP focus on home |
| Value proposition | Strongest on How It Works + Demo |
| Trust / social proof | Previously overstated; still lacks real logos/case studies |
| Differentiation | Approval + done-for-you present; Market Context / learning absent |
| CTAs | Consistent “See Your Free Demo” → `/demo` (good) |
| Pricing clarity | Three tiers clear; no feature comparison matrix |
| Guarantee | On Pricing + Demo; was missing from home strip (now in stats) |
| Message consistency | Tagline underused vs “More Visibility…” brand voice |

---

## 6. Business plan alignment

| Differentiator | Public site status |
|---|---|
| Local business focus | ✅ Strong (industries, copy) |
| “We handle your marketing” | ✅ How It Works / Demo FAQ; weaker on home H1 |
| Google Business expertise | ✅ Core of home + pricing |
| AI with human approval | ✅ How It Works steps; underplayed on home |
| Weekly approval workflow | ✅ How It Works; reinforced in stats strip (this PR) |
| Reviews | ✅ Features list / pricing includes |
| Market Context | ❌ Essentially absent publicly |
| Learning | ❌ Absent publicly |
| 90-day guarantee | ✅ Pricing + Demo; now also home stats |
| Simplicity | ✅ Strong on How It Works |

**Gap summary:** Market Context and adaptive learning are core product ideas with **no public narrative**. Homepage under-sells approval-gated done-for-you relative to generic “more customers” claims.

---

## 7. Detailed findings

### P1 — High impact (8)

**P1-1 — Footer linked to non-existent About / Contact / Privacy / Terms / Careers + social `#` — ✅ FIXED (limited)**  
Previously all `href="#"`. Company column now points to real routes (`/for-agencies`, `/signup`, `/login`) with honest “legal/about coming soon” note; dead social icons removed.

**P1-2 — Unverifiable social proof on homepage — ✅ FIXED (limited)**  
Removed “250+ / 4.9★ / 128+ reviews” style claims and fake avatar stack; replaced with product-true signals. Named testimonials remain placeholder-quality (**open residual**), including per-card hardcoded ★★★★★ badges in `TestimonialCard` (`components/home/home-sections.tsx`).

**P1-3 — Homepage five-second clarity incomplete — OPEN**  
H1 is a slogan triad; tagline and approval story are secondary. Recommend messaging PR (Plan A) to lead with done-for-you + Google + approval.

**P1-4 — No Privacy / Terms before signup — OPEN**  
Signup/demo collect business/contact PII without linked legal pages — trust and compliance risk for launch acquisition. Kept at P1 (not P0) because no payment/SSN collection occurs on these forms; still required before paid acquisition.

**P1-5 — No About / Contact / real founder credibility — OPEN**  
Agency and owner personas cannot verify who is behind AJN.

**P1-6 — Features page missing; product surface under-explained — OPEN**  
Capabilities live in `site-content.features` but are not a first-class Features route or home section that maps 1:1 to the product (Approvals, GBP, Reviews, Market Context).

**P1-7 — Agency path conflated with consumer demo — OPEN**  
`/for-agencies` CTA uses same `/demo` form fields (business website, etc.) without partner intent capture.

**P1-8 — SEO foundation incomplete for acquisition — OPEN**  
No sitemap/robots/OG/JSON-LD; homepage relies on root metadata only. Not a full “SEO catastrophe,” but insufficient for paid/organic launch.

### P2 — Medium (12)

**P2-1** Nav omits For Agencies / AI Demo / Signup.  
**P2-2** Duplicate demo experiences (`/demo` lead form vs `/ai-demo` interactive preview) without clear relationship.  
**P2-3** Pricing has no comparison table or FAQ (FAQ only on Demo).  
**P2-4** Guarantee terms not detailed (what “visibility improves” means).  
**P2-5** Homepage testimonials lack photos, businesses, cities — read as stock.  
**P2-6** No customer logos / case studies.  
**P2-7** Demo form visual language (`dark:` / zinc borders) inconsistent with marketing system.  
**P2-8** Mobile: no sticky bottom CTA; industries/pricing grids become long scrolls.  
**P2-9** Heading hierarchy: some sections use `SectionHeading` without page-level H1 consistency checks on all routes (generally OK).  
**P2-10** Internal linking weak (home doesn’t deep-link Features/Market Context concepts).  
**P2-11** `FinalCta` on Industries after an in-page CTA creates double-close feel.  
**P2-12** Accessibility: FAQ accordion lacks `aria-controls` / panel ids; focus rings inconsistent; decorative icons mostly `aria-hidden` (good).

### P3 — Low (6)

**P3-1** Card radius/shadow drift between home, pricing, agencies.  
**P3-2** Geist is fine but default-ish vs brand ambition.  
**P3-3** Motion limited to hover translate — opportunity for 2–3 intentional motions.  
**P3-4** Public placeholder SVGs in `/public` unused.  
**P3-5** Auth shells visually disconnected from marketing brand.  
**P3-6** Copy micro-inconsistencies (“Free Demo” vs “See Your Free Demo” vs “Get My Free Demo”).

---

## 8. Conversion analysis

**Primary funnel:** Nav/CTA → `/demo` → `demo_requests` insert via Supabase → success state.

**Strengths:** Single primary CTA destination; Pricing and How It Works reinforce demo; Demo FAQ handles objections.

**Friction:** No legal links near form; no phone/email contact alternate; agency CTA wrong funnel; homepage trust was inflated (now honest but thinner until real proof ships); guarantee not explained on demo form itself.

**Recommendations (see Plan):** Messaging home (A), nav + IA (B), Features storytelling (C), Pricing FAQ/guarantee detail (D), real proof (E), mobile CTA (F), SEO (H).

---

## 9. SEO analysis

| Item | Status |
|---|---|
| Title tags | Partial — template + per-page titles on major routes; home uses root default |
| Meta descriptions | Present on key pages; home uses `tagline` |
| H1 | One per page generally |
| Canonical | Not set |
| Open Graph / Twitter | Missing |
| Structured data | Missing (LocalBusiness / FAQ / Product) |
| Sitemap / robots | Missing |
| Internal links | Nav + footer; thin cross-links |
| Alt text | Logo alts present; hero visual should be verified |
| URL structure | Clean |
| Duplicate content | Low risk; How It Works vs home process overlap is mild |

---

## 10. Accessibility analysis

- Header menu has `aria-label` / `aria-expanded`.
- FAQ uses `aria-expanded` but not full disclosure pattern.
- Focus-visible styling not standardized.
- Color: navy/brand on white generally OK; growth green on white OK — confirm contrast on slate-400 footer text.
- Forms: labels present on demo form; required attributes used.
- No skip-to-content link.

---

## 11. Visual / mobile / performance

**Visual:** Consistent navy/brand/growth tokens in `globals.css`; marketing uses cards heavily (acceptable for product marketing). Dashboard and marketing still feel like adjacent products.

**Mobile:** Sticky header works; hamburger is text “Menu” (clear). Pricing 3-col → stack OK. Hero two-column collapses. Unverified landscape/large-monitor polish.

**Performance:** Next/Image for logos; Geist via `next/font`. Hero marketing visual should be checked for weight. No heavy chart libs on public pages. Client chrome (`SiteChrome`/`SiteHeader`) wraps all marketing pages — necessary for mobile nav state.

---

## 12. Limited fixes in this branch

| Fix | File(s) |
|---|---|
| Remove footer `#` company/social dead ends; link real company routes; note missing legal | `components/site-footer.tsx` |
| Replace unverifiable homepage stats/trust bar with product-true signals | `components/home/stats-strip.tsx`, `hero-trust-bar.tsx` |
| Add branded 404 with recovery CTAs | `app/not-found.tsx` |

**Explicit non-changes:** No marketing redesign; no Feature/About/Privacy pages built; no schedule activation; `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains `false`; no dashboard changes.

---

## 13. Top recommendations (priority)

1. Ship Privacy + Terms + Contact before paid acquisition (P1-4/5).  
2. Homepage messaging pass: lead with done-for-you + approval + GBP (P1-3).  
3. Real testimonials / case studies; retire placeholders (P1-2 residual).  
4. Features page mapping to product capabilities including Market Context (P1-6).  
5. SEO primitives: sitemap, robots, OG, FAQ JSON-LD (P1-8).  
6. Separate agency lead path (P1-7).  
7. Pricing FAQ + guarantee definition (P2-3/4).  
8. Mobile sticky CTA + demo form visual alignment (P2-7/8).

---

## 14. Prioritized roadmap

See [`PUBLIC_UX_IMPLEMENTATION_PLAN.md`](./PUBLIC_UX_IMPLEMENTATION_PLAN.md) — PRs **A–H**.

---

## 15. Verification notes

- Lint, TypeScript, unit tests, production build, Playwright run on this branch.  
- Confirm no Trigger.dev schedule activation and cron gate false.  
- Known limitation: full Lighthouse scores and multi-device visual QA belong on the Vercel preview after PR open.

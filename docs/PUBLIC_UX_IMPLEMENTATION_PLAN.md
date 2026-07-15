# Public UX Implementation Plan

**Companion to:** [`PUBLIC_WEBSITE_UX_AUDIT.md`](./PUBLIC_WEBSITE_UX_AUDIT.md) · [`PUBLIC_PAGE_INVENTORY.md`](./PUBLIC_PAGE_INVENTORY.md)  
**Date:** 2026-07-15 · **Branch:** `audit-public-website-ux`

Sequenced, independently reviewable PRs. **No Trigger.dev schedule activation.** `ATTACH_DECLARATIVE_PRODUCTION_CRONS` stays `false`. No dashboard redesign in these PRs.

---

## Sequencing

1. **A Messaging & homepage** — conversion-critical first impression.  
2. **B Navigation** — surfaces missing paths and clarifies demo vs AI demo.  
3. **C Feature pages** — product storytelling + Market Context.  
4. **D Pricing** — objections and guarantee clarity.  
5. **E Trust & social proof** — legal, about, contact, real proof.  
6. **F Mobile** — contractor persona.  
7. **G Visual polish** — after content stabilizes.  
8. **H SEO** — can parallelize with E after A/B URLs settle.

---

## PR A — Messaging & homepage

**Findings:** P1-3, residual P1-2 (testimonials framing), P3-6.  
**Scope:** Lead H1/subhead with done-for-you + Google + weekly approval; align with `tagline`; keep primary CTA `/demo`; optional one-line guarantee near hero. Do not invent new fake stats.  
**Acceptance:** Five-second test passes in user testing notes; Playwright H1 assertion updated.  
**Risk:** Low–medium (copy-sensitive).

---

## PR B — Navigation

**Findings:** P2-1, P2-2, P1-7 (nav portion).  
**Scope:** Decide nav items for For Agencies and/or AI Demo; footer sync; clarify “Free Demo” vs “AI preview” labels; avoid overcrowding mobile.  
**Acceptance:** No dead nav items; Agencies discoverable.  
**Risk:** Low.

---

## PR C — Feature pages

**Findings:** P1-6, Market Context / Learning gaps, P2-10.  
**Scope:** `/features` (or equivalent) mapping GBP, reviews, approval, reports, and plain-language Market Context; screenshots or honest product UI crops; CTAs to demo.  
**Acceptance:** Features linked from home + nav or footer.  
**Risk:** Medium (needs product-accurate screenshots).

---

## PR D — Pricing

**Findings:** P2-3, P2-4.  
**Scope:** Comparison matrix; pricing FAQ (reuse/extend demo FAQ); define 90-day visibility guarantee terms.  
**Acceptance:** Objection “what’s the difference / what’s guaranteed” answerable on-page.  
**Risk:** Low (legal review for guarantee wording).

---

## PR E — Trust & social proof

**Findings:** P1-4, P1-5, P1-2 residual, P1-7 (form), P2-5, P2-6.  
**Scope:** Privacy, Terms, About, Contact; replace placeholder testimonials with real ones or remove; customer logos if available; agency-specific lead fields or mailto. Link legal from signup + demo form.  
**Acceptance:** Signup/demo link to Privacy/Terms; Contact reachable.  
**Risk:** Medium (legal content, real customer permission).

---

## PR F — Mobile

**Findings:** P2-8, contractor persona.  
**Scope:** Sticky mobile CTA; demo form layout; pricing/industry stacking QA at 375px; menu focus trap optional.  
**Acceptance:** Manual checklist at 375 / 768 / 1024.  
**Risk:** Low.

---

## PR G — Visual polish

**Findings:** P3-1–P3-5, P2-7, P2-11.  
**Scope:** Align demo form + auth shells with marketing tokens; card radius/shadow tokens; 2–3 intentional motions; dedupe final CTAs where noisy.  
**Acceptance:** Visual diff review; no IA changes.  
**Risk:** Low.

---

## PR H — SEO

**Findings:** P1-8, SEO section.  
**Scope:** `app/sitemap.ts`, `app/robots.ts`, Open Graph + Twitter metadata helper, canonical base URL via `NEXT_PUBLIC_SITE_URL`, FAQ JSON-LD on Demo/Pricing, alt-text pass.  
**Acceptance:** Sitemap lists all public indexable routes; OG preview OK in debugger.  
**Risk:** Low.

---

## Summary

| PR | Focus | Closes | Depends on |
|---|---|---|---|
| A | Homepage messaging | P1-3 | — |
| B | Nav / IA | P2-1, P2-2 | — |
| C | Features storytelling | P1-6 | A helpful |
| D | Pricing / guarantee | P2-3, P2-4 | — |
| E | Trust / legal / proof | P1-4, P1-5, P1-2, P1-7 | — |
| F | Mobile | P2-8 | A–D markup |
| G | Visual | P3-*, P2-7 | A–E |
| H | SEO | P1-8 | B URLs; also wait on C if `/features` ships |

**Deferred:** Blog, Careers, multi-location marketing pages, full redesign, dashboard chrome changes.

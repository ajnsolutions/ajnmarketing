# Public Page Inventory

**Companion to:** [`PUBLIC_WEBSITE_UX_AUDIT.md`](./PUBLIC_WEBSITE_UX_AUDIT.md) · [`PUBLIC_UX_IMPLEMENTATION_PLAN.md`](./PUBLIC_UX_IMPLEMENTATION_PLAN.md)  
**Date:** 2026-07-15 · **Branch:** `audit-public-website-ux`

---

## Site chrome

| Surface | Files | Notes | Findings |
|---|---|---|---|
| Header | `components/site-header.tsx`, `lib/site-content.ts` (`navLinks`) | Sticky; desktop center nav; mobile Menu drawer; primary CTA → `/demo` | P2-1 (missing Agencies/AI Demo) |
| Footer | `components/site-footer.tsx` | Pages = navLinks; Company = For Agencies / Signup / Login; legal note | P1-1 fixed |
| Chrome gate | `components/site-chrome.tsx` | Hides header/footer on dashboard, auth, onboarding | OK |

---

## Page inventory

| Route | Purpose | Primary persona | Primary CTA | Secondary CTA | SEO | Accessibility | Recommendation |
|---|---|---|---|---|---|---|---|
| `/` | Acquisition home | Owner, search visitor, contractor | See Your Free Demo → `/demo` | How It Works | Root title + tagline description; no page-level `metadata` export; no OG | H1 present; trust bar text-only after fix | Messaging PR A; add OG; real proof E |
| `/how-it-works` | Explain Scan→Generate→Approve→Publish→Report | Owner | FinalCta → `/demo` | — | Title + description set | Clear H1/H2/H3 structure | Strengthen Market Context / learning in story (C) |
| `/pricing` | Plans $99 / $199 / $299 + guarantee | Owner | Per-card → `/demo` | FinalCta | Title + description | Cards as articles-ish; ✓ decorative | Add comparison + FAQ + guarantee terms (D) |
| `/industries` | Trade-specific landing | Contractor, owner | Get My Free Demo | FinalCta (duplicate close) | Title + description | H2 per industry | Trim double CTA; add deep links (B/C) |
| `/demo` | Lead capture + FAQ + guarantee | Owner, contractor | `#demo-form` / submit | — | Title + description | Form labels OK; FAQ `aria-expanded` partial | Legal links near form; guarantee detail; form visual polish |
| `/ai-demo` | Interactive sample content preview | Curious search visitor | In-flow generate | — | Title + description | Flow-dependent | Clarify vs `/demo` in nav/copy (B) |
| `/for-agencies` | White-label partner pitch | Agency | Partner With Us → `/demo` (consumer form) | FinalCta | Title + description | OK | Dedicated partner lead + nav entry (B, E) |
| `/login` | Auth | Returning customer | Sign in | Links to signup/forgot | Metadata set | Auth shell | Ensure post-login → dashboard (existing) |
| `/signup` | Account create | New customer | Sign up | Login link | Metadata set | Auth shell | Link Privacy/Terms when pages exist (E) |
| `/forgot-password` | Reset | Returning | Submit | Login | Metadata set | Auth shell | OK |
| `/` 404 (`not-found`) | Recovery | Any | Home / Demo | — | N/A | Clear H1 | Added this branch |
| Features | **Missing** | — | — | — | — | — | Create in PR C |
| About | **Missing** | — | — | — | — | — | Create in PR E |
| Contact | **Missing** | — | — | — | — | — | Create in PR E |
| FAQ (standalone) | Only on Demo | — | — | — | — | — | Extract + JSON-LD in D/H |
| Privacy / Terms | **Missing** | — | — | — | — | — | Launch blocker for paid traffic — PR E |
| Blog | **Missing** | — | — | — | — | — | Defer post-launch unless SEO push |

---

## Shared marketing components

| Component | Path | Role |
|---|---|---|
| `CtaButton` | `components/cta-button.tsx` | Default `href=/demo` |
| `FinalCta` | `components/final-cta.tsx` | Closing band |
| `PricingCard` | `components/pricing-card.tsx` | Tier card |
| `SectionHeading` | `components/section-heading.tsx` | Page section titles |
| `HowItWorksSteps` | `components/how-it-works-steps.tsx` | 5-step flow |
| `FeatureGrid` | `components/feature-grid.tsx` | (available; usage verify) |
| Home sections | `components/home/*` | Hero visual, cards, stats, trust |
| Demo FAQ / GBP mock | `components/demo/*` | Demo page support |
| AI demo flow | `components/ai-demo/*` | `/ai-demo` |

---

## Content source of truth

`lib/site-content.ts` — `siteName`, `tagline`, `navLinks`, `howItWorksSteps`, `features`, `pricingTiers`, `targetIndustries`. Prefer editing here for message consistency when executing PR A–D.

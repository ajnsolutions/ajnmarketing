/**
 * Growth opportunity generation — replaces the old fixed 3-item boilerplate
 * fallbacks (`highestRoiImprovements` in website-analysis/extractor.ts,
 * `seasonal_opportunities` in ai-marketing-profile/placeholder-generator.ts)
 * that showed the same 2-3 generic strings to every business regardless of
 * industry, services, or what was actually missing from their site.
 *
 * Every opportunity here is: industry-aware (keyed off the detected
 * IndustryCategoryId), grounded in an actual signal present in `context`
 * (never asserted unconditionally), and phrased as a strategist would give
 * advice — a specific action plus the concrete reason it matters.
 *
 * Priority is expressed purely through return order (highest first) — never
 * as an embedded tag in the string itself. This type (`string[]`) is shared
 * by multiple consumers beyond the First Impression Snapshot UI (the
 * authenticated dashboard's Website Analysis page renders these strings
 * directly, and they get unioned across sources in
 * business-discovery/normalize.ts, which would scramble any per-item tag
 * anyway) — a bracket-style "[High priority]" prefix would leak as literal
 * text into all of those, so ranking lives in ordering, not in the string.
 */

import type { IndustryCategoryId } from "@/lib/business-discovery/industryTaxonomy";

type GrowthOpportunityPriority = "high" | "medium";

export type GrowthOpportunityContext = {
  industry: IndustryCategoryId | null;
  services: string[];
  citiesMentioned: string[];
  seoIssues: string[];
  hasGoogleBusinessProfile: boolean;
  hasReviews: boolean;
};

type OpportunityTemplate = {
  /** Only offered when this returns true for the given context — never unconditional. */
  appliesWhen: (context: GrowthOpportunityContext) => boolean;
  priority: GrowthOpportunityPriority;
  build: (context: GrowthOpportunityContext) => string;
};

const GENERIC_TEMPLATES: OpportunityTemplate[] = [
  {
    appliesWhen: (context) => !context.hasGoogleBusinessProfile,
    priority: "high",
    build: () =>
      "Claim and connect your Google Business Profile — for most local businesses this is the single fastest way to show up in map searches, and you don't have one connected yet.",
  },
  {
    appliesWhen: (context) => !context.hasReviews,
    priority: "high",
    build: () =>
      "Start asking recent customers for reviews — you don't have any public reviews on file yet, and most buyers check reviews before they'll even call.",
  },
  {
    appliesWhen: (context) => context.seoIssues.some((issue) => /meta description/i.test(issue)),
    priority: "medium",
    build: () =>
      "Write real meta descriptions for your top pages — search engines are currently guessing at how to describe your pages to searchers, which usually costs click-through rate.",
  },
  {
    appliesWhen: (context) => context.citiesMentioned.length < 2,
    priority: "medium",
    build: (context) =>
      context.services.length > 0
        ? `Create a dedicated page for the next city or neighborhood you serve, built around ${context.services[0]} — right now your site only clearly speaks to one area.`
        : "Add pages for the specific cities or neighborhoods you serve — right now your site only clearly speaks to one area.",
  },
];

const INDUSTRY_TEMPLATES: Partial<Record<IndustryCategoryId, OpportunityTemplate[]>> = {
  hvac: [
    {
      appliesWhen: (context) => !context.services.some((service) => /maintenance|tune-?up|plan/i.test(service)),
      priority: "high",
      build: () =>
        "Add a maintenance-plan page — HVAC customers who sign up for seasonal tune-ups become repeat revenue instead of one-off emergency calls, and your site doesn't mention a plan today.",
    },
    {
      appliesWhen: () => true,
      priority: "medium",
      build: (context) =>
        `Publish an emergency-repair landing page for ${context.citiesMentioned[0] ?? "your primary service area"} — HVAC searches spike hardest during extreme temperature swings, and being the fastest local result to load wins the call.`,
    },
  ],
  roofing: [
    {
      appliesWhen: () => true,
      priority: "high",
      build: () =>
        "Add a page walking through what a free roof inspection actually includes — roofing has one of the highest quote-abandonment rates in home services because homeowners don't know what to expect before they'll book.",
    },
    {
      appliesWhen: (context) => !context.hasReviews,
      priority: "medium",
      build: () => "Feature before/after project photos with a short customer quote — roofing is a high-trust, high-cost decision, and visual proof closes more of those than text alone.",
    },
  ],
  dental: [
    {
      appliesWhen: () => true,
      priority: "high",
      build: () =>
        "Add a clear 'new patient' page covering insurance, first-visit expectations, and how to book — dental practices lose a disproportionate share of prospective patients simply from cost-and-process anxiety before the first call.",
    },
    {
      appliesWhen: (context) => !context.services.some((service) => /emergency/i.test(service)),
      priority: "medium",
      build: () => "Add an emergency-dental-care page — 'emergency dentist near me' is one of the highest-intent searches in the category, and your site doesn't currently address it.",
    },
  ],
  restaurant: [
    {
      appliesWhen: () => true,
      priority: "high",
      build: (context) =>
        `Make your menu the most prominent link on your homepage${context.citiesMentioned[0] ? ` for ${context.citiesMentioned[0]}` : ""} — most restaurant searches are decision-stage, and a buried or missing menu is the single most common reason a visitor leaves without booking.`,
    },
    {
      appliesWhen: (context) => !context.hasGoogleBusinessProfile,
      priority: "high",
      build: () => "Connect Google Business Profile and keep hours current — restaurant search traffic is dominated by 'open now near me' queries, and inconsistent hours actively cost walk-in traffic.",
    },
  ],
  legal: [
    {
      appliesWhen: () => true,
      priority: "high",
      build: () =>
        "Add a dedicated page per practice area with a clear next step (free consultation, case evaluation form) — legal buyers research extensively before contacting a firm, and a single generic 'services' page underperforms specific ones in both search and conversion.",
    },
    {
      appliesWhen: (context) => !context.hasReviews,
      priority: "medium",
      build: () => "Request client testimonials (with permission) — trust signals matter disproportionately in legal services, where the buyer is making a high-stakes decision with limited ability to evaluate quality upfront.",
    },
  ],
  insurance: [
    {
      appliesWhen: () => true,
      priority: "high",
      build: () =>
        "Add a simple quote-comparison or 'what coverage do I need' guide — insurance shoppers frequently bounce when a site jumps straight to a contact form without first explaining the decision they're making.",
    },
    {
      appliesWhen: (context) => context.seoIssues.length > 0,
      priority: "medium",
      build: () => "Fix the basic on-page SEO gaps flagged below — insurance is a high local-search-competition category, and small technical gaps compound against larger competitors' sites.",
    },
  ],
  consulting: [
    {
      appliesWhen: () => true,
      priority: "high",
      build: () =>
        "Publish a case study with a specific, measurable outcome — consulting buyers convert far more on proof of past results than on a general description of services offered.",
    },
    {
      appliesWhen: (context) => !context.hasReviews,
      priority: "medium",
      build: () => "Add client testimonials naming the specific problem solved — vague praise converts worse than a testimonial that mirrors a prospect's actual situation.",
    },
  ],
  marketing_agency: [
    {
      appliesWhen: () => true,
      priority: "high",
      build: () =>
        "Show a results-driven case study with real metrics — in a category this crowded, a portfolio of vague service descriptions blends in; a specific before/after number is what differentiates.",
    },
    {
      appliesWhen: (context) => context.services.length < 3,
      priority: "medium",
      build: () => "Clarify which specific services you specialize in — buyers in this category are wary of generalist agencies, and a narrower, clearer service list usually converts better than 'full-service marketing.'",
    },
  ],
  saas: [
    {
      appliesWhen: () => true,
      priority: "high",
      build: () =>
        "Make your pricing page's value clear at a glance (what's included per tier) — unclear or hidden pricing is one of the top reasons SaaS visitors leave without starting a trial.",
    },
    {
      appliesWhen: (context) => !context.hasReviews,
      priority: "medium",
      build: () => "Add product reviews or a few customer logos above the fold — SaaS buyers look for social proof early, before they'll invest time in a trial.",
    },
  ],
  ecommerce: [
    {
      appliesWhen: () => true,
      priority: "high",
      build: () =>
        "Make your shipping and return policy visible before checkout, not buried in a footer link — unclear shipping/returns is consistently one of the top causes of cart abandonment.",
    },
    {
      appliesWhen: (context) => !context.hasReviews,
      priority: "medium",
      build: () => "Add product reviews on product pages — ecommerce conversion rates rise measurably once a product shows real customer ratings instead of none.",
    },
  ],
  coaching: [
    {
      appliesWhen: () => true,
      priority: "high",
      build: () =>
        "Add a specific before/after client result or transformation story — coaching is sold on outcomes and trust in the coach, not a generic list of services offered.",
    },
    {
      appliesWhen: (context) => !context.services.some((service) => /session|program|package/i.test(service)),
      priority: "medium",
      build: () => "Clarify what a first session or intro package actually looks like — unclear next steps are a common reason an interested visitor doesn't book.",
    },
  ],
};

const MAX_OPPORTUNITIES = 3;

/**
 * Builds a ranked (highest priority first), industry-aware, evidence-gated
 * growth opportunity list. Priority is expressed only through list order —
 * the first item is always the highest-priority one — never as text
 * embedded in the string (see the module header comment for why).
 */
export function buildGrowthOpportunities(context: GrowthOpportunityContext): string[] {
  const industryTemplates = context.industry ? INDUSTRY_TEMPLATES[context.industry] ?? [] : [];
  const candidates = [...industryTemplates, ...GENERIC_TEMPLATES].filter((template) => template.appliesWhen(context));

  const priorityRank: Record<GrowthOpportunityPriority, number> = { high: 0, medium: 1 };
  const ranked = [...candidates].sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]);

  const seen = new Set<string>();
  const results: string[] = [];
  for (const template of ranked) {
    const text = template.build(context);
    if (seen.has(text)) continue;
    seen.add(text);
    results.push(text);
    if (results.length >= MAX_OPPORTUNITIES) break;
  }

  return results;
}

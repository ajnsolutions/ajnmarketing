/**
 * Industry classification — the one piece of real industry-awareness this
 * pipeline had never had (see docs/BUSINESS_DISCOVERY_INTERNAL_ALPHA_REPORT.md).
 * Before this module, "industry" was either owner-entered free text or a
 * single hardcoded fallback string ("Local Service Business" in one file,
 * "Local Business" in another) — never actually detected from content.
 *
 * This is a deliberately simple, deterministic, frequency-scored keyword
 * classifier (no LLM call, no network) — every other generation step in this
 * pipeline that needs to sound industry-aware (persona, brand personality,
 * growth opportunities, common objections) reads its result. Scoring by
 * summed keyword frequency — not "first pattern that matches" — is the fix
 * for the same naive tie-break bug found in customer-persona.ts's
 * B2B_PERSONA_CANDIDATES list.
 */

export type IndustryCategoryId =
  | "hvac"
  | "roofing"
  | "dental"
  | "restaurant"
  | "legal"
  | "insurance"
  | "consulting"
  | "marketing_agency"
  | "saas"
  | "ecommerce"
  | "coaching";

export type IndustryCategory = {
  id: IndustryCategoryId;
  label: string;
  /** Terms weighted by specificity — a rare, high-signal term (e.g. "furnace repair") counts for more than a broad one (e.g. "service"). */
  keywords: Array<{ term: string; weight: number }>;
};

export const GENERIC_INDUSTRY_FALLBACK = "Local Service Business";

export const INDUSTRY_CATEGORIES: IndustryCategory[] = [
  {
    id: "hvac",
    label: "HVAC / Heating & Cooling",
    keywords: [
      { term: "hvac", weight: 3 },
      { term: "furnace", weight: 3 },
      { term: "air conditioning", weight: 3 },
      { term: "heat pump", weight: 3 },
      { term: "duct", weight: 2 },
      { term: "thermostat", weight: 2 },
      { term: "ac repair", weight: 3 },
      { term: "heating and cooling", weight: 3 },
      { term: "refrigerant", weight: 2 },
    ],
  },
  {
    id: "roofing",
    label: "Roofing",
    keywords: [
      { term: "roofing", weight: 3 },
      { term: "roof repair", weight: 3 },
      { term: "roof replacement", weight: 3 },
      { term: "shingle", weight: 3 },
      { term: "gutter", weight: 2 },
      { term: "roof leak", weight: 3 },
      { term: "roofer", weight: 3 },
    ],
  },
  {
    id: "dental",
    label: "Dental Practice",
    keywords: [
      { term: "dental", weight: 3 },
      { term: "dentist", weight: 3 },
      { term: "dentistry", weight: 3 },
      { term: "teeth cleaning", weight: 3 },
      { term: "orthodontic", weight: 2 },
      { term: "root canal", weight: 3 },
      { term: "cavity", weight: 2 },
      { term: "oral health", weight: 2 },
      { term: "dental hygienist", weight: 3 },
    ],
  },
  {
    id: "restaurant",
    label: "Restaurant",
    keywords: [
      { term: "restaurant", weight: 3 },
      { term: "menu", weight: 2 },
      { term: "reservation", weight: 2 },
      { term: "dine-in", weight: 3 },
      { term: "takeout", weight: 2 },
      { term: "chef", weight: 2 },
      { term: "cuisine", weight: 2 },
      { term: "happy hour", weight: 2 },
      { term: "catering", weight: 1 },
    ],
  },
  {
    id: "legal",
    label: "Law Firm / Attorney",
    keywords: [
      { term: "attorney", weight: 3 },
      { term: "lawyer", weight: 3 },
      { term: "law firm", weight: 3 },
      { term: "legal representation", weight: 3 },
      { term: "litigation", weight: 2 },
      { term: "case evaluation", weight: 2 },
      { term: "personal injury", weight: 2 },
      { term: "practice areas", weight: 2 },
      { term: "counsel", weight: 1 },
    ],
  },
  {
    id: "insurance",
    label: "Insurance Agency",
    keywords: [
      { term: "insurance", weight: 3 },
      { term: "policy", weight: 2 },
      { term: "premium", weight: 1 },
      { term: "coverage", weight: 2 },
      { term: "claim", weight: 2 },
      { term: "insurance agent", weight: 3 },
      { term: "underwriting", weight: 2 },
      { term: "deductible", weight: 2 },
    ],
  },
  {
    id: "consulting",
    label: "Consulting",
    keywords: [
      { term: "consulting", weight: 3 },
      { term: "consultant", weight: 3 },
      { term: "advisory", weight: 2 },
      { term: "strategy engagement", weight: 2 },
      { term: "client engagement", weight: 1 },
      { term: "business transformation", weight: 2 },
      { term: "management consulting", weight: 3 },
    ],
  },
  {
    id: "marketing_agency",
    label: "Marketing Agency",
    keywords: [
      { term: "marketing agency", weight: 3 },
      { term: "digital marketing", weight: 2 },
      { term: "seo", weight: 2 },
      { term: "social media management", weight: 2 },
      { term: "ad campaign", weight: 2 },
      { term: "brand strategy", weight: 2 },
      { term: "paid media", weight: 2 },
      { term: "content marketing", weight: 2 },
    ],
  },
  {
    id: "saas",
    label: "SaaS / Software",
    keywords: [
      { term: "saas", weight: 3 },
      { term: "software platform", weight: 2 },
      { term: "api", weight: 1 },
      { term: "free trial", weight: 2 },
      { term: "subscription plan", weight: 2 },
      { term: "dashboard", weight: 1 },
      { term: "integration", weight: 1 },
      { term: "onboarding flow", weight: 1 },
      { term: "per seat", weight: 2 },
    ],
  },
  {
    id: "ecommerce",
    label: "Ecommerce / Online Retail",
    keywords: [
      { term: "add to cart", weight: 3 },
      { term: "checkout", weight: 2 },
      { term: "free shipping", weight: 2 },
      { term: "shop now", weight: 2 },
      { term: "product catalog", weight: 2 },
      { term: "return policy", weight: 2 },
      { term: "online store", weight: 2 },
      { term: "sku", weight: 2 },
    ],
  },
  {
    id: "coaching",
    label: "Coaching / Personal Training",
    keywords: [
      { term: "coaching", weight: 3 },
      { term: "coach", weight: 2 },
      { term: "personal training", weight: 3 },
      { term: "training program", weight: 2 },
      { term: "one-on-one sessions", weight: 2 },
      { term: "athlete", weight: 2 },
      { term: "fitness", weight: 1 },
      { term: "workout plan", weight: 2 },
      { term: "youth sports", weight: 2 },
    ],
  },
];

export type IndustryClassification = {
  category: IndustryCategory | null;
  confidence: "high" | "medium" | "low" | "none";
  label: string;
  score: number;
  matchedTerms: string[];
};

const HIGH_CONFIDENCE_SCORE = 6;
const MEDIUM_CONFIDENCE_SCORE = 3;

/** Counts every (overlapping-safe) occurrence of `term` in `haystack`, not just presence — this is what makes classification frequency-scored rather than first-match-wins. */
function countOccurrences(haystack: string, term: string): number {
  if (!term) return 0;
  let count = 0;
  let index = haystack.indexOf(term);
  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(term, index + term.length);
  }
  return count;
}

/**
 * Scores every category by summed (occurrences × weight) across its keyword
 * list, then returns the highest-scoring category — never the first pattern
 * that merely appears once. Returns `category: null` (honest "don't know")
 * when nothing clears a minimum signal floor, rather than guessing.
 */
export function classifyIndustryFromText(text: string): IndustryClassification {
  const lower = (text || "").toLowerCase();

  let best: { category: IndustryCategory; score: number; matchedTerms: string[] } | null = null;

  for (const category of INDUSTRY_CATEGORIES) {
    let score = 0;
    const matchedTerms: string[] = [];
    for (const { term, weight } of category.keywords) {
      const occurrences = countOccurrences(lower, term);
      if (occurrences > 0) {
        score += occurrences * weight;
        matchedTerms.push(term);
      }
    }

    if (score > 0 && (!best || score > best.score)) {
      best = { category, score, matchedTerms };
    }
  }

  if (!best || best.score < MEDIUM_CONFIDENCE_SCORE) {
    return { category: null, confidence: "none", label: GENERIC_INDUSTRY_FALLBACK, score: best?.score ?? 0, matchedTerms: [] };
  }

  const confidence = best.score >= HIGH_CONFIDENCE_SCORE ? "high" : "medium";
  return { category: best.category, confidence, label: best.category.label, score: best.score, matchedTerms: best.matchedTerms };
}

export function industryCategoryById(id: IndustryCategoryId): IndustryCategory | undefined {
  return INDUSTRY_CATEGORIES.find((category) => category.id === id);
}

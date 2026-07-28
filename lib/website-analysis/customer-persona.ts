import type { WebsiteExtractor } from "@/lib/website-analysis/types";
import { classifyIndustryFromText } from "@/lib/business-discovery/industryTaxonomy";

export const LOW_CONFIDENCE_CUSTOMER_PERSONA =
  "Business decision-makers and customers described on the website";

type PersonaInput = Parameters<WebsiteExtractor["extract"]>[0];

const GENERIC_AUDIENCE_TERMS = [
  { label: "homeowner", pattern: /homeowners?/i },
  { label: "property manager", pattern: /property managers?/i },
  { label: "plumber", pattern: /plumbers?/i },
  { label: "local service customer", pattern: /local service customers?/i },
  { label: "residential customer", pattern: /residential customers?/i },
];

const GENERIC_PERSONA_PHRASES = [
  /^homeowners?\s+and\s+property managers?/i,
  /^local customers seeking trusted service$/i,
  /^local customers?$/i,
];

const B2B_PERSONA_CANDIDATES = [
  {
    terms: ["section 125", "cafeteria plan", "premium reimbursement", "premium-only plan"],
    persona: "Employers and HR decision-makers evaluating Section 125 and employee benefit savings",
  },
  {
    terms: ["benefits administrator", "benefits administration"],
    persona: "Benefits administrators supporting employer benefit programs",
  },
  {
    terms: ["hr ", "human resources", "people operations"],
    persona: "HR decision-makers evaluating employee benefit solutions",
  },
  {
    terms: ["employer", "employers"],
    persona: "Employers seeking employee savings and benefit solutions",
  },
  {
    terms: ["employee", "employees", "workforce"],
    persona: "Employees looking for savings, coverage, or workplace benefit options",
  },
  {
    terms: ["business owner", "business owners", "small business"],
    persona: "Business owners evaluating organizational benefit and savings programs",
  },
  {
    // Deliberately excludes the bare term "insurance agency" — found via the
    // Internal Alpha eval dataset to misclassify any general auto/home/life
    // insurance agency as a B2B employee-benefits consultant. "Health plan"
    // and "medical plan" are specific enough to actually imply benefits
    // consulting; a plain insurance agency alone does not.
    terms: ["healthcare", "health plan", "medical plan"],
    persona: "Organizations and decision-makers seeking healthcare or benefits guidance",
  },
];

function buildSourceBlob(input: PersonaInput): string {
  return [
    input.website.textContent,
    input.website.html,
    input.profile.business_name,
    input.profile.industry,
    input.profile.primary_services,
    input.profile.emergency_services,
    input.profile.seasonal_services,
    input.profile.specialty_services,
    input.profile.primary_service_area,
    input.profile.nearby_cities,
    input.profile.city,
    input.profile.state,
    input.profile.brand_voice_tone,
    input.profile.preferred_words,
    input.profile.voice_notes,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function sourceContainsTerm(source: string, term: string): boolean {
  return source.includes(term.toLowerCase());
}

function isGenericPersonaPhrase(persona: string): boolean {
  return GENERIC_PERSONA_PHRASES.some((pattern) => pattern.test(persona.trim()));
}

function personaUsesUnsupportedAudienceTerms(persona: string, source: string): boolean {
  return GENERIC_AUDIENCE_TERMS.some(
    ({ label, pattern }) => pattern.test(persona) && !sourceContainsTerm(source, label)
  );
}

/**
 * Scores every B2B candidate by how many of its terms actually appear in the
 * source (not just "does the first pattern in array order appear at all") —
 * fixes a real bug where a site mentioning both "employer" and "healthcare"
 * always got the "employer" persona purely because that candidate happened
 * to be earlier in the list, regardless of which term was more prominent.
 */
function inferB2BPersona(source: string): string | null {
  let best: { persona: string; score: number } | null = null;

  for (const candidate of B2B_PERSONA_CANDIDATES) {
    const score = candidate.terms.reduce((total, term) => total + (sourceContainsTerm(source, term) ? 1 : 0), 0);
    if (score > 0 && (!best || score > best.score)) {
      best = { persona: candidate.persona, score };
    }
  }

  return best?.persona ?? null;
}

const INDUSTRY_PERSONA_TEXT: Partial<Record<string, string>> = {
  hvac: "Homeowners and property managers who need heating or cooling repair, replacement, or seasonal maintenance",
  roofing: "Homeowners dealing with roof damage, leaks, or planning a full roof replacement",
  dental: "Patients looking for routine dental care, treatment, or a new dentist nearby",
  restaurant: "Local diners and regulars looking for a place to eat, order from, or book for a group",
  legal: "Individuals and businesses seeking legal guidance or representation for a specific matter",
  insurance: "People and businesses comparing insurance coverage and looking for a policy that fits their situation",
  consulting: "Business leaders evaluating outside expertise to solve a specific operational or strategic problem",
  marketing_agency: "Business owners and marketing leaders looking for outside help growing visibility and leads",
  saas: "Teams evaluating whether this software solves a specific workflow problem they currently have",
  ecommerce: "Online shoppers comparing this product against other options before buying",
  coaching: "People looking for hands-on coaching or training to reach a specific personal or athletic goal",
};

/**
 * Industry-aware fallback — tried after the B2B/residential keyword checks
 * and before the generic catch-all. A classified industry (e.g. "Dental
 * Practice") gives a far more specific, useful persona than the previous
 * behavior of jumping straight to the generic
 * "Business decision-makers and customers described on the website" for
 * every business the B2B/residential checks didn't recognize.
 */
function inferIndustryPersona(source: string): string | null {
  const classification = classifyIndustryFromText(source);
  if (!classification.category) return null;
  return INDUSTRY_PERSONA_TEXT[classification.category.id] ?? null;
}

function inferResidentialPersona(source: string, input: PersonaInput): string | null {
  const mentionsHomeowners = sourceContainsTerm(source, "homeowner");
  const mentionsPropertyManagers = sourceContainsTerm(source, "property manager");

  if (!mentionsHomeowners && !mentionsPropertyManagers) {
    return null;
  }

  const audience = [
    mentionsHomeowners ? "Homeowners" : null,
    mentionsPropertyManagers ? "Property managers" : null,
  ]
    .filter(Boolean)
    .join(" and ");

  const city = input.profile.city?.trim();
  const cityInSource = city ? sourceContainsTerm(source, city) : false;

  if (city && cityInSource) {
    return `${audience} in ${city}`;
  }

  return audience;
}

export function inferCustomerPersonaFromSource(input: PersonaInput): string {
  const source = buildSourceBlob(input);

  const b2bPersona = inferB2BPersona(source);
  if (b2bPersona) return b2bPersona;

  const residentialPersona = inferResidentialPersona(source, input);
  if (residentialPersona) return residentialPersona;

  const industryPersona = inferIndustryPersona(source);
  if (industryPersona) return industryPersona;

  return LOW_CONFIDENCE_CUSTOMER_PERSONA;
}

export function normalizeCustomerPersona(
  persona: string | null | undefined,
  input: PersonaInput
): string {
  const trimmed = persona?.trim() ?? "";
  const source = buildSourceBlob(input);

  if (!trimmed) {
    return inferCustomerPersonaFromSource(input);
  }

  if (
    isGenericPersonaPhrase(trimmed) ||
    personaUsesUnsupportedAudienceTerms(trimmed, source) ||
    trimmed.toLowerCase() === "local customers seeking trusted service"
  ) {
    return inferCustomerPersonaFromSource(input);
  }

  return trimmed;
}

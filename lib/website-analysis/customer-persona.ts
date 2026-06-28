import type { WebsiteExtractor } from "@/lib/website-analysis/types";

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
    terms: ["healthcare", "health plan", "medical plan", "insurance agency"],
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

function inferB2BPersona(source: string): string | null {
  for (const candidate of B2B_PERSONA_CANDIDATES) {
    if (candidate.terms.some((term) => sourceContainsTerm(source, term))) {
      return candidate.persona;
    }
  }

  return null;
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

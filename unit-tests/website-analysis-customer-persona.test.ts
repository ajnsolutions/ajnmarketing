import test from "node:test";
import assert from "node:assert/strict";
import {
  inferCustomerPersonaFromSource,
  normalizeCustomerPersona,
  LOW_CONFIDENCE_CUSTOMER_PERSONA,
} from "../lib/website-analysis/customer-persona.ts";

type ProfileOverrides = Partial<{
  business_name: string | null;
  industry: string | null;
  website: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  primary_service_area: string | null;
  nearby_cities: string | null;
  primary_services: string | null;
  emergency_services: string | null;
  seasonal_services: string | null;
  specialty_services: string | null;
  brand_voice_tone: string | null;
  preferred_words: string | null;
  avoid_words: string | null;
  voice_notes: string | null;
}>;

function buildInput(textContent: string, profileOverrides: ProfileOverrides = {}) {
  return {
    website: {
      url: "https://example.com",
      finalUrl: "https://example.com",
      html: `<html><body>${textContent}</body></html>`,
      textContent,
      fetchedAt: new Date().toISOString(),
    },
    profile: {
      business_name: null,
      industry: null,
      website: null,
      phone: null,
      city: null,
      state: null,
      primary_service_area: null,
      nearby_cities: null,
      primary_services: null,
      emergency_services: null,
      seasonal_services: null,
      specialty_services: null,
      brand_voice_tone: null,
      preferred_words: null,
      avoid_words: null,
      voice_notes: null,
      ...profileOverrides,
    },
  };
}

test("scores B2B candidates by total term matches, not first-pattern-in-array-order", () => {
  // "healthcare" is earlier-scoring-irrelevant here — the text repeats
  // "employer"/"employers" many times but only mentions "healthcare" once.
  // Before the fix, whichever candidate was earlier in the array order won
  // regardless of which term actually dominated the page.
  const text =
    "Employers can offer this benefit. Employers save on payroll tax. This program helps employers nationwide. We also mention healthcare briefly.";
  const persona = inferCustomerPersonaFromSource(buildInput(text));
  assert.match(persona, /Employers/);
});

test("a healthcare-dominant page (more matches) gets the healthcare persona, not an earlier-array-position one", () => {
  const text =
    "We are a healthcare organization. Our health plan and medical plan options serve organizations. This insurance agency focuses on healthcare guidance for healthcare decision-makers.";
  const persona = inferCustomerPersonaFromSource(buildInput(text));
  assert.match(persona, /healthcare or benefits guidance/i);
});

test("falls back to an industry-aware persona instead of the generic catch-all when the site is clearly a dental practice", () => {
  const text = "Our dentists offer teeth cleaning, root canal treatment, and general dentistry appointments.";
  const persona = inferCustomerPersonaFromSource(buildInput(text));
  assert.match(persona, /Patients/i);
  assert.notEqual(persona, LOW_CONFIDENCE_CUSTOMER_PERSONA);
});

test("falls back to an industry-aware persona for a restaurant", () => {
  const text = "Check out our menu and make a reservation. Our chef prepares seasonal cuisine, dine-in or takeout.";
  const persona = inferCustomerPersonaFromSource(buildInput(text));
  assert.match(persona, /diners/i);
});

test("still falls back to the generic low-confidence persona when nothing at all is detectable", () => {
  const text = "Welcome to our website. Thanks for visiting.";
  const persona = inferCustomerPersonaFromSource(buildInput(text));
  assert.equal(persona, LOW_CONFIDENCE_CUSTOMER_PERSONA);
});

test("residential persona detection still wins over industry classification when homeowners are explicitly mentioned", () => {
  const text = "We help homeowners with furnace repair and air conditioning maintenance.";
  const persona = inferCustomerPersonaFromSource(buildInput(text));
  assert.match(persona, /Homeowners/);
});

test("normalizeCustomerPersona discards a generic LLM-returned phrase and re-infers from source", () => {
  const text = "Our dentists offer teeth cleaning and general dentistry.";
  const persona = normalizeCustomerPersona("local customers seeking trusted service", buildInput(text));
  assert.match(persona, /Patients/i);
});

test("normalizeCustomerPersona keeps a specific, well-supported LLM persona unchanged", () => {
  const text = "We serve small business owners looking for benefits guidance.";
  const persona = normalizeCustomerPersona("Small business owners evaluating employee benefits", buildInput(text));
  assert.equal(persona, "Small business owners evaluating employee benefits");
});

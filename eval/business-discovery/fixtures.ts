/**
 * Internal Alpha evaluation dataset for the Business Discovery pipeline.
 *
 * Twelve synthetic (fictional, no real business or website) fixtures — one
 * per business category named in the Internal Alpha sprint scope, plus the
 * AJN Sports coach profile specifically called out. Each fixture pairs a
 * realistic slice of website copy with the owner-entered onboarding profile
 * fields a real customer might (or might not) have filled in, and a set of
 * "expectations" the pipeline's output should satisfy.
 *
 * This is a golden dataset that did not exist anywhere in the repo before —
 * see the Internal Alpha report's "Missing information" section. Its purpose
 * is regression testing: `unit-tests/business-discovery-eval-regression.test.ts`
 * runs every fixture through the real (deterministic, no-API-key) extraction
 * path and checks each expectation, so a future change that quietly makes
 * industry detection, persona inference, or growth opportunities worse for
 * any category is caught immediately instead of only being noticed by
 * eyeballing a live demo.
 */

import type { IndustryCategoryId } from "@/lib/business-discovery/industryTaxonomy";

export type BusinessDiscoveryEvalProfile = {
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
};

export type BusinessDiscoveryEvalFixture = {
  id: string;
  category: string;
  html: string;
  textContent: string;
  finalUrl: string;
  profile: BusinessDiscoveryEvalProfile;
  expect: {
    industryCategoryId: IndustryCategoryId | null;
    personaMatches: RegExp;
    personaMustNotBeGeneric: boolean;
    summaryMustMention: RegExp;
    growthOpportunityMustMention: RegExp;
    contentOpportunityAudienceMustNotBeGeneric: boolean;
  };
};

function emptyProfile(overrides: Partial<BusinessDiscoveryEvalProfile>): BusinessDiscoveryEvalProfile {
  return {
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
    ...overrides,
  };
}

function page(title: string, h1: string, h2s: string[], body: string): { html: string; textContent: string } {
  const html = `<html><head><title>${title}</title></head><body><h1>${h1}</h1>${h2s.map((h) => `<h2>${h}</h2>`).join("")}<p>${body}</p></body></html>`;
  const textContent = `${h1} ${h2s.join(" ")} ${body}`;
  return { html, textContent };
}

export const BUSINESS_DISCOVERY_EVAL_FIXTURES: BusinessDiscoveryEvalFixture[] = [
  (() => {
    const { html, textContent } = page(
      "Springfield Comfort Heating & Cooling",
      "Springfield's Trusted HVAC Experts",
      ["Furnace Repair", "Air Conditioning Installation", "Duct Cleaning", "Seasonal Maintenance Plans"],
      "We repair furnaces, install heat pumps, and service HVAC and air conditioning systems for homeowners across Springfield. Ask about our thermostat upgrades and refrigerant recharge services."
    );
    return {
      id: "hvac-1",
      category: "HVAC",
      html,
      textContent,
      finalUrl: "https://springfieldcomfort.example",
      profile: emptyProfile({ city: "Springfield", state: "IL" }),
      expect: {
        industryCategoryId: "hvac",
        personaMatches: /Homeowners/i,
        personaMustNotBeGeneric: true,
        summaryMustMention: /Furnace Repair|Air Conditioning/i,
        growthOpportunityMustMention: /maintenance-plan|Google Business Profile/i,
        contentOpportunityAudienceMustNotBeGeneric: true,
      },
    };
  })(),
  (() => {
    const { html, textContent } = page(
      "Shelbyville Roofing Co.",
      "Roofing Repair & Replacement in Shelbyville",
      ["Roof Repair", "Roof Replacement", "Shingle Installation", "Gutter Services"],
      "Our roofers handle roof leak repair, full roof replacement, and shingle installation for homes across Shelbyville and nearby cities."
    );
    return {
      id: "roofing-1",
      category: "Roofing",
      html,
      textContent,
      finalUrl: "https://shelbyvilleroofing.example",
      profile: emptyProfile({ city: "Shelbyville" }),
      expect: {
        industryCategoryId: "roofing",
        personaMatches: /Homeowners/i,
        personaMustNotBeGeneric: true,
        summaryMustMention: /Roof Repair|Roof Replacement/i,
        growthOpportunityMustMention: /free roof inspection|Google Business Profile/i,
        contentOpportunityAudienceMustNotBeGeneric: true,
      },
    };
  })(),
  (() => {
    const { html, textContent } = page(
      "Bright Smile Family Dentistry",
      "Gentle Family Dentistry",
      ["Teeth Cleaning", "Root Canal Treatment", "General Dentistry", "Orthodontic Consultations"],
      "Our dentists and dental hygienists provide teeth cleaning, cavity treatment, root canal therapy, and general dentistry for the whole family. New patients are always welcome."
    );
    return {
      id: "dental-1",
      category: "Dentist",
      html,
      textContent,
      finalUrl: "https://brightsmilefamily.example",
      profile: emptyProfile({}),
      expect: {
        industryCategoryId: "dental",
        personaMatches: /Patients/i,
        personaMustNotBeGeneric: true,
        summaryMustMention: /Teeth Cleaning|Dentistry/i,
        growthOpportunityMustMention: /new patient|emergency-dental|Google Business Profile/i,
        contentOpportunityAudienceMustNotBeGeneric: true,
      },
    };
  })(),
  (() => {
    const { html, textContent } = page(
      "The Rustic Table",
      "Farm-to-Table Dining",
      ["Dinner Menu", "Reservations", "Private Catering", "Happy Hour"],
      "View our seasonal menu, make a reservation, or order takeout. Our chef prepares farm-to-table cuisine nightly, and we offer a weekly happy hour and private catering for events."
    );
    return {
      id: "restaurant-1",
      category: "Restaurant",
      html,
      textContent,
      finalUrl: "https://therustictable.example",
      profile: emptyProfile({}),
      expect: {
        industryCategoryId: "restaurant",
        personaMatches: /diners/i,
        personaMustNotBeGeneric: true,
        summaryMustMention: /Dinner Menu|Reservations/i,
        growthOpportunityMustMention: /menu|Google Business Profile/i,
        contentOpportunityAudienceMustNotBeGeneric: true,
      },
    };
  })(),
  (() => {
    const { html, textContent } = page(
      "Harrison & Cole Law Group",
      "Personal Injury & Litigation Attorneys",
      ["Personal Injury", "Case Evaluation", "Litigation Support", "Practice Areas"],
      "Our attorneys and lawyers provide a free case evaluation for personal injury claims and represent clients in litigation. Explore our practice areas and schedule a consultation."
    );
    return {
      id: "legal-1",
      category: "Attorney",
      html,
      textContent,
      finalUrl: "https://harrisoncolelaw.example",
      profile: emptyProfile({}),
      expect: {
        industryCategoryId: "legal",
        personaMatches: /legal guidance|representation/i,
        personaMustNotBeGeneric: true,
        summaryMustMention: /Personal Injury|Litigation/i,
        growthOpportunityMustMention: /practice area|testimonial|Google Business Profile/i,
        contentOpportunityAudienceMustNotBeGeneric: true,
      },
    };
  })(),
  (() => {
    const { html, textContent } = page(
      "Meridian Insurance Agency",
      "Auto, Home & Life Insurance",
      ["Insurance Policy Quotes", "Coverage Review", "Claims Assistance", "Deductible Guidance"],
      "Our insurance agents help you compare coverage, understand your policy premium and deductible, and file a claim when you need one. Meridian Insurance Agency serves individuals and businesses."
    );
    return {
      id: "insurance-1",
      category: "Insurance",
      html,
      textContent,
      finalUrl: "https://meridianinsurance.example",
      profile: emptyProfile({}),
      expect: {
        industryCategoryId: "insurance",
        personaMatches: /coverage/i,
        personaMustNotBeGeneric: true,
        summaryMustMention: /Insurance Policy|Coverage Review/i,
        growthOpportunityMustMention: /quote-comparison|coverage|Google Business Profile/i,
        contentOpportunityAudienceMustNotBeGeneric: true,
      },
    };
  })(),
  (() => {
    const { html, textContent } = page(
      "Vantage Point Consulting",
      "Management Consulting for Growing Businesses",
      ["Strategy Engagements", "Business Transformation", "Client Advisory", "Operations Review"],
      "Vantage Point Consulting is a management consulting firm. Our consultants lead strategy engagements and business transformation advisory work for growing companies."
    );
    return {
      id: "consulting-1",
      category: "Consultant",
      html,
      textContent,
      finalUrl: "https://vantagepointconsulting.example",
      profile: emptyProfile({}),
      expect: {
        industryCategoryId: "consulting",
        personaMatches: /Business leaders/i,
        personaMustNotBeGeneric: true,
        summaryMustMention: /Strategy Engagements|Business Transformation/i,
        growthOpportunityMustMention: /case study|testimonial|Google Business Profile/i,
        contentOpportunityAudienceMustNotBeGeneric: true,
      },
    };
  })(),
  (() => {
    const { html, textContent } = page(
      "Northbeam Growth Marketing",
      "Full-Service Digital Marketing Agency",
      ["SEO Campaigns", "Paid Media Management", "Brand Strategy", "Content Marketing"],
      "Northbeam is a marketing agency offering digital marketing, SEO, paid media ad campaigns, brand strategy, and content marketing for growing brands."
    );
    return {
      id: "marketing-agency-1",
      category: "Marketing Agency",
      html,
      textContent,
      finalUrl: "https://northbeamgrowth.example",
      profile: emptyProfile({}),
      expect: {
        industryCategoryId: "marketing_agency",
        personaMatches: /marketing leaders|Business owners/i,
        personaMustNotBeGeneric: true,
        summaryMustMention: /SEO Campaigns|Paid Media/i,
        growthOpportunityMustMention: /case study|specialize|Google Business Profile/i,
        contentOpportunityAudienceMustNotBeGeneric: true,
      },
    };
  })(),
  (() => {
    const { html, textContent } = page(
      "Ledgerly",
      "Accounting Software for Small Teams",
      ["Free Trial", "Per Seat Pricing", "API Integrations", "Live Dashboard"],
      "Ledgerly is a SaaS platform with a free trial, per seat subscription plan, API integrations, and a live dashboard for tracking your books in real time."
    );
    return {
      id: "saas-1",
      category: "SaaS",
      html,
      textContent,
      finalUrl: "https://ledgerly.example",
      profile: emptyProfile({}),
      expect: {
        industryCategoryId: "saas",
        personaMatches: /Teams evaluating/i,
        personaMustNotBeGeneric: true,
        summaryMustMention: /Free Trial|Per Seat/i,
        growthOpportunityMustMention: /pricing|customer logo|Google Business Profile/i,
        contentOpportunityAudienceMustNotBeGeneric: true,
      },
    };
  })(),
  (() => {
    const { html, textContent } = page(
      "Coastal Home Goods",
      "Shop Coastal-Inspired Home Decor",
      ["Add To Cart", "Free Shipping", "Return Policy", "Product Catalog"],
      "Shop our online store's product catalog with free shipping on every order and add to cart in seconds. Read our return policy before you check out."
    );
    return {
      id: "ecommerce-1",
      category: "Ecommerce",
      html,
      textContent,
      finalUrl: "https://coastalhomegoods.example",
      profile: emptyProfile({}),
      expect: {
        industryCategoryId: "ecommerce",
        personaMatches: /shoppers/i,
        personaMustNotBeGeneric: true,
        summaryMustMention: /Free Shipping|Product Catalog/i,
        growthOpportunityMustMention: /shipping|return policy|review/i,
        contentOpportunityAudienceMustNotBeGeneric: true,
      },
    };
  })(),
  (() => {
    const { html, textContent } = page(
      "Apex Performance Coaching",
      "One-on-One Personal Training",
      ["Personal Training Sessions", "Custom Workout Plans", "Nutrition Coaching", "Youth Sports Training"],
      "Apex Performance Coaching offers one-on-one personal training, custom workout plans, and youth sports training for athletes at every level."
    );
    return {
      id: "coaching-1",
      category: "Coach",
      html,
      textContent,
      finalUrl: "https://apexperformancecoaching.example",
      profile: emptyProfile({}),
      expect: {
        industryCategoryId: "coaching",
        personaMatches: /coaching or training/i,
        personaMustNotBeGeneric: true,
        summaryMustMention: /Personal Training|Workout Plans/i,
        growthOpportunityMustMention: /transformation|client result|package/i,
        contentOpportunityAudienceMustNotBeGeneric: true,
      },
    };
  })(),
  (() => {
    const { html, textContent } = page(
      "AJN Sports Coach Profile",
      "Youth Athlete Development & Sports Coaching",
      ["One-on-One Sessions", "Team Training Programs", "Athlete Development", "Youth Sports Camps"],
      "AJN Sports Coach provides personal training and coaching for young athletes, including one-on-one sessions, team training programs, and youth sports camps focused on athlete development."
    );
    return {
      id: "ajn-sports-coach-1",
      category: "AJN Sports Coach Profile",
      html,
      textContent,
      finalUrl: "https://ajnsports.example",
      profile: emptyProfile({ business_name: "AJN Sports Coach", primary_services: "One-on-one athlete training, team programs" }),
      expect: {
        industryCategoryId: "coaching",
        personaMatches: /coaching or training/i,
        personaMustNotBeGeneric: true,
        summaryMustMention: /One-on-one athlete training|team programs/i,
        growthOpportunityMustMention: /transformation|client result|package/i,
        contentOpportunityAudienceMustNotBeGeneric: true,
      },
    };
  })(),
];

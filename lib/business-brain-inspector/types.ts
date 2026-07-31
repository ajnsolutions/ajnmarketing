/**
 * Business Brain Inspector — a customer-facing trust feature, not a
 * debugging page. Composes already-computed Business Brain packages
 * (Business Discovery, Customer Voice, Website Testimonials, Search
 * Console/External Intelligence, Smart Uploads, the Business Knowledge
 * Graph, the Business Learning Engine, the Opportunity Detection Engine)
 * into one consistent, explainable knowledge model — no new AI call, no new
 * reasoning engine, nothing fabricated. See
 * docs/project-magic/BUSINESS_BRAIN_INSPECTOR.md.
 */

export const BrainConfidenceLevels = {
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
} as const;

export type BrainConfidenceLevel = (typeof BrainConfidenceLevels)[keyof typeof BrainConfidenceLevels];

export const BRAIN_CONFIDENCE_LABELS: Record<BrainConfidenceLevel, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const BrainSections = {
  BUSINESS_IDENTITY: "business_identity",
  PRODUCTS_SERVICES: "products_services",
  IDEAL_CUSTOMERS: "ideal_customers",
  GEOGRAPHIC_SERVICE_AREA: "geographic_service_area",
  DIFFERENTIATORS: "differentiators",
  BRAND_VOICE: "brand_voice",
  CUSTOMER_THEMES: "customer_themes",
  SEARCH_TRENDS: "search_trends",
  SEASONALITY: "seasonality",
  MARKETING_OPPORTUNITIES: "marketing_opportunities",
  BUSINESS_GOALS: "business_goals",
  LEARNING_HISTORY: "learning_history",
} as const;

export type BrainSectionKey = (typeof BrainSections)[keyof typeof BrainSections];

export const BRAIN_SECTION_LABELS: Record<BrainSectionKey, string> = {
  business_identity: "Business Identity",
  products_services: "Products & Services",
  ideal_customers: "Ideal Customers",
  geographic_service_area: "Geographic Service Area",
  differentiators: "Differentiators",
  brand_voice: "Brand Voice",
  customer_themes: "Customer Themes",
  search_trends: "Search Trends",
  seasonality: "Seasonality",
  marketing_opportunities: "Marketing Opportunities",
  business_goals: "Business Goals",
  learning_history: "Learning History",
};

/** Ordered so the page reads identity outward — who you are, what you
 * offer, who it's for, then evidence gathered about the market and what
 * the Business Brain has learned over time. */
export const BRAIN_SECTION_ORDER: BrainSectionKey[] = [
  BrainSections.BUSINESS_IDENTITY,
  BrainSections.PRODUCTS_SERVICES,
  BrainSections.IDEAL_CUSTOMERS,
  BrainSections.GEOGRAPHIC_SERVICE_AREA,
  BrainSections.DIFFERENTIATORS,
  BrainSections.BRAND_VOICE,
  BrainSections.CUSTOMER_THEMES,
  BrainSections.SEARCH_TRENDS,
  BrainSections.SEASONALITY,
  BrainSections.MARKETING_OPPORTUNITIES,
  BrainSections.BUSINESS_GOALS,
  BrainSections.LEARNING_HISTORY,
];

/** One piece of evidence backing a knowledge card — always traceable to a
 * real, opaque provider id (Part 3). Never a raw provider payload. */
export type BrainEvidenceRef = {
  sourceProviderId: string;
  sourceLabel: string;
  summary: string;
};

/** Where a correction should route the customer (Part 5) — always an
 * existing settings/onboarding destination. Never a parallel editing system. */
export type BrainCorrectionAction = {
  label: string;
  href: string;
};

/** One thing the Business Brain currently believes, with full explainability. */
export type KnowledgeCard = {
  id: string;
  section: BrainSectionKey;
  title: string;
  /** What the AI currently believes, in plain language. */
  statement: string;
  confidence: BrainConfidenceLevel;
  /** Why that confidence level, specifically — never a bare label alone. */
  confidenceReason: string;
  evidenceCount: number;
  evidence: BrainEvidenceRef[];
  /** Null when there's nothing meaningful for the customer to correct here
   * (e.g. a purely synthesized, multi-source conclusion). */
  correction: BrainCorrectionAction | null;
};

/** Important information the Business Brain doesn't have yet (Part 4). */
export type MissingKnowledgeItem = {
  id: string;
  section: BrainSectionKey;
  label: string;
  /** Why this specific gap matters — never generic filler text. */
  detail: string;
  correction: BrainCorrectionAction | null;
};

export type BusinessBrainSnapshot = {
  generatedAt: string;
  overallConfidence: BrainConfidenceLevel;
  overallConfidenceExplanation: string;
  sections: Partial<Record<BrainSectionKey, KnowledgeCard[]>>;
  missingKnowledge: MissingKnowledgeItem[];
};

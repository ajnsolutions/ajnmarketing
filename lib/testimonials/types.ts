/**
 * Website Testimonials — the second Customer Voice provider
 * (CustomerVoiceProviderIds.WEBSITE_TESTIMONIALS in lib/customer-voice/types.ts).
 *
 * The goal is not testimonial management — every testimonial is turned into
 * (a) provider-agnostic Customer Voice evidence via the existing theme
 * pipeline, and (b) normalized, reusable knowledge facts (this module's own
 * AI extraction), never just a stored quote with nothing learned from it.
 */

export const TestimonialIngestionMethods = {
  MANUAL: "manual",
  WEBSITE_IMPORT: "website_import",
  BULK_PASTE: "bulk_paste",
  CSV_IMPORT: "csv_import",
} as const;

export type TestimonialIngestionMethod =
  (typeof TestimonialIngestionMethods)[keyof typeof TestimonialIngestionMethods];

export const TestimonialStatuses = {
  ACTIVE: "active",
  ARCHIVED: "archived",
} as const;

export type TestimonialStatus = (typeof TestimonialStatuses)[keyof typeof TestimonialStatuses];

/** One row of public.website_testimonials. */
export type WebsiteTestimonialRecord = {
  id: string;
  user_id: string;
  business_profile_id: string;
  author_name: string | null;
  author_title: string | null;
  quote: string;
  source_url: string | null;
  rating: number | null;
  occurred_at: string | null;
  ingestion_method: TestimonialIngestionMethod;
  status: TestimonialStatus;
  fact_count: number;
  created_at: string;
  updated_at: string;
};

/** Raw shape any ingestion method produces before persistence. */
export type RawTestimonialInput = {
  authorName?: string | null;
  authorTitle?: string | null;
  quote: string;
  sourceUrl?: string | null;
  rating?: number | null;
  occurredAt?: string | null;
};

/** Reusable business-knowledge categories — Part 2's explicit list. */
export const TestimonialKnowledgeCategories = {
  CUSTOMER_BENEFIT: "customer_benefit",
  BUSINESS_STRENGTH: "business_strength",
  RECURRING_OUTCOME: "recurring_outcome",
  OBJECTION_OVERCOME: "objection_overcome",
  INDUSTRY_TERMINOLOGY: "industry_terminology",
  EMOTIONAL_LANGUAGE: "emotional_language",
  TRUST_INDICATOR: "trust_indicator",
  DIFFERENTIATOR: "differentiator",
  CUSTOMER_SEGMENT: "customer_segment",
} as const;

export type TestimonialKnowledgeCategory =
  (typeof TestimonialKnowledgeCategories)[keyof typeof TestimonialKnowledgeCategories];

export const TESTIMONIAL_KNOWLEDGE_CATEGORY_LABELS: Record<TestimonialKnowledgeCategory, string> = {
  customer_benefit: "Customer benefit",
  business_strength: "Business strength",
  recurring_outcome: "Recurring outcome",
  objection_overcome: "Objection overcome",
  industry_terminology: "Industry terminology",
  emotional_language: "Emotional language",
  trust_indicator: "Trust indicator",
  differentiator: "Differentiator",
  customer_segment: "Customer segment",
};

export const TestimonialKnowledgeConfidenceLevels = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
} as const;

export type TestimonialKnowledgeConfidenceLevel =
  (typeof TestimonialKnowledgeConfidenceLevels)[keyof typeof TestimonialKnowledgeConfidenceLevels];

/** One row of public.testimonial_knowledge_facts. */
export type TestimonialKnowledgeFactRecord = {
  id: string;
  user_id: string;
  business_profile_id: string;
  testimonial_id: string;
  category: TestimonialKnowledgeCategory;
  fact: string;
  source_excerpt: string | null;
  confidence: TestimonialKnowledgeConfidenceLevel;
  created_at: string;
  updated_at: string;
};

/** One item of the raw AI extraction result, before persistence. */
export type ExtractedTestimonialKnowledgeItem = {
  category: TestimonialKnowledgeCategory;
  fact: string;
  sourceExcerpt: string | null;
  confidence: TestimonialKnowledgeConfidenceLevel;
};

export type TestimonialExtractionResult = {
  items: ExtractedTestimonialKnowledgeItem[];
};

export const MAX_TESTIMONIAL_QUOTE_LENGTH = 4000;

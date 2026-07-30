/**
 * Smart Uploads — domain model.
 *
 * The goal is not file storage: every uploaded document is turned into
 * normalized, reusable Business Brain knowledge (lib/smart-uploads/normalize.ts),
 * not just a stored file with an AI summary attached.
 */

export const SmartUploadFileTypes = {
  PDF: "pdf",
  DOCX: "docx",
  TXT: "txt",
  MARKDOWN: "markdown",
  // Reserved for future extractors — the registry (extractors/registry.ts)
  // already has a slot for each; only the concrete extractor is missing.
  POWERPOINT: "powerpoint",
  EXCEL: "excel",
  IMAGE: "image",
  CSV: "csv",
} as const;

export type SmartUploadFileType = (typeof SmartUploadFileTypes)[keyof typeof SmartUploadFileTypes];

/** File types with a real extractor implemented today. */
export const SUPPORTED_FILE_TYPES: readonly SmartUploadFileType[] = [
  SmartUploadFileTypes.PDF,
  SmartUploadFileTypes.DOCX,
  SmartUploadFileTypes.TXT,
  SmartUploadFileTypes.MARKDOWN,
];

export const MAX_SMART_UPLOAD_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

export const SmartUploadDocumentStatuses = {
  UPLOADED: "uploaded",
  PROCESSING: "processing",
  EXTRACTED: "extracted",
  FAILED: "failed",
} as const;

export type SmartUploadDocumentStatus =
  (typeof SmartUploadDocumentStatuses)[keyof typeof SmartUploadDocumentStatuses];

export type SmartUploadDocumentRecord = {
  id: string;
  user_id: string;
  business_profile_id: string;
  file_name: string;
  file_type: SmartUploadFileType;
  storage_path: string;
  file_size_bytes: number;
  status: SmartUploadDocumentStatus;
  extraction_error: string | null;
  fact_count: number;
  uploaded_at: string;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Reusable business-knowledge categories — the whole point of this feature. */
export const KnowledgeCategories = {
  PRODUCT: "product",
  SERVICE: "service",
  PRICING: "pricing",
  TARGET_CUSTOMER: "target_customer",
  GEOGRAPHIC_MARKET: "geographic_market",
  UNIQUE_SELLING_POINT: "unique_selling_point",
  COMPETITIVE_ADVANTAGE: "competitive_advantage",
  SEASONAL_OFFERING: "seasonal_offering",
  FAQ: "faq",
  TERMINOLOGY: "terminology",
  GUARANTEE: "guarantee",
  CERTIFICATION: "certification",
  INDUSTRY_SERVED: "industry_served",
  CALL_TO_ACTION: "call_to_action",
  BRAND_VOICE: "brand_voice",
  IMPORTANT_DATE: "important_date",
} as const;

export type KnowledgeCategory = (typeof KnowledgeCategories)[keyof typeof KnowledgeCategories];

export const KNOWLEDGE_CATEGORY_LABELS: Record<KnowledgeCategory, string> = {
  product: "Product",
  service: "Service",
  pricing: "Pricing",
  target_customer: "Target customer",
  geographic_market: "Geographic market",
  unique_selling_point: "Unique selling point",
  competitive_advantage: "Competitive advantage",
  seasonal_offering: "Seasonal offering",
  faq: "Frequently asked question",
  terminology: "Business terminology",
  guarantee: "Guarantee",
  certification: "Certification",
  industry_served: "Industry served",
  call_to_action: "Call to action",
  brand_voice: "Brand voice",
  important_date: "Important date",
};

export const KnowledgeConfidenceLevels = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
} as const;

export type KnowledgeConfidenceLevel =
  (typeof KnowledgeConfidenceLevels)[keyof typeof KnowledgeConfidenceLevels];

export type SmartUploadKnowledgeFactRecord = {
  id: string;
  user_id: string;
  business_profile_id: string;
  document_id: string;
  category: KnowledgeCategory;
  fact: string;
  /** The exact excerpt this fact was extracted from — grounds the claim in the document. */
  source_excerpt: string | null;
  confidence: KnowledgeConfidenceLevel;
  date_learned: string;
  last_verified_at: string;
  /** Set when a later, corroborating/duplicate fact supersedes this one. */
  superseded_by: string | null;
  created_at: string;
  updated_at: string;
};

/** One item of the raw AI extraction result, before persistence. */
export type ExtractedKnowledgeItem = {
  category: KnowledgeCategory;
  fact: string;
  sourceExcerpt: string | null;
  confidence: KnowledgeConfidenceLevel;
};

export type DocumentExtractionResult = {
  items: ExtractedKnowledgeItem[];
};

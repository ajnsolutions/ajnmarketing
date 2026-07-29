/**
 * Customer Voice — Phase 1 domain model.
 *
 * Structured business intelligence derived from customer feedback.
 * Provider-agnostic: Business Brain never consumes provider-specific payloads.
 * No large AI summaries — themes, counts, confidence, and impact only.
 */

export const CustomerVoiceProviderIds = {
  GOOGLE_BUSINESS_REVIEWS: "google_business_reviews",
  /** Reserved — not implemented in Phase 1. */
  FACEBOOK_REVIEWS: "facebook_reviews",
  YELP_REVIEWS: "yelp_reviews",
  BBB: "bbb",
  WEBSITE_TESTIMONIALS: "website_testimonials",
  CUSTOMER_SURVEYS: "customer_surveys",
  NPS: "nps",
  SUPPORT_TICKETS: "support_tickets",
  LIVE_CHAT: "live_chat",
  EMAIL_FEEDBACK: "email_feedback",
} as const;

export type CustomerVoiceProviderId =
  (typeof CustomerVoiceProviderIds)[keyof typeof CustomerVoiceProviderIds];

export const CustomerVoiceSentiments = {
  POSITIVE: "positive",
  NEUTRAL: "neutral",
  NEGATIVE: "negative",
  MIXED: "mixed",
} as const;

export type CustomerVoiceSentiment =
  (typeof CustomerVoiceSentiments)[keyof typeof CustomerVoiceSentiments];

export const ConfidenceLevels = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
} as const;

export type ConfidenceLevel = (typeof ConfidenceLevels)[keyof typeof ConfidenceLevels];

export const BusinessImpactLevels = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
} as const;

export type BusinessImpactLevel =
  (typeof BusinessImpactLevels)[keyof typeof BusinessImpactLevels];

export const TrendDirections = {
  IMPROVING: "improving",
  STABLE: "stable",
  DECLINING: "declining",
  UNKNOWN: "unknown",
} as const;

export type TrendDirection = (typeof TrendDirections)[keyof typeof TrendDirections];

export const ThemeKinds = {
  STRENGTH: "strength",
  CONCERN: "concern",
  OPPORTUNITY: "opportunity",
  REQUEST: "request",
  DIFFERENTIATOR: "differentiator",
  LANGUAGE: "language",
  SERVICE: "service",
  EMPLOYEE: "employee",
} as const;

export type ThemeKind = (typeof ThemeKinds)[keyof typeof ThemeKinds];

export const VoiceMaturityLabels = {
  WELL_ESTABLISHED: "well_established",
  LIMITED: "limited",
  CONTINUING_TO_LEARN: "continuing_to_learn",
  EMPTY: "empty",
} as const;

export type VoiceMaturityLabel =
  (typeof VoiceMaturityLabels)[keyof typeof VoiceMaturityLabels];

/** Provider-agnostic normalized evidence unit. */
export type NormalizedCustomerEvidence = {
  id: string;
  /** Opaque provider id — consumers must not branch on this for product logic. */
  sourceProviderId: CustomerVoiceProviderId;
  sourceLabel: string;
  occurredAt: string | null;
  sentiment: CustomerVoiceSentiment;
  confidence: ConfidenceLevel;
  originalText: string;
  extractedThemes: string[];
  referencedServices: string[];
  referencedEmployees: string[];
  language: string;
  /** 0–1 weight used when aggregating themes (recency + text richness). */
  evidenceWeight: number;
};

/** Structured theme intelligence — reusable across the platform. */
export type CustomerVoiceTheme = {
  key: string;
  label: string;
  kind: ThemeKind;
  sentiment: CustomerVoiceSentiment;
  confidence: ConfidenceLevel;
  businessImpact: BusinessImpactLevel;
  evidenceCount: number;
  percentageOfReviews: number;
  trendDirection: TrendDirection;
  /** Synonym / phrase variants that clustered into this theme. */
  languageVariants: string[];
  /** Opaque evidence ids that support this theme — not provider payloads. */
  evidenceIds: string[];
  lastUpdated: string;
};

export type SentimentTrendPoint = {
  periodKey: string;
  positiveShare: number;
  negativeShare: number;
  neutralShare: number;
  evidenceCount: number;
};

export type CustomerVoiceScoreBreakdown = {
  reviewVolume: number;
  freshness: number;
  coverage: number;
  confidence: number;
  themeConsistency: number;
  sentimentStability: number;
};

/**
 * INTERNAL numeric score (0–100). Never render to customers.
 * Use `maturityLabel` / `maturityCopy` for natural-language surfaces.
 */
export type CustomerVoiceScore = {
  score: number;
  breakdown: CustomerVoiceScoreBreakdown;
  maturityLabel: VoiceMaturityLabel;
  /** Customer-safe natural language — never includes the numeric score. */
  maturityCopy: string;
};

/** Top-level Customer Voice intelligence package for Business Brain consumers. */
export type CustomerVoiceIntelligence = {
  businessProfileId: string;
  generatedAt: string;
  lastUpdated: string;
  strengths: CustomerVoiceTheme[];
  concerns: CustomerVoiceTheme[];
  opportunities: CustomerVoiceTheme[];
  frequentlyMentionedServices: CustomerVoiceTheme[];
  frequentlyMentionedEmployees: CustomerVoiceTheme[];
  commonCustomerLanguage: CustomerVoiceTheme[];
  requests: CustomerVoiceTheme[];
  sentimentTrends: SentimentTrendPoint[];
  overallSentiment: CustomerVoiceSentiment;
  confidence: ConfidenceLevel;
  businessImpact: BusinessImpactLevel;
  evidenceCount: number;
  percentageOfReviewsCovered: number;
  trendDirection: TrendDirection;
  score: CustomerVoiceScore;
  /** Providers that contributed evidence this run. */
  contributingProviders: CustomerVoiceProviderId[];
  emptyState: "no_evidence" | "insufficient_evidence" | null;
};

/** Raw unit a provider emits before normalization. */
export type ProviderEvidenceInput = {
  externalId: string;
  occurredAt: string | null;
  rating: number | null;
  text: string;
  language?: string;
  authorDisplayName?: string | null;
  metadata?: Record<string, string>;
};

export type CustomerVoiceProviderContext = {
  businessProfileId: string;
  userId: string;
  now?: Date;
};

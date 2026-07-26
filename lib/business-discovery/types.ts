/**
 * AI Business Discovery — domain model.
 *
 * Business Discovery is the orchestration layer behind the future Free Marketing
 * Snapshot (see docs/project-magic/FREE_MARKETING_SNAPSHOT.md). It composes
 * *existing* intelligence (website analysis, the AI Marketing Profile, Google
 * Business Profile connection state, public reviews, Market Context) into one
 * honest, explainable read of a business — it does not replace or duplicate any
 * of those systems, and it introduces no new decision-making authority: Marketing
 * Director remains the sole marketing decision-maker (see
 * docs/MARKETING_DIRECTOR_ARCHITECTURE.md). Business Discovery only understands
 * and explains; it never recommends or acts.
 *
 * Pipeline (docs/project-magic/CUSTOMER_JOURNEYS.md's "Business Brain Creation"):
 *
 *   raw sources -> BusinessDiscoveryObservation[] (collectors.ts)
 *   -> UnifiedBusinessProfile (normalize.ts)
 *   -> BusinessDiscoveryResult (buildResult.ts)
 *   -> (future) Free Marketing Snapshot presentation
 *
 * Every type here is pure data — no I/O. Fetching real source data lives in
 * gather.ts (server-only); orchestration lives in service.ts (server-only).
 */

import type { AiMarketingProfile } from "@/lib/ai-marketing-profile/types";
import type { BusinessProfile } from "@/lib/business-profile";
import type { GoogleBusinessReview } from "@/lib/google-business/types";
import type { GoogleBusinessProfileConnectionStatus } from "@/lib/google-business-profile/types";
import type { MarketContextBriefWithItems } from "@/lib/market-context/types";
import type { WebsiteAnalysis } from "@/lib/website-analysis/types";

/**
 * Every source Business Discovery can currently or eventually draw from. This
 * list is designed to grow — adding a new value here, plus a new collector
 * function, is additive and never requires changing an existing collector,
 * UnifiedBusinessProfile's shape, or BusinessDiscoveryResult's shape. This is
 * the "extensible without future breaking changes" requirement made concrete.
 */
export const DiscoverySourceTypes = {
  /** Business-profile fields the owner entered directly (onboarding/Settings). */
  BUSINESS_PROFILE: "business_profile",
  /** Raw, fetched website content and metadata (meta title/description, H1s). */
  WEBSITE: "website",
  /** The existing AI-generated website-analysis extraction. */
  AI_WEBSITE_ANALYSIS: "ai_website_analysis",
  /** The existing AI Marketing Profile synthesis. */
  AI_MARKETING_PROFILE: "ai_marketing_profile",
  /** Google Business Profile connection/presence state. */
  GOOGLE_BUSINESS_PROFILE: "google_business_profile",
  /** Public reviews (currently sourced from connected Google Business reviews). */
  PUBLIC_REVIEWS: "public_reviews",
  /** Social presence (no connector exists yet — reserved for a future wave). */
  SOCIAL_PRESENCE: "social_presence",
  /** Existing Market Context signals (competitor/seasonal/local-event evidence). */
  MARKET_CONTEXT: "market_context",
  /** Any future connector category (see docs/project-magic/CONNECTOR_FRAMEWORK.md). */
  FUTURE_CONNECTOR: "future_connector",
  /** Manually uploaded documents (see docs/project-magic/SMART_UPLOADS.md) — placeholder, no collector yet. */
  SMART_UPLOAD: "smart_upload",
} as const;

export type DiscoverySourceType = (typeof DiscoverySourceTypes)[keyof typeof DiscoverySourceTypes];

/**
 * How sure Business Discovery is about a piece of information — the customer-
 * facing vocabulary the whole engine is built around (see the Discovery Output
 * spec: "Separating: Known, Assumed, Missing").
 *
 * - KNOWN: confirmed by the owner directly, or read from a structured, owner-
 *   authoritative field (e.g. a Settings form field) or a connected system's
 *   structured data (e.g. Google Business Profile connection state).
 * - ASSUMED: inferred by AI from unstructured evidence (website copy, review
 *   text) — plausible, evidence-linked, but never presented as confirmed fact.
 * - MISSING: no evidence found from any source yet.
 */
export const DiscoveryConfidenceTiers = {
  KNOWN: "known",
  ASSUMED: "assumed",
  MISSING: "missing",
} as const;

export type DiscoveryConfidenceTier =
  (typeof DiscoveryConfidenceTiers)[keyof typeof DiscoveryConfidenceTiers];

/**
 * A single evidence trail entry backing a DiscoveryInsight — the concrete
 * "because X" behind every "we believe" statement. Mirrors the evidence-linking
 * discipline already established in lib/marketing-memory/evidenceTypes.ts.
 */
export type DiscoveryEvidenceRef = {
  source: DiscoverySourceType;
  /** Plain-language pointer to the specific evidence, e.g. "3 of 5 public reviews mention residential service". */
  detail: string;
};

/**
 * One raw, source-tagged fact collected before normalization — the "raw
 * observations" layer of the Business Brain (see
 * docs/project-magic/BUSINESS_BRAIN.md). Never merged or deduplicated; that
 * happens in normalize.ts.
 */
export type BusinessDiscoveryObservation = {
  source: DiscoverySourceType;
  /** Logical field name this observation contributes to, e.g. "primaryServices". */
  field: string;
  value: unknown;
  /**
   * True for owner-entered fields, structured connector/system state, and
   * arithmetic aggregates over real records (e.g. an average star rating).
   * False for AI-derived inferences from unstructured text (website copy,
   * AI Marketing Profile synthesis). This is the axis Known vs. Assumed is
   * built from downstream — never an AI confidence score standing in for it.
   */
  isVerifiedFact: boolean;
  /** Plain-language description of where this specific value came from. */
  evidenceDetail: string;
  collectedAt: string;
};

/**
 * A single normalized, deduplicated field in the UnifiedBusinessProfile — the
 * merge point between "how many sources agree" and "does any of them count as
 * owner-confirmed", which downstream drives Known vs. Assumed tiering.
 */
export type MergedField<T> = {
  value: T | null;
  contributingSources: DiscoverySourceType[];
  hasVerifiedFactSource: boolean;
  evidenceRefs: DiscoveryEvidenceRef[];
};

/**
 * The normalized, deduplicated aggregate view of a business — the midpoint of
 * the pipeline. Still structural data, not yet the narrative
 * BusinessDiscoveryResult a Free Marketing Snapshot would present.
 */
export type UnifiedBusinessProfile = {
  businessProfileId: string;
  businessName: MergedField<string>;
  businessSummary: MergedField<string>;
  industry: MergedField<string>;
  website: MergedField<string>;
  primaryServices: MergedField<string[]>;
  serviceAreas: MergedField<string[]>;
  tone: MergedField<string>;
  brandPersonality: MergedField<string[]>;
  targetAudience: MergedField<string>;
  competitors: MergedField<string[]>;
  strengths: MergedField<string[]>;
  growthOpportunities: MergedField<string[]>;
  reviewSummary: MergedField<ReviewSummary>;
  googleBusinessProfileConnected: MergedField<boolean>;
  websiteAnalyzed: MergedField<boolean>;
};

export type ReviewSummary = {
  reviewCount: number;
  averageRating: number;
};

/**
 * The bundle of already-fetched source data collectors.ts turns into
 * observations. Gathering (the I/O) lives in gather.ts — this is just the
 * shape, so collectors.ts stays pure and unit-testable without a database.
 * Every field is independently nullable/empty: Business Discovery must run
 * honestly on a business with only one or two sources connected.
 */
export type BusinessDiscoverySources = {
  businessProfile: BusinessProfile | null;
  websiteAnalysis: WebsiteAnalysis | null;
  aiMarketingProfile: AiMarketingProfile | null;
  googleBusinessConnection: GoogleBusinessProfileConnectionStatus | null;
  publicReviews: GoogleBusinessReview[];
  marketContext: MarketContextBriefWithItems | null;
};

/**
 * One explainable insight — the unit every field in a BusinessDiscoveryResult is
 * built from. Every discovered insight carries Source + Confidence + Reason, per
 * this milestone's explainability requirement.
 */
export type DiscoveryInsight<T> = {
  value: T | null;
  confidenceTier: DiscoveryConfidenceTier;
  /**
   * Internal 0-100 score. Never shown to a customer as a raw number — always
   * translated through confidenceLabels.ts, mirroring the existing rule in
   * lib/recommendation-presentation/confidenceLabels.ts ("never shows a raw
   * percentage").
   */
  confidenceScore: number;
  sources: DiscoverySourceType[];
  /** Plain-language "why" — e.g. "because your website repeatedly references residential HVAC installation". */
  reason: string;
  evidenceRefs: DiscoveryEvidenceRef[];
};

export type OnlinePresenceInsight = {
  website: DiscoveryInsight<{ connected: boolean; analyzed: boolean }>;
  googleBusinessProfile: DiscoveryInsight<{ connected: boolean }>;
  socialPresence: DiscoveryInsight<null>;
};

export type MissingInformationItem = {
  /** Matches a BusinessDiscoveryResult key so a future UI can deep-link to the right onboarding step. */
  field: string;
  reason: string;
  suggestedNextAction: string;
};

/**
 * Plain-language label for the overall Business Confidence Score — see
 * confidenceLabels.ts. Never a letter grade or raw percentage on its own.
 */
export const BusinessConfidenceLabels = {
  JUST_GETTING_STARTED: "just_getting_started",
  BUILDING_A_PICTURE: "building_a_picture",
  GOOD_UNDERSTANDING: "good_understanding",
  DEEP_UNDERSTANDING: "deep_understanding",
} as const;

export type BusinessConfidenceLabel =
  (typeof BusinessConfidenceLabels)[keyof typeof BusinessConfidenceLabels];

export type BusinessConfidenceSummary = {
  /** Internal 0-100 composite. Not customer-facing on its own — see confidenceLabels.ts. */
  score: number;
  label: BusinessConfidenceLabel;
  explanation: string;
  knownFieldCount: number;
  assumedFieldCount: number;
  missingFieldCount: number;
};

/**
 * The Business Discovery output — designed around business *understanding*,
 * never marketing metrics. This is the shape a future Free Marketing Snapshot
 * (and, later, the wider Business Brain view) presents. No visual styling
 * concerns here — pure structured content.
 */
export type BusinessDiscoveryResult = {
  businessProfileId: string;
  generatedAt: string;
  businessSummary: DiscoveryInsight<string>;
  primaryServices: DiscoveryInsight<string[]>;
  targetCustomers: DiscoveryInsight<string>;
  brandPersonality: DiscoveryInsight<string[]>;
  uniqueStrengths: DiscoveryInsight<string[]>;
  customerPerception: DiscoveryInsight<string>;
  competitivePosition: DiscoveryInsight<string[]>;
  onlinePresence: OnlinePresenceInsight;
  growthOpportunities: DiscoveryInsight<string[]>;
  missingInformation: MissingInformationItem[];
  businessConfidence: BusinessConfidenceSummary;
};

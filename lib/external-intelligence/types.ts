/**
 * External Intelligence — foundation domain model.
 *
 * Structured understanding of the world around a business.
 * Provider-agnostic: Business Brain never consumes provider-specific payloads.
 * Implements the shared BusinessInsight contract.
 *
 * Phase 1: architecture only — no UI / Growth Advisor / Health wiring.
 */

import type {
  BusinessImpactLevel,
  BusinessInsight,
  BusinessInsightEvidence,
  BusinessInsightPossibleAction,
  ConfidenceLevel,
  TimeHorizon,
} from "@/lib/business-brain/insight";
import {
  BusinessImpactLevels,
  ConfidenceLevels,
  TimeHorizons,
} from "@/lib/business-brain/insight";

export {
  BusinessImpactLevels,
  ConfidenceLevels,
  TimeHorizons,
};
export type {
  BusinessImpactLevel,
  BusinessInsight,
  BusinessInsightEvidence,
  BusinessInsightPossibleAction,
  ConfidenceLevel,
  TimeHorizon,
};

export const ExternalIntelligenceProviderIds = {
  GOOGLE_TRENDS: "google_trends",
  WEATHER: "weather",
  LOCAL_EVENTS: "local_events",
  INDUSTRY_NEWS: "industry_news",
  GOOGLE_BUSINESS_INSIGHTS: "google_business_insights",
  COMPETITOR_MONITORING: "competitor_monitoring",
  HOLIDAY_CALENDAR: "holiday_calendar",
  SEARCH_CONSOLE: "search_console",
  /** Reserved — not implemented in foundation. */
  MARKET_CONTEXT_BRIDGE: "market_context_bridge",
} as const;

export type ExternalIntelligenceProviderId =
  (typeof ExternalIntelligenceProviderIds)[keyof typeof ExternalIntelligenceProviderIds];

export const ExternalIntelligenceCategories = {
  SEASONAL_OPPORTUNITIES: "seasonal_opportunities",
  LOCAL_EVENTS: "local_events",
  SEARCH_DEMAND_TRENDS: "search_demand_trends",
  COMPETITOR_ACTIVITY: "competitor_activity",
  INDUSTRY_REGULATORY_UPDATES: "industry_regulatory_updates",
  WEATHER: "weather",
  HOLIDAY_CALENDAR: "holiday_calendar",
} as const;

export type ExternalIntelligenceCategory =
  (typeof ExternalIntelligenceCategories)[keyof typeof ExternalIntelligenceCategories];

export const ExternalMaturityLabels = {
  WELL_UNDERSTOOD: "well_understood",
  STILL_DEVELOPING: "still_developing",
  MONITORING: "monitoring",
  EMPTY: "empty",
} as const;

export type ExternalMaturityLabel =
  (typeof ExternalMaturityLabels)[keyof typeof ExternalMaturityLabels];

/** Raw unit a provider emits before normalization. */
export type ProviderSignalInput = {
  externalId: string;
  category: ExternalIntelligenceCategory;
  title: string;
  summary: string;
  occurredAt: string | null;
  /** Optional ISO end / relevance window. */
  expiresAt?: string | null;
  /** 0–1 provider-self quality hint — never treated as final confidence. */
  signalStrength?: number | null;
  /** Opaque goal keys the provider believes may relate — validated later. */
  relatedGoalHints?: string[];
  /** Suggested action labels only — never prioritized. */
  actionHints?: string[];
  metadata?: Record<string, string>;
};

export type ExternalIntelligenceProviderContext = {
  businessProfileId: string;
  userId: string;
  /** Optional known goal keys for relatedGoals linkage. */
  knownGoalKeys?: string[];
  now?: Date;
};

/** Provider-agnostic normalized signal. */
export type NormalizedExternalSignal = {
  id: string;
  sourceProviderId: ExternalIntelligenceProviderId;
  sourceLabel: string;
  category: ExternalIntelligenceCategory;
  title: string;
  summary: string;
  occurredAt: string | null;
  expiresAt: string | null;
  signalStrength: number;
  relatedGoalHints: string[];
  actionHints: string[];
  /** 0–1 weight used when aggregating (recency + strength + provider reliability). */
  evidenceWeight: number;
  quality: ConfidenceLevel;
};

/**
 * External Intelligence insight — implements BusinessInsight with a constrained category.
 */
export type ExternalIntelligenceInsight = BusinessInsight & {
  category: ExternalIntelligenceCategory;
  /** Canonical cluster key used when merging corroborating signals. */
  clusterKey: string;
  /** Distinct providers that corroborated this insight. */
  corroboratingProviderCount: number;
};

export type ExternalIntelligenceScoreBreakdown = {
  signalVolume: number;
  freshness: number;
  coverage: number;
  confidence: number;
  corroboration: number;
  categoryBreadth: number;
};

/**
 * INTERNAL numeric score (0–100). Never render to customers.
 * Use `maturityLabel` / `maturityCopy` for natural-language surfaces.
 */
export type ExternalIntelligenceScore = {
  score: number;
  breakdown: ExternalIntelligenceScoreBreakdown;
  maturityLabel: ExternalMaturityLabel;
  /** Customer-safe natural language — never includes the numeric score. */
  maturityCopy: string;
};

/** Top-level External Intelligence package for Business Brain consumers. */
export type ExternalIntelligence = {
  businessProfileId: string;
  generatedAt: string;
  lastUpdated: string;
  insights: ExternalIntelligenceInsight[];
  seasonalOpportunities: ExternalIntelligenceInsight[];
  localEvents: ExternalIntelligenceInsight[];
  searchDemandTrends: ExternalIntelligenceInsight[];
  competitorActivity: ExternalIntelligenceInsight[];
  industryRegulatoryUpdates: ExternalIntelligenceInsight[];
  weather: ExternalIntelligenceInsight[];
  holidayCalendar: ExternalIntelligenceInsight[];
  confidence: ConfidenceLevel;
  businessImpact: BusinessImpactLevel;
  evidenceCount: number;
  score: ExternalIntelligenceScore;
  contributingProviders: ExternalIntelligenceProviderId[];
  emptyState: "no_evidence" | "insufficient_evidence" | null;
};

/** Default reliability weights per provider (0–1). Never treats any source as certain. */
export const PROVIDER_RELIABILITY: Record<ExternalIntelligenceProviderId, number> = {
  [ExternalIntelligenceProviderIds.GOOGLE_TRENDS]: 0.75,
  [ExternalIntelligenceProviderIds.WEATHER]: 0.8,
  [ExternalIntelligenceProviderIds.LOCAL_EVENTS]: 0.65,
  [ExternalIntelligenceProviderIds.INDUSTRY_NEWS]: 0.6,
  [ExternalIntelligenceProviderIds.GOOGLE_BUSINESS_INSIGHTS]: 0.7,
  [ExternalIntelligenceProviderIds.COMPETITOR_MONITORING]: 0.55,
  [ExternalIntelligenceProviderIds.HOLIDAY_CALENDAR]: 0.9,
  [ExternalIntelligenceProviderIds.SEARCH_CONSOLE]: 0.8,
  [ExternalIntelligenceProviderIds.MARKET_CONTEXT_BRIDGE]: 0.5,
};

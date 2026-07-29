/**
 * External Intelligence — public pure exports for foundation.
 * Server I/O lives in service.ts (server-only).
 */

export type {
  BusinessImpactLevel,
  BusinessInsight,
  BusinessInsightEvidence,
  BusinessInsightPossibleAction,
  ConfidenceLevel,
  ExternalIntelligence,
  ExternalIntelligenceCategory,
  ExternalIntelligenceInsight,
  ExternalIntelligenceProviderContext,
  ExternalIntelligenceProviderId,
  ExternalIntelligenceScore,
  ExternalMaturityLabel,
  NormalizedExternalSignal,
  ProviderSignalInput,
  TimeHorizon,
} from "@/lib/external-intelligence/types";

export {
  BusinessImpactLevels,
  ConfidenceLevels,
  ExternalIntelligenceCategories,
  ExternalIntelligenceProviderIds,
  ExternalMaturityLabels,
  PROVIDER_RELIABILITY,
  TimeHorizons,
} from "@/lib/external-intelligence/types";

export type {
  ExternalIntelligenceProvider,
  ExternalIntelligenceProviderResult,
  ExternalIntelligenceProviderRegistry,
} from "@/lib/external-intelligence/provider";
export {
  createExternalIntelligenceProviderRegistry,
  createUnimplementedProvider,
} from "@/lib/external-intelligence/provider";

export {
  clusterKeyForSignal,
  normalizeProviderBatch,
  normalizeProviderSignal,
} from "@/lib/external-intelligence/normalize";
export { calculateExternalConfidence, rollupConfidence } from "@/lib/external-intelligence/confidence";
export {
  calculateExternalBusinessImpact,
  defaultImpactHintsForCategory,
  rollupBusinessImpact,
} from "@/lib/external-intelligence/impact";
export {
  calculateExternalIntelligenceScore,
  maturityCopyFor,
} from "@/lib/external-intelligence/score";
export { composeExternalIntelligence } from "@/lib/external-intelligence/compose";
export { possibleActionsForCategory } from "@/lib/external-intelligence/possibleActions";
export {
  createCompetitorMonitoringProvider,
  createDesignedExternalProviders,
  createGoogleBusinessInsightsProvider,
  createGoogleTrendsProvider,
  createHolidayCalendarProvider,
  createIndustryNewsProvider,
  createLocalEventsProvider,
  createSearchConsoleProvider,
  createWeatherProvider,
} from "@/lib/external-intelligence/providers/designed";

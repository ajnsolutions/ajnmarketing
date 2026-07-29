/**
 * Customer Voice — public pure exports (foundation + experience presentation).
 * Server I/O lives in service.ts (server-only).
 */

export type {
  BusinessImpactLevel,
  ConfidenceLevel,
  CustomerVoiceIntelligence,
  CustomerVoiceProviderId,
  CustomerVoiceScore,
  CustomerVoiceSentiment,
  CustomerVoiceTheme,
  NormalizedCustomerEvidence,
  ProviderEvidenceInput,
  SentimentTrendPoint,
  ThemeKind,
  TrendDirection,
  VoiceMaturityLabel,
} from "@/lib/customer-voice/types";

export {
  BusinessImpactLevels,
  ConfidenceLevels,
  CustomerVoiceProviderIds,
  CustomerVoiceSentiments,
  ThemeKinds,
  TrendDirections,
  VoiceMaturityLabels,
} from "@/lib/customer-voice/types";

export type { CustomerVoiceProvider, CustomerVoiceProviderResult } from "@/lib/customer-voice/provider";
export { createProviderRegistry } from "@/lib/customer-voice/provider";

export { normalizeProviderBatch, normalizeProviderEvidence } from "@/lib/customer-voice/normalize";
export {
  extractThemesFromText,
  mergeThemeKeys,
  sentimentFromTextAndRating,
} from "@/lib/customer-voice/themes";
export { calculateThemeConfidence, rollupConfidence } from "@/lib/customer-voice/confidence";
export { calculateBusinessImpact, rollupBusinessImpact } from "@/lib/customer-voice/impact";
export { calculateCustomerVoiceScore, maturityCopyFor } from "@/lib/customer-voice/score";
export { composeCustomerVoiceIntelligence } from "@/lib/customer-voice/compose";
export {
  createGoogleBusinessReviewsProvider,
  mapGoogleReviewToEvidence,
} from "@/lib/customer-voice/providers/googleBusinessReviews";
export { THEME_CLUSTERS, clusterKeyForVariant } from "@/lib/customer-voice/themeLexicon";

export type { PossibleAction } from "@/lib/customer-voice/possibleActions";
export {
  insightSentenceForTheme,
  possibleActionsForTheme,
} from "@/lib/customer-voice/possibleActions";

export type {
  MarketingCopySuggestion,
  MarketingCopySurface,
} from "@/lib/customer-voice/copySuggestions";
export {
  buildMarketingCopySuggestions,
  formatCustomerVoiceForContentPrompt,
} from "@/lib/customer-voice/copySuggestions";

export type {
  CustomerVoiceHealth,
  CustomerVoiceHealthState,
} from "@/lib/customer-voice/health";
export {
  CustomerVoiceHealthStates,
  resolveCustomerVoiceHealth,
} from "@/lib/customer-voice/health";

export type {
  CustomerVoiceInsightCard,
  CustomerVoicePageModel,
} from "@/lib/customer-voice/presentation";
export {
  buildCustomerVoicePageModel,
  growthAdvisorCustomerVoiceLines,
  toInsightCard,
} from "@/lib/customer-voice/presentation";

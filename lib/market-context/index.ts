export type {
  MarketContextBrief,
  MarketContextBriefStatus,
  MarketContextBriefWithItems,
  MarketContextCategory,
  MarketContextItem,
  MarketContextItemInput,
  MarketContextPageData,
  MarketContextPromptSummary,
  MarketContextProviderContext,
  ScoredMarketContextItem,
} from "@/lib/market-context/types";

export {
  buildMarketContextPromptSummary,
  formatMarketContextPromptSummary,
} from "@/lib/market-context/prompt-context";

export {
  formatMarketContextCategory,
  formatMarketContextDate,
  formatMarketContextStatus,
  formatMarketContextWeekLabel,
} from "@/lib/market-context/persistence";

export {
  generateWeeklyMarketContextBrief,
  getLatestMarketContextBriefForCurrentUser,
  getLatestMarketContextBriefForUser,
  getMarketContextPageDataForCurrentUser,
  refreshMarketContextBriefForCurrentUser,
} from "@/lib/market-context/marketContextService";

export {
  getContextSignalSourceKind,
  getContextSignalSourceLabel,
  getContextSignalSourceStyles,
} from "@/lib/market-context/signal-source";

export {
  buildContentAngles,
  buildHighOpportunityKeywords,
  buildOverallSummary,
  buildRecommendedTopics,
  scoreAndRankMarketContextItems,
  scoreMarketContextItem,
} from "@/lib/market-context/contextScoringService";

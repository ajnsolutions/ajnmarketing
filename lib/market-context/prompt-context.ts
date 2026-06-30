import type { MarketContextBriefWithItems, MarketContextPromptSummary } from "@/lib/market-context/types";
import { formatMarketContextWeekLabel } from "@/lib/market-context/persistence";

function mapSignalItem(item: MarketContextBriefWithItems["items"][number]) {
  return {
    category: item.category,
    title: item.title,
    summary: item.summary,
    relevanceScore: item.relevance_score,
  };
}

export function buildMarketContextPromptSummary(
  briefWithItems: MarketContextBriefWithItems | null
): MarketContextPromptSummary | null {
  if (!briefWithItems?.brief || briefWithItems.brief.status !== "active") {
    return null;
  }

  const { brief, items } = briefWithItems;
  const localEventItems = items.filter((item) => item.category === "local_event");
  const competitorItems = items.filter((item) => item.category === "competitor");

  const prioritizedTopSignals = [
    ...localEventItems.slice(0, 2),
    ...competitorItems.slice(0, 2),
    ...items.filter(
      (item) => item.category !== "local_event" && item.category !== "competitor"
    ),
  ]
    .slice(0, 8)
    .map(mapSignalItem);

  return {
    weekLabel: formatMarketContextWeekLabel(brief.brief_start_date, brief.brief_end_date),
    overallSummary: brief.overall_summary,
    recommendedTopics: brief.recommended_topics,
    highOpportunityKeywords: brief.high_opportunity_keywords,
    contentAngles: brief.content_angles,
    topSignals: prioritizedTopSignals,
    localEventSignals: localEventItems.slice(0, 4).map((item) => ({
      title: item.title,
      summary: item.summary,
      sourceName: item.source_name,
      sourceUrl: item.source_url,
      relevanceScore: item.relevance_score,
    })),
    competitorSignals: competitorItems.slice(0, 4).map((item) => ({
      title: item.title,
      summary: item.summary,
      sourceName: item.source_name,
      sourceUrl: item.source_url,
      relevanceScore: item.relevance_score,
      isProfileBased: item.metadata?.isProfileBased === true,
    })),
  };
}

export function formatMarketContextPromptSummary(summary: MarketContextPromptSummary | null): string {
  if (!summary) {
    return "";
  }

  return JSON.stringify(
    {
      weekLabel: summary.weekLabel,
      overallSummary: summary.overallSummary,
      recommendedTopics: summary.recommendedTopics,
      highOpportunityKeywords: summary.highOpportunityKeywords,
      contentAngles: summary.contentAngles,
      topSignals: summary.topSignals,
      localEventSignals: summary.localEventSignals,
      competitorSignals: summary.competitorSignals,
    },
    null,
    2
  );
}

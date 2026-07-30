/**
 * Turn stored Search Console metric comparisons (current vs. previous period, by
 * query and by page) into External Intelligence `ProviderSignalInput`s.
 *
 * Every insight here is a plain, checkable comparison over the two stored periods —
 * nothing here infers a cause, only reports an observed change. Growth Advisor and
 * the Weekly Growth Plan add the "likely" / "recommended" framing on top of this
 * evidence; this module never phrases a conclusion, only an observation.
 */

import { ExternalIntelligenceCategories, type ProviderSignalInput } from "@/lib/external-intelligence/types";

export type SearchConsoleMetricRow = {
  value: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number | null;
};

const MIN_CLICKS_FOR_TREND = 3;
const RISING_RATIO = 1.5;
const DECLINING_RATIO = 0.5;
const EMERGING_RATIO = 3;
const OPPORTUNITY_MIN_IMPRESSIONS = 50;
const OPPORTUNITY_MAX_CTR = 0.02;
const VISIBILITY_IMPRESSION_RATIO_GAIN = 1.5;
const VISIBILITY_IMPRESSION_RATIO_LOSS = 0.5;
const POSITION_IMPROVEMENT_THRESHOLD = 2;
const POSITION_DECLINE_THRESHOLD = 3;
const MAX_SIGNALS_PER_KIND = 5;

function byRow(rows: SearchConsoleMetricRow[]): Map<string, SearchConsoleMetricRow> {
  return new Map(rows.map((row) => [row.value, row]));
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export function findRisingQueries(
  currentQueries: SearchConsoleMetricRow[],
  previousQueries: SearchConsoleMetricRow[]
): ProviderSignalInput[] {
  const previousByQuery = byRow(previousQueries);

  return currentQueries
    .map((row) => ({ row, previous: previousByQuery.get(row.value) }))
    .filter(({ row, previous }) => {
      const prevClicks = previous?.clicks ?? 0;
      return row.clicks >= MIN_CLICKS_FOR_TREND && row.clicks >= prevClicks * RISING_RATIO && row.clicks > prevClicks;
    })
    .sort((a, b) => {
      const deltaA = a.row.clicks - (a.previous?.clicks ?? 0);
      const deltaB = b.row.clicks - (b.previous?.clicks ?? 0);
      return deltaB - deltaA;
    })
    .slice(0, MAX_SIGNALS_PER_KIND)
    .map(({ row, previous }) => {
      const prevClicks = previous?.clicks ?? 0;
      return {
        externalId: `rising_query:${row.value}`,
        category: ExternalIntelligenceCategories.SEARCH_DEMAND_TRENDS,
        title: `Rising query: "${row.value}"`,
        summary:
          prevClicks > 0
            ? `Organic clicks for "${row.value}" grew from ${prevClicks} to ${row.clicks} over the last period.`
            : `"${row.value}" started bringing organic clicks this period (${row.clicks} clicks, previously none recorded).`,
        occurredAt: null,
        signalStrength: Math.min(1, 0.5 + row.clicks / 100),
        actionHints: [`Consider content that expands on "${row.value}".`],
        metadata: { kind: "rising_query", clicks: String(row.clicks), previousClicks: String(prevClicks) },
      } satisfies ProviderSignalInput;
    });
}

export function findDecliningQueries(
  currentQueries: SearchConsoleMetricRow[],
  previousQueries: SearchConsoleMetricRow[]
): ProviderSignalInput[] {
  const currentByQuery = byRow(currentQueries);

  return previousQueries
    .filter((row) => row.clicks >= MIN_CLICKS_FOR_TREND)
    .map((row) => ({ row, current: currentByQuery.get(row.value) }))
    .filter(({ row, current }) => (current?.clicks ?? 0) <= row.clicks * DECLINING_RATIO)
    .sort((a, b) => b.row.clicks - a.row.clicks)
    .slice(0, MAX_SIGNALS_PER_KIND)
    .map(({ row, current }) => {
      const currentClicks = current?.clicks ?? 0;
      return {
        externalId: `declining_query:${row.value}`,
        category: ExternalIntelligenceCategories.SEARCH_DEMAND_TRENDS,
        title: `Declining query: "${row.value}"`,
        summary: `Organic clicks for "${row.value}" fell from ${row.clicks} to ${currentClicks} over the last period.`,
        occurredAt: null,
        signalStrength: Math.min(1, 0.5 + row.clicks / 100),
        actionHints: [`Review whether existing content for "${row.value}" still matches what searchers want.`],
        metadata: { kind: "declining_query", clicks: String(currentClicks), previousClicks: String(row.clicks) },
      } satisfies ProviderSignalInput;
    });
}

export function findEmergingQueries(
  currentQueries: SearchConsoleMetricRow[],
  previousQueries: SearchConsoleMetricRow[]
): ProviderSignalInput[] {
  const previousByQuery = byRow(previousQueries);

  return currentQueries
    .map((row) => ({ row, previous: previousByQuery.get(row.value) }))
    .filter(({ row, previous }) => {
      const prevClicks = previous?.clicks ?? 0;
      return row.clicks >= MIN_CLICKS_FOR_TREND * 2 && (prevClicks === 0 || row.clicks >= prevClicks * EMERGING_RATIO);
    })
    .sort((a, b) => b.row.clicks - a.row.clicks)
    .slice(0, MAX_SIGNALS_PER_KIND)
    .map(({ row, previous }) => ({
      externalId: `seasonal_shift:${row.value}`,
      category: ExternalIntelligenceCategories.SEARCH_DEMAND_TRENDS,
      title: `Possible seasonal or trend shift: "${row.value}"`,
      summary: `"${row.value}" jumped to ${row.clicks} clicks this period (from ${previous?.clicks ?? 0}) — this may reflect a seasonal pattern or an emerging trend, not necessarily a lasting change.`,
      occurredAt: null,
      signalStrength: 0.55,
      actionHints: [`Watch "${row.value}" for another period before committing significant content investment.`],
      metadata: { kind: "seasonal_change", clicks: String(row.clicks) },
    } satisfies ProviderSignalInput));
}

export function findVisibilityChanges(
  currentPages: SearchConsoleMetricRow[],
  previousPages: SearchConsoleMetricRow[]
): { gaining: ProviderSignalInput[]; losing: ProviderSignalInput[] } {
  const previousByPage = byRow(previousPages);

  const gaining: ProviderSignalInput[] = [];
  const losing: ProviderSignalInput[] = [];

  for (const row of currentPages) {
    const previous = previousByPage.get(row.value);
    const prevImpressions = previous?.impressions ?? 0;
    const positionImproved =
      previous?.position != null && row.position != null && previous.position - row.position >= POSITION_IMPROVEMENT_THRESHOLD;

    if (row.impressions >= prevImpressions * VISIBILITY_IMPRESSION_RATIO_GAIN && row.impressions > prevImpressions) {
      gaining.push({
        externalId: `page_gaining:${row.value}`,
        category: ExternalIntelligenceCategories.SEARCH_DEMAND_TRENDS,
        title: `Page gaining visibility: ${row.value}`,
        summary: `${row.value} went from ${prevImpressions} to ${row.impressions} search impressions.`,
        occurredAt: null,
        signalStrength: 0.6,
        actionHints: [`Keep this page updated — it's earning more search visibility.`],
        metadata: { kind: "page_gaining_visibility", impressions: String(row.impressions) },
      });
    } else if (positionImproved) {
      gaining.push({
        externalId: `page_gaining_position:${row.value}`,
        category: ExternalIntelligenceCategories.SEARCH_DEMAND_TRENDS,
        title: `Page ranking improved: ${row.value}`,
        summary: `${row.value}'s average search position improved from ${previous!.position!.toFixed(1)} to ${row.position?.toFixed(1) ?? "—"}.`,
        occurredAt: null,
        signalStrength: 0.6,
        actionHints: [`Keep this page updated — it's ranking better.`],
        metadata: { kind: "page_gaining_visibility", position: String(row.position ?? "") },
      });
    }

    if (prevImpressions >= MIN_CLICKS_FOR_TREND && row.impressions <= prevImpressions * VISIBILITY_IMPRESSION_RATIO_LOSS) {
      losing.push({
        externalId: `page_losing:${row.value}`,
        category: ExternalIntelligenceCategories.SEARCH_DEMAND_TRENDS,
        title: `Page losing visibility: ${row.value}`,
        summary: `${row.value} went from ${prevImpressions} to ${row.impressions} search impressions.`,
        occurredAt: null,
        signalStrength: 0.6,
        actionHints: [`Review ${row.value} for outdated content or a technical issue.`],
        metadata: { kind: "page_losing_visibility", impressions: String(row.impressions) },
      });
    } else if (
      previous?.position != null &&
      row.position != null &&
      row.position - previous.position >= POSITION_DECLINE_THRESHOLD
    ) {
      losing.push({
        externalId: `page_losing_position:${row.value}`,
        category: ExternalIntelligenceCategories.SEARCH_DEMAND_TRENDS,
        title: `Page ranking declined: ${row.value}`,
        summary: `${row.value}'s average search position dropped from ${previous.position.toFixed(1)} to ${row.position.toFixed(1)}.`,
        occurredAt: null,
        signalStrength: 0.55,
        actionHints: [`Review ${row.value} for outdated content or new competing pages.`],
        metadata: { kind: "page_losing_visibility", position: String(row.position) },
      });
    }
  }

  return {
    gaining: gaining.slice(0, MAX_SIGNALS_PER_KIND),
    losing: losing.slice(0, MAX_SIGNALS_PER_KIND),
  };
}

export function findOpportunities(currentQueries: SearchConsoleMetricRow[]): ProviderSignalInput[] {
  return currentQueries
    .filter((row) => row.impressions >= OPPORTUNITY_MIN_IMPRESSIONS && row.ctr <= OPPORTUNITY_MAX_CTR)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, MAX_SIGNALS_PER_KIND)
    .map((row) => ({
      externalId: `opportunity:${row.value}`,
      category: ExternalIntelligenceCategories.SEARCH_DEMAND_TRENDS,
      title: `Search opportunity: "${row.value}"`,
      summary: `"${row.value}" appeared in search ${row.impressions} times but was only clicked ${pct(row.ctr)} of the time — people are searching this but not choosing this result.`,
      occurredAt: null,
      signalStrength: Math.min(1, 0.5 + row.impressions / 500),
      actionHints: [`Improve the title/description or content depth for "${row.value}" to earn more clicks from existing visibility.`],
      metadata: { kind: "opportunity", impressions: String(row.impressions), ctr: String(row.ctr) },
    } satisfies ProviderSignalInput));
}

export function buildSearchConsoleSignals(input: {
  currentQueries: SearchConsoleMetricRow[];
  previousQueries: SearchConsoleMetricRow[];
  currentPages: SearchConsoleMetricRow[];
  previousPages: SearchConsoleMetricRow[];
}): ProviderSignalInput[] {
  const rising = findRisingQueries(input.currentQueries, input.previousQueries);
  const declining = findDecliningQueries(input.currentQueries, input.previousQueries);
  const emerging = findEmergingQueries(input.currentQueries, input.previousQueries);
  const { gaining, losing } = findVisibilityChanges(input.currentPages, input.previousPages);
  const opportunities = findOpportunities(input.currentQueries);

  return [...rising, ...declining, ...emerging, ...gaining, ...losing, ...opportunities];
}

/**
 * Compose External Intelligence from normalized signals.
 * Pure — no I/O. Providers feed signals; compose produces Business Brain package.
 * Corroborating evidence across providers increases confidence.
 */

import { calculateExternalConfidence, rollupConfidence } from "@/lib/external-intelligence/confidence";
import {
  calculateExternalBusinessImpact,
  defaultImpactHintsForCategory,
  rollupBusinessImpact,
} from "@/lib/external-intelligence/impact";
import { clusterKeyForSignal } from "@/lib/external-intelligence/normalize";
import { possibleActionsForCategory } from "@/lib/external-intelligence/possibleActions";
import { calculateExternalIntelligenceScore } from "@/lib/external-intelligence/score";
import type {
  ExternalIntelligence,
  ExternalIntelligenceCategory,
  ExternalIntelligenceInsight,
  ExternalIntelligenceProviderId,
  NormalizedExternalSignal,
  TimeHorizon,
} from "@/lib/external-intelligence/types";
import {
  ExternalIntelligenceCategories,
  PROVIDER_RELIABILITY,
  TimeHorizons,
} from "@/lib/external-intelligence/types";
import type { BusinessInsightEvidence } from "@/lib/business-brain/insight";

type WorkingCluster = {
  clusterKey: string;
  category: ExternalIntelligenceCategory;
  title: string;
  summaries: string[];
  signals: NormalizedExternalSignal[];
  providerIds: Set<ExternalIntelligenceProviderId>;
  goalHints: Set<string>;
  actionHints: string[];
  dates: string[];
};

function daysAgo(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  return (now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24);
}

function resolveTimeHorizon(signals: NormalizedExternalSignal[], now: Date): TimeHorizon {
  const ages = signals
    .map((s) => daysAgo(s.occurredAt, now))
    .filter((d): d is number => d != null);
  if (ages.length === 0) return TimeHorizons.UNKNOWN;

  const soonestExpiry = signals
    .map((s) => (s.expiresAt ? daysAgo(s.expiresAt, now) : null))
    .filter((d): d is number => d != null)
    .sort((a, b) => a - b)[0];

  if (soonestExpiry != null && soonestExpiry <= 7) return TimeHorizons.IMMEDIATE;
  if (soonestExpiry != null && soonestExpiry <= 45) return TimeHorizons.NEAR_TERM;

  const newest = Math.min(...ages);
  if (newest <= 7) return TimeHorizons.NEAR_TERM;
  if (newest <= 90) return TimeHorizons.THIS_SEASON;
  return TimeHorizons.ONGOING;
}

function insightSentence(category: ExternalIntelligenceCategory, title: string, summary: string): string {
  const cleanTitle = title.trim();
  const cleanSummary = summary.trim();
  switch (category) {
    case ExternalIntelligenceCategories.SEASONAL_OPPORTUNITIES:
      return cleanSummary || `A seasonal opportunity is emerging around ${cleanTitle}.`;
    case ExternalIntelligenceCategories.LOCAL_EVENTS:
      return cleanSummary || `A local event may matter for your marketing: ${cleanTitle}.`;
    case ExternalIntelligenceCategories.SEARCH_DEMAND_TRENDS:
      return cleanSummary || `Search interest appears to be shifting around ${cleanTitle}.`;
    case ExternalIntelligenceCategories.COMPETITOR_ACTIVITY:
      return cleanSummary || `Competitor activity worth noticing: ${cleanTitle}.`;
    case ExternalIntelligenceCategories.INDUSTRY_REGULATORY_UPDATES:
      return cleanSummary || `An industry or regulatory update may affect you: ${cleanTitle}.`;
    case ExternalIntelligenceCategories.WEATHER:
      return cleanSummary || `Weather conditions may affect near-term demand: ${cleanTitle}.`;
    case ExternalIntelligenceCategories.HOLIDAY_CALENDAR:
      return cleanSummary || `A holiday on the calendar may create a marketing moment: ${cleanTitle}.`;
    default:
      return cleanSummary || cleanTitle;
  }
}

function toEvidence(signal: NormalizedExternalSignal): BusinessInsightEvidence {
  return {
    id: signal.id,
    summary: signal.summary || signal.title,
    occurredAt: signal.occurredAt,
    sourceProviderId: signal.sourceProviderId,
    sourceLabel: signal.sourceLabel,
    quality: signal.quality,
  };
}

function buildInsight(
  cluster: WorkingCluster,
  knownGoalKeys: ReadonlySet<string>,
  now: Date,
): ExternalIntelligenceInsight {
  const signals = cluster.signals;
  const recentShare =
    signals.length === 0
      ? 0
      : signals.filter((s) => {
          const age = daysAgo(s.occurredAt, now);
          return age != null && age <= 30;
        }).length / signals.length;

  const averageReliability =
    [...cluster.providerIds].reduce((sum, id) => sum + (PROVIDER_RELIABILITY[id] ?? 0.5), 0) /
    Math.max(1, cluster.providerIds.size);

  const averageEvidenceQuality =
    signals.reduce((sum, s) => sum + s.evidenceWeight, 0) / Math.max(1, signals.length);

  const confidence = calculateExternalConfidence({
    evidenceCount: signals.length,
    providerCount: cluster.providerIds.size,
    averageReliability,
    recentShare,
    averageEvidenceQuality,
  });

  const timeHorizon = resolveTimeHorizon(signals, now);
  const businessImpact = calculateExternalBusinessImpact({
    category: cluster.category,
    impactHints: defaultImpactHintsForCategory(cluster.category),
    evidenceCount: signals.length,
    confidence,
    timeHorizon,
  });

  const relatedGoals = [...cluster.goalHints].filter((key) => knownGoalKeys.has(key)).slice(0, 6);
  const bestSummary =
    signals.slice().sort((a, b) => b.evidenceWeight - a.evidenceWeight)[0]?.summary ?? "";

  const lastUpdated =
    signals
      .map((s) => s.occurredAt)
      .filter((d): d is string => Boolean(d))
      .sort()
      .at(-1) ?? now.toISOString();

  return {
    id: `external:${cluster.clusterKey}`,
    category: cluster.category,
    clusterKey: cluster.clusterKey,
    insight: insightSentence(cluster.category, cluster.title, bestSummary),
    confidence,
    businessImpact,
    timeHorizon,
    evidence: signals.map(toEvidence),
    possibleActions: possibleActionsForCategory(cluster.category, cluster.actionHints),
    relatedGoals,
    lastUpdated,
    corroboratingProviderCount: cluster.providerIds.size,
  };
}

function bucket(
  insights: ExternalIntelligenceInsight[],
  category: ExternalIntelligenceCategory,
): ExternalIntelligenceInsight[] {
  return insights.filter((i) => i.category === category);
}

/**
 * Compose External Intelligence package from normalized signals.
 */
export function composeExternalIntelligence(input: {
  businessProfileId: string;
  signals: NormalizedExternalSignal[];
  knownGoalKeys?: string[];
  now?: Date;
}): ExternalIntelligence {
  const now = input.now ?? new Date();
  const knownGoalKeys = new Set((input.knownGoalKeys ?? []).map((k) => k.trim()).filter(Boolean));
  const generatedAt = now.toISOString();

  if (input.signals.length === 0) {
    const score = calculateExternalIntelligenceScore({
      signals: [],
      insightCount: 0,
      highConfidenceInsights: 0,
      corroboratingInsightCount: 0,
      categoryCount: 0,
      overallConfidence: "low",
      now,
    });
    return {
      businessProfileId: input.businessProfileId,
      generatedAt,
      lastUpdated: generatedAt,
      insights: [],
      seasonalOpportunities: [],
      localEvents: [],
      searchDemandTrends: [],
      competitorActivity: [],
      industryRegulatoryUpdates: [],
      weather: [],
      holidayCalendar: [],
      confidence: "low",
      businessImpact: "low",
      evidenceCount: 0,
      score,
      contributingProviders: [],
      emptyState: "no_evidence",
    };
  }

  const clusters = new Map<string, WorkingCluster>();
  for (const signal of input.signals) {
    const key = clusterKeyForSignal(signal);
    let cluster = clusters.get(key);
    if (!cluster) {
      cluster = {
        clusterKey: key,
        category: signal.category,
        title: signal.title,
        summaries: [],
        signals: [],
        providerIds: new Set(),
        goalHints: new Set(),
        actionHints: [],
        dates: [],
      };
      clusters.set(key, cluster);
    }
    cluster.signals.push(signal);
    cluster.providerIds.add(signal.sourceProviderId);
    cluster.summaries.push(signal.summary);
    for (const goal of signal.relatedGoalHints) cluster.goalHints.add(goal);
    for (const action of signal.actionHints) {
      if (!cluster.actionHints.includes(action)) cluster.actionHints.push(action);
    }
    if (signal.occurredAt) cluster.dates.push(signal.occurredAt);
  }

  const insights = [...clusters.values()]
    .map((cluster) => buildInsight(cluster, knownGoalKeys, now))
    .sort((a, b) => {
      const impactRank = { high: 3, medium: 2, low: 1 };
      const confRank = { high: 3, medium: 2, low: 1 };
      return (
        impactRank[b.businessImpact] - impactRank[a.businessImpact] ||
        confRank[b.confidence] - confRank[a.confidence] ||
        b.evidence.length - a.evidence.length
      );
    });

  const confidence = rollupConfidence(insights.map((i) => i.confidence));
  const businessImpact = rollupBusinessImpact(insights.map((i) => i.businessImpact));
  const categories = new Set(insights.map((i) => i.category));
  const highConfidenceInsights = insights.filter((i) => i.confidence === "high").length;
  const corroboratingInsightCount = insights.filter((i) => i.corroboratingProviderCount >= 2).length;

  const contributingProviders = [
    ...new Set(input.signals.map((s) => s.sourceProviderId)),
  ] as ExternalIntelligenceProviderId[];

  const score = calculateExternalIntelligenceScore({
    signals: input.signals,
    insightCount: insights.length,
    highConfidenceInsights,
    corroboratingInsightCount,
    categoryCount: categories.size,
    overallConfidence: confidence,
    now,
  });

  const emptyState =
    insights.length === 0
      ? ("no_evidence" as const)
      : insights.every((i) => i.confidence === "low") && input.signals.length < 3
        ? ("insufficient_evidence" as const)
        : null;

  const lastUpdated =
    insights.map((i) => i.lastUpdated).sort().at(-1) ?? generatedAt;

  return {
    businessProfileId: input.businessProfileId,
    generatedAt,
    lastUpdated,
    insights,
    seasonalOpportunities: bucket(insights, ExternalIntelligenceCategories.SEASONAL_OPPORTUNITIES),
    localEvents: bucket(insights, ExternalIntelligenceCategories.LOCAL_EVENTS),
    searchDemandTrends: bucket(insights, ExternalIntelligenceCategories.SEARCH_DEMAND_TRENDS),
    competitorActivity: bucket(insights, ExternalIntelligenceCategories.COMPETITOR_ACTIVITY),
    industryRegulatoryUpdates: bucket(
      insights,
      ExternalIntelligenceCategories.INDUSTRY_REGULATORY_UPDATES,
    ),
    weather: bucket(insights, ExternalIntelligenceCategories.WEATHER),
    holidayCalendar: bucket(insights, ExternalIntelligenceCategories.HOLIDAY_CALENDAR),
    confidence,
    businessImpact,
    evidenceCount: input.signals.length,
    score,
    contributingProviders,
    emptyState,
  };
}

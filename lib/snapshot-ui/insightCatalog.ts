/**
 * Turns the public Snapshot result (PR #74) into an ordered list of
 * ReviewableInsight for the First Impression UI — the single place that
 * knows how to render each of the 8 confirmable insight keys (PR #75's
 * InsightKeys) in plain language. No component reaches into the raw
 * PublicBusinessDiscoveryResultV1 shape directly for display purposes.
 */

import { InsightKeys } from "@/lib/business-discovery/continuation/types";
import { DiscoveryConfidenceTiers, type DiscoveryInsight } from "@/lib/business-discovery/types";
import type { PublicBusinessDiscoveryResultV1 } from "@/lib/business-discovery/public/types";
import type { ReviewableInsight } from "@/lib/snapshot-ui/types";

function joinList(value: string[] | null): string | null {
  if (!value || value.length === 0) return null;
  return value.join(", ");
}

function toDisplay<T>(insight: DiscoveryInsight<T>, format: (value: T) => string | null): string | null {
  if (insight.value === null || insight.value === undefined) return null;
  return format(insight.value);
}

export function buildReviewableInsights(snapshot: PublicBusinessDiscoveryResultV1): ReviewableInsight[] {
  const insights: ReviewableInsight[] = [
    {
      key: InsightKeys.BUSINESS_SUMMARY,
      label: "What you do",
      category: "identity",
      confidenceTier: snapshot.businessSummary.confidenceTier,
      sources: snapshot.businessSummary.sources,
      reason: snapshot.businessSummary.reason,
      displayValue: toDisplay(snapshot.businessSummary, (v) => v),
      highPriority: true,
    },
    {
      key: InsightKeys.PRIMARY_SERVICES,
      label: "Your primary services",
      category: "identity",
      confidenceTier: snapshot.primaryServices.confidenceTier,
      sources: snapshot.primaryServices.sources,
      reason: snapshot.primaryServices.reason,
      displayValue: toDisplay(snapshot.primaryServices, joinList),
      highPriority: true,
    },
    {
      key: InsightKeys.LIKELY_TARGET_CUSTOMERS,
      label: "Who you help",
      category: "identity",
      confidenceTier: snapshot.likelyTargetCustomers.confidenceTier,
      sources: snapshot.likelyTargetCustomers.sources,
      reason: snapshot.likelyTargetCustomers.reason,
      displayValue: toDisplay(snapshot.likelyTargetCustomers, (v) => v),
      highPriority: true,
    },
    {
      key: InsightKeys.BRAND_PERSONALITY,
      label: "How your business comes across",
      category: "identity",
      confidenceTier: snapshot.brandPersonality.confidenceTier,
      sources: snapshot.brandPersonality.sources,
      reason: snapshot.brandPersonality.reason,
      displayValue: toDisplay(snapshot.brandPersonality, joinList),
      highPriority: false,
    },
    {
      key: InsightKeys.VISIBLE_STRENGTHS,
      label: "What stands out",
      category: "identity",
      confidenceTier: snapshot.visibleStrengths.confidenceTier,
      sources: snapshot.visibleStrengths.sources,
      reason: snapshot.visibleStrengths.reason,
      displayValue: toDisplay(snapshot.visibleStrengths, joinList),
      highPriority: false,
    },
    {
      key: InsightKeys.ONLINE_PRESENCE_WEBSITE,
      label: "Your website",
      category: "presence",
      confidenceTier: snapshot.onlinePresence.website.confidenceTier,
      sources: snapshot.onlinePresence.website.sources,
      reason: snapshot.onlinePresence.website.reason,
      displayValue: toDisplay(snapshot.onlinePresence.website, (v) =>
        v.connected ? (v.analyzed ? "Connected and reviewed" : "Connected, review in progress") : null
      ),
      highPriority: false,
    },
    {
      key: InsightKeys.ONLINE_PRESENCE_GOOGLE_BUSINESS_PROFILE,
      label: "Your Google Business Profile",
      category: "presence",
      confidenceTier: snapshot.onlinePresence.googleBusinessProfile.confidenceTier,
      sources: snapshot.onlinePresence.googleBusinessProfile.sources,
      reason: snapshot.onlinePresence.googleBusinessProfile.reason,
      displayValue: toDisplay(snapshot.onlinePresence.googleBusinessProfile, (v) => (v.connected ? "Connected" : null)),
      highPriority: false,
    },
    {
      key: InsightKeys.POSSIBLE_GROWTH_OPPORTUNITIES,
      label: "Where growth may be hiding",
      category: "growth",
      confidenceTier: snapshot.possibleGrowthOpportunities.confidenceTier,
      sources: snapshot.possibleGrowthOpportunities.sources,
      reason: snapshot.possibleGrowthOpportunities.reason,
      displayValue: toDisplay(snapshot.possibleGrowthOpportunities, joinList),
      highPriority: true,
    },
  ];

  return insights;
}

/** The 3 most foundational insights for the "three most important discoveries" step (Part 6). */
export function topDiscoveries(insights: ReviewableInsight[]): ReviewableInsight[] {
  const order: string[] = [InsightKeys.BUSINESS_SUMMARY, InsightKeys.PRIMARY_SERVICES, InsightKeys.LIKELY_TARGET_CUSTOMERS];
  return order
    .map((key) => insights.find((insight) => insight.key === key))
    .filter((insight): insight is ReviewableInsight => Boolean(insight));
}

/** Items that most need the visitor's attention: Assumed high-priority insights and anything Missing. Known/low-priority items are de-prioritized, not hidden. */
export function guidedReviewItems(insights: ReviewableInsight[]): ReviewableInsight[] {
  return insights.filter(
    (insight) =>
      insight.confidenceTier === DiscoveryConfidenceTiers.MISSING ||
      (insight.confidenceTier === DiscoveryConfidenceTiers.ASSUMED && insight.highPriority)
  );
}

/** Everything else — clearly-stated or low-impact items, collapsed under "Review everything I learned." */
export function remainingItems(insights: ReviewableInsight[]): ReviewableInsight[] {
  const guided = new Set(guidedReviewItems(insights).map((insight) => insight.key));
  return insights.filter((insight) => !guided.has(insight.key));
}

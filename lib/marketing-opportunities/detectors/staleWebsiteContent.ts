import type { WebsiteAnalysis } from "@/lib/website-analysis/types";
import type { MarketingOpportunityDraft } from "@/lib/marketing-opportunities/types";
import { OpportunityCategories, OpportunitySeverities } from "@/lib/marketing-opportunities/types";

const STALE_THRESHOLD_DAYS = 90;

/** Fires when the most recent completed website analysis is older than 90 days. */
export function detectStaleWebsiteContent(
  websiteAnalysis: WebsiteAnalysis | null,
  now: Date = new Date()
): MarketingOpportunityDraft[] {
  if (!websiteAnalysis || websiteAnalysis.analysis_status !== "completed") return [];

  const daysSinceAnalysis = Math.floor(
    (now.getTime() - new Date(websiteAnalysis.updated_at).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysSinceAnalysis < STALE_THRESHOLD_DAYS) return [];

  return [
    {
      category: OpportunityCategories.STALE_WEBSITE_CONTENT,
      severity: daysSinceAnalysis >= 180 ? OpportunitySeverities.HIGH : OpportunitySeverities.MEDIUM,
      confidence: 55,
      title: "Website content may be stale",
      description: `The last website analysis was ${daysSinceAnalysis} days ago. Refreshing website copy and re-running analysis keeps AI-generated content aligned with current offerings.`,
      evidence: { lastAnalyzedAt: websiteAnalysis.updated_at, daysSinceAnalysis },
      recommendedAction: "Review the website for outdated services/offers, then re-run website analysis.",
      expiresAt: null,
      dedupeKey: "current",
    },
  ];
}

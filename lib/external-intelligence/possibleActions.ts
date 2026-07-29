/**
 * Possible Actions for External Intelligence — suggestions only.
 * Never prioritized here; Recommendation Engine decides order.
 */

import type { BusinessInsightPossibleAction } from "@/lib/business-brain/insight";
import type { ExternalIntelligenceCategory } from "@/lib/external-intelligence/types";
import { ExternalIntelligenceCategories } from "@/lib/external-intelligence/types";

const BY_CATEGORY: Record<ExternalIntelligenceCategory, BusinessInsightPossibleAction[]> = {
  [ExternalIntelligenceCategories.SEASONAL_OPPORTUNITIES]: [
    { id: "content", label: "Create seasonal content", href: "/dashboard/content/generator" },
    { id: "plan", label: "Reflect in marketing plan", href: "/dashboard/marketing-plan" },
    { id: "gbp", label: "Post on Google Business profile", href: "/dashboard/google-business-profile" },
  ],
  [ExternalIntelligenceCategories.LOCAL_EVENTS]: [
    { id: "content", label: "Create local-event content", href: "/dashboard/content/generator" },
    { id: "gbp", label: "Mention on Google Business profile", href: "/dashboard/google-business-profile" },
    { id: "social", label: "Plan a timely social post", href: "/dashboard/content/generator" },
  ],
  [ExternalIntelligenceCategories.SEARCH_DEMAND_TRENDS]: [
    { id: "content", label: "Create content for rising demand", href: "/dashboard/content/generator" },
    { id: "website", label: "Review website messaging", href: "/dashboard/website-analysis" },
    { id: "plan", label: "Consider in marketing plan", href: "/dashboard/marketing-plan" },
  ],
  [ExternalIntelligenceCategories.COMPETITOR_ACTIVITY]: [
    { id: "diff", label: "Reinforce your differentiators", href: "/dashboard/customer-voice" },
    { id: "content", label: "Create clarifying content", href: "/dashboard/content/generator" },
    { id: "plan", label: "Review marketing plan priorities", href: "/dashboard/marketing-plan" },
  ],
  [ExternalIntelligenceCategories.INDUSTRY_REGULATORY_UPDATES]: [
    { id: "website", label: "Update website or FAQ wording", href: "/dashboard/website-analysis" },
    { id: "content", label: "Explain the change in content", href: "/dashboard/content/generator" },
    { id: "gbp", label: "Clarify on Google Business profile", href: "/dashboard/google-business-profile" },
  ],
  [ExternalIntelligenceCategories.WEATHER]: [
    { id: "content", label: "Create weather-aware content", href: "/dashboard/content/generator" },
    { id: "gbp", label: "Share a timely Google Business update", href: "/dashboard/google-business-profile" },
  ],
  [ExternalIntelligenceCategories.HOLIDAY_CALENDAR]: [
    { id: "content", label: "Plan holiday-themed content", href: "/dashboard/content/generator" },
    { id: "plan", label: "Schedule around the holiday", href: "/dashboard/marketing-plan" },
    { id: "gbp", label: "Update Google Business hours or posts", href: "/dashboard/google-business-profile" },
  ],
};

export function possibleActionsForCategory(
  category: ExternalIntelligenceCategory,
  actionHints: readonly string[] = [],
): BusinessInsightPossibleAction[] {
  const base = BY_CATEGORY[category] ?? [];
  const fromHints = actionHints.slice(0, 3).map((label, index) => ({
    id: `hint_${index}`,
    label,
    href: null as string | null,
  }));
  const seen = new Set<string>();
  const merged: BusinessInsightPossibleAction[] = [];
  for (const action of [...fromHints, ...base]) {
    const key = action.label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(action);
  }
  return merged.slice(0, 6);
}

/**
 * Highest-value next connection — one recommendation, not a wall of integrations.
 */

import {
  ConnectionCategories,
  ConnectionStatuses,
  type BusinessConnection,
  type NextConnectionRecommendation,
} from "@/lib/business-connections/types";

/** Prefer live, actionable gaps; ignore coming-soon unless nothing else remains. */
const CATEGORY_VALUE_ORDER = [
  ConnectionCategories.CUSTOMER_FEEDBACK,
  ConnectionCategories.WEBSITE_AND_SEARCH,
  ConnectionCategories.COMMUNICATIONS,
  ConnectionCategories.SCHEDULING_AND_COMMERCE,
  ConnectionCategories.DOCUMENTS,
  ConnectionCategories.SOCIAL_MEDIA,
  ConnectionCategories.CRM_AND_SALES,
  ConnectionCategories.ADVERTISING,
] as const;

function categoryRank(category: BusinessConnection["category"]): number {
  const index = CATEGORY_VALUE_ORDER.indexOf(
    category as (typeof CATEGORY_VALUE_ORDER)[number],
  );
  return index === -1 ? 99 : index;
}

/**
 * Pick exactly one highest-value next connection.
 * Prefers needs_attention (restore value) over new connects; never recommends coming_soon as primary.
 */
export function recommendNextConnection(
  connections: BusinessConnection[],
): NextConnectionRecommendation | null {
  const attention = connections
    .filter((c) => c.status === ConnectionStatuses.NEEDS_ATTENTION)
    .sort((a, b) => categoryRank(a.category) - categoryRank(b.category) || a.priority - b.priority);

  if (attention[0]) {
    const c = attention[0];
    return {
      connectionId: c.id,
      displayName: c.displayName,
      why: "This connection needs a quick reconnect so we don't lose the insights you already unlocked.",
      whatYouLearn: c.whatYouLearn,
      href: c.connectHref ?? c.manageHref,
      category: c.category,
    };
  }

  const actionable = connections
    .filter(
      (c) =>
        c.implementation === "live" &&
        c.status === ConnectionStatuses.NOT_CONNECTED &&
        Boolean(c.connectHref),
    )
    .sort((a, b) => categoryRank(a.category) - categoryRank(b.category) || a.priority - b.priority);

  if (actionable[0]) {
    const c = actionable[0];
    return {
      connectionId: c.id,
      displayName: c.displayName,
      why: "This is the highest-value next step for strengthening your Business Brain right now.",
      whatYouLearn: c.whatYouLearn,
      href: c.connectHref,
      category: c.category,
    };
  }

  return null;
}

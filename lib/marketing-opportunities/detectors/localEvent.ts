import type { MarketContextItem } from "@/lib/market-context/types";
import type { MarketingOpportunityDraft } from "@/lib/marketing-opportunities/types";
import { OpportunityCategories } from "@/lib/marketing-opportunities/types";
import {
  isUnexpired,
  marketContextItemToOpportunityDraft,
} from "@/lib/marketing-opportunities/detectors/marketContextOpportunities";

/**
 * One opportunity per unexpired "local_event" market_context_items row (sourced from
 * localEventsProvider via the Market Context Agent — not re-fetched here).
 */
export function detectLocalEventOpportunities(
  marketContextItems: MarketContextItem[],
  now: Date = new Date()
): MarketingOpportunityDraft[] {
  return marketContextItems
    .filter((item) => item.category === "local_event" && isUnexpired(item, now))
    .map((item) =>
      marketContextItemToOpportunityDraft(
        item,
        OpportunityCategories.LOCAL_EVENT,
        "Local event opportunity",
        "Create content or a promotion tied to the local event"
      )
    );
}

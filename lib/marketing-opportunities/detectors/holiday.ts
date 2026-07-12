import type { MarketContextItem } from "@/lib/market-context/types";
import type { MarketingOpportunityDraft } from "@/lib/marketing-opportunities/types";
import { OpportunityCategories } from "@/lib/marketing-opportunities/types";
import {
  isUnexpired,
  marketContextItemToOpportunityDraft,
} from "@/lib/marketing-opportunities/detectors/marketContextOpportunities";

/**
 * One opportunity per unexpired "holiday" market_context_items row. Relies on the
 * Market Context Agent already having populated these — this detector doesn't call the
 * holiday provider (nagerDateClient/holidayProvider) itself, avoiding duplicate work.
 */
export function detectHolidayOpportunities(
  marketContextItems: MarketContextItem[],
  now: Date = new Date()
): MarketingOpportunityDraft[] {
  return marketContextItems
    .filter((item) => item.category === "holiday" && isUnexpired(item, now))
    .map((item) =>
      marketContextItemToOpportunityDraft(
        item,
        OpportunityCategories.HOLIDAY,
        "Holiday opportunity",
        "Create timely content or a promotion tied to"
      )
    );
}

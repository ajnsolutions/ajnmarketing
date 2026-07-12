import type { MarketContextItem } from "@/lib/market-context/types";
import type { MarketingOpportunityDraft } from "@/lib/marketing-opportunities/types";
import { OpportunityCategories } from "@/lib/marketing-opportunities/types";
import {
  isUnexpired,
  marketContextItemToOpportunityDraft,
} from "@/lib/marketing-opportunities/detectors/marketContextOpportunities";

/**
 * One opportunity per unexpired "weather" market_context_items row (sourced from
 * weatherProvider/weatherGovClient via the Market Context Agent — not re-fetched here).
 */
export function detectWeatherOpportunity(
  marketContextItems: MarketContextItem[],
  now: Date = new Date()
): MarketingOpportunityDraft[] {
  return marketContextItems
    .filter((item) => item.category === "weather" && isUnexpired(item, now))
    .map((item) =>
      marketContextItemToOpportunityDraft(
        item,
        OpportunityCategories.WEATHER,
        "Weather opportunity",
        "Create weather-relevant content or a promotion tied to"
      )
    );
}

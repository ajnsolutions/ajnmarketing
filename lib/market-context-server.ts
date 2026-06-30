import {
  getLatestMarketContextBriefForCurrentUser,
  getMarketContextPageDataForCurrentUser,
} from "@/lib/market-context/marketContextService";

export async function getMarketContextPageData() {
  return getMarketContextPageDataForCurrentUser();
}

export async function getLatestMarketContextBrief() {
  return getLatestMarketContextBriefForCurrentUser();
}

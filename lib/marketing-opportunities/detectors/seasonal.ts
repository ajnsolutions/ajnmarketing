import type { BusinessProfile } from "@/lib/business-profile";
import type { MarketingOpportunityDraft } from "@/lib/marketing-opportunities/types";
import { OpportunityCategories, OpportunitySeverities } from "@/lib/marketing-opportunities/types";

type Season = "winter" | "spring" | "summer" | "fall";

function currentSeason(now: Date): Season {
  const month = now.getMonth() + 1;
  if (month === 12 || month <= 2) return "winter";
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  return "fall";
}

/** Last calendar day (UTC, end of day) of the given season/year, used as the expiry. */
function endOfSeasonIso(season: Season, year: number): string {
  const endMonthDay: Record<Season, [number, number]> = {
    winter: [1, 28], // winter starting in `year` (Dec) ends the following Feb -- see call site
    spring: [4, 31],
    summer: [7, 31],
    fall: [10, 31],
  };
  const [month, day] = endMonthDay[season];
  const endYear = season === "winter" ? year + 1 : year;
  return new Date(Date.UTC(endYear, month, day, 23, 59, 59)).toISOString();
}

/**
 * Fires once per season per year (idempotent via the season+year dedupe key) when the
 * business has any seasonal_services configured. Auto-expires at the season's end.
 */
export function detectSeasonalOpportunity(
  businessProfile: BusinessProfile,
  now: Date = new Date()
): MarketingOpportunityDraft[] {
  const seasonalServices = businessProfile.seasonal_services?.trim();
  if (!seasonalServices) return [];

  const season = currentSeason(now);
  const year = now.getFullYear();
  const label = season.charAt(0).toUpperCase() + season.slice(1);

  return [
    {
      category: OpportunityCategories.SEASONAL,
      severity: OpportunitySeverities.MEDIUM,
      confidence: 65,
      title: `${label} seasonal service opportunity`,
      description: `This business offers seasonal services (${seasonalServices}). ${label} is a good window to promote them before demand shifts.`,
      evidence: { season, year, seasonalServices },
      recommendedAction: `Create content promoting: ${seasonalServices}.`,
      expiresAt: endOfSeasonIso(season, year),
      dedupeKey: `${season}-${year}`,
    },
  ];
}

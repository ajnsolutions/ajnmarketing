import "server-only";

import type { MarketContextProviderContext } from "@/lib/market-context/types";
import {
  extractUrls,
  isGoogleBusinessUrl,
  isSocialProfileUrl,
  stripUrlsFromText,
} from "@/lib/market-context/providers/urlUtils";

export type ParsedCompetitorProfile = {
  name: string;
  raw: string;
  websiteUrl: string | null;
  googleBusinessUrl: string | null;
  socialUrls: string[];
  source: "business_profile" | "ai_marketing_profile";
};

function parseCompetitorEntry(raw: string, source: ParsedCompetitorProfile["source"]): ParsedCompetitorProfile | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const urls = extractUrls(trimmed);
  const googleBusinessUrl = urls.find(isGoogleBusinessUrl) ?? null;
  const socialUrls = urls.filter(isSocialProfileUrl);
  const websiteUrl =
    urls.find((url) => !isGoogleBusinessUrl(url) && !isSocialProfileUrl(url)) ?? null;

  const nameFromText = stripUrlsFromText(trimmed.replace(/[-–|]/g, " "));
  let nameFromUrl = "";
  if (websiteUrl) {
    try {
      nameFromUrl = new URL(websiteUrl).hostname.replace(/^www\./, "");
    } catch {
      nameFromUrl = "";
    }
  }

  const name = nameFromText || nameFromUrl || "Competitor";

  return {
    name,
    raw: trimmed,
    websiteUrl,
    googleBusinessUrl,
    socialUrls,
    source,
  };
}

function splitCompetitorLines(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  return [...new Set(raw.split(/[\n,;|•]/).map((item) => item.trim()).filter(Boolean))];
}

export function collectCompetitorProfiles(
  context: MarketContextProviderContext
): ParsedCompetitorProfile[] {
  const profiles: ParsedCompetitorProfile[] = [];
  const seen = new Set<string>();

  for (const line of splitCompetitorLines(context.businessProfile.competitors)) {
    const parsed = parseCompetitorEntry(line, "business_profile");
    if (parsed && !seen.has(parsed.raw.toLowerCase())) {
      seen.add(parsed.raw.toLowerCase());
      profiles.push(parsed);
    }
  }

  for (const line of context.aiMarketingProfile?.competitors ?? []) {
    const parsed = parseCompetitorEntry(line, "ai_marketing_profile");
    if (parsed && !seen.has(parsed.raw.toLowerCase())) {
      seen.add(parsed.raw.toLowerCase());
      profiles.push(parsed);
    }
  }

  return profiles.slice(0, 5);
}

export function buildCompetitorSignalSummary(
  competitor: ParsedCompetitorProfile,
  industry: string,
  location: string
): string {
  const linkHints = [
    competitor.websiteUrl ? "website" : null,
    competitor.googleBusinessUrl ? "Google Business Profile" : null,
    competitor.socialUrls.length > 0 ? "social profiles" : null,
  ].filter(Boolean);

  const linkText =
    linkHints.length > 0
      ? ` Stored profile links include ${linkHints.join(", ")}.`
      : " Add website or Google Business Profile links to enrich future monitoring.";

  return `Profile-based competitor signal for ${competitor.name} in ${location}. Use this to differentiate ${industry} messaging with proof, local expertise, and stronger calls to action.${linkText}`;
}

export function resolveCompetitorSourceUrl(competitor: ParsedCompetitorProfile): string | null {
  return competitor.websiteUrl ?? competitor.googleBusinessUrl ?? competitor.socialUrls[0] ?? null;
}

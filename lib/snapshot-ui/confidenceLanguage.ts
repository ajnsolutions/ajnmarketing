/**
 * Confidence-language translation for the First Impression experience.
 *
 * Never shows "Known" / "Assumed" / "Missing" (technical database-state
 * language) and never a raw confidence percentage — only the plain-language
 * treatment specified in Part 3 of the First Impression brief. Mirrors the
 * discipline already established in
 * lib/business-discovery/confidenceLabels.ts and
 * lib/recommendation-presentation/confidenceLabels.ts: a deterministic label
 * paired with a short explanation, nothing more.
 */

import { DiscoveryConfidenceTiers, type DiscoveryConfidenceTier, type DiscoverySourceType } from "@/lib/business-discovery/types";

const CONFIDENCE_LABEL: Record<DiscoveryConfidenceTier, string> = {
  [DiscoveryConfidenceTiers.KNOWN]: "Clearly stated",
  [DiscoveryConfidenceTiers.ASSUMED]: "My best understanding",
  [DiscoveryConfidenceTiers.MISSING]: "I couldn't determine this yet",
};

/** Short badge text — used inline next to an insight, never a color-only signal (see UX_RULES.md's no-color-only-status rule). */
export function confidenceBadgeText(tier: DiscoveryConfidenceTier): string {
  return CONFIDENCE_LABEL[tier];
}

const SOURCE_PHRASE: Record<DiscoverySourceType, string> = {
  business_profile: "what you told us",
  website: "your website",
  ai_website_analysis: "your website",
  ai_marketing_profile: "AJN's analysis",
  google_business_profile: "your Google Business Profile",
  public_reviews: "public reviews",
  social_presence: "your social presence",
  market_context: "your local market",
  future_connector: "a connected source",
  smart_upload: "something you shared",
};

/** Friendly source phrase for "Why I think this" — never a raw internal source ID/enum value. */
export function sourcePhrase(sources: DiscoverySourceType[]): string | null {
  const unique = Array.from(new Set(sources));
  if (unique.length === 0) return null;
  const phrases = Array.from(new Set(unique.map((source) => SOURCE_PHRASE[source] ?? "public information")));
  if (phrases.length === 1) return phrases[0];
  if (phrases.length === 2) return `${phrases[0]} and ${phrases[1]}`;
  return `${phrases.slice(0, -1).join(", ")}, and ${phrases[phrases.length - 1]}`;
}

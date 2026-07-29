/**
 * Theme extraction + semantic clustering (deterministic Phase 1).
 * Never overreacts to isolated reviews — callers apply confidence gates.
 */

import {
  extractEmployeeMentions,
  extractServiceMentions,
  findMatchingClusters,
  normalizePhrase,
  type ThemeClusterDefinition,
} from "@/lib/customer-voice/themeLexicon";
import type { CustomerVoiceSentiment, ThemeKind } from "@/lib/customer-voice/types";
import { CustomerVoiceSentiments, ThemeKinds } from "@/lib/customer-voice/types";

export type ExtractedThemeHit = {
  clusterKey: string;
  label: string;
  kind: ThemeKind;
  matchedPhrase: string;
  impactHints: ThemeClusterDefinition["impactHints"];
};

export type ThemeExtractionResult = {
  hits: ExtractedThemeHit[];
  employees: string[];
  services: string[];
  /** Recurring customer language snippets (short, non-summary). */
  languagePhrases: string[];
  emotionalTone: CustomerVoiceSentiment;
};

const POSITIVE_WORDS = [
  "love",
  "great",
  "excellent",
  "amazing",
  "wonderful",
  "fantastic",
  "perfect",
  "helpful",
  "recommend",
  "happy",
  "pleased",
  "outstanding",
];

const NEGATIVE_WORDS = [
  "terrible",
  "awful",
  "horrible",
  "rude",
  "unprofessional",
  "disappointed",
  "worst",
  "never again",
  "frustrated",
  "angry",
  "poor",
  "unacceptable",
];

export function sentimentFromTextAndRating(
  text: string,
  rating: number | null,
): CustomerVoiceSentiment {
  const normalized = normalizePhrase(text);
  let score = 0;
  for (const word of POSITIVE_WORDS) {
    if (normalized.includes(word)) score += 1;
  }
  for (const word of NEGATIVE_WORDS) {
    if (normalized.includes(word)) score -= 1;
  }
  if (rating != null) {
    if (rating >= 4) score += 1;
    if (rating <= 2) score -= 1;
  }
  if (score > 1) return CustomerVoiceSentiments.POSITIVE;
  if (score < -1) return CustomerVoiceSentiments.NEGATIVE;
  if (score === 0 && (rating == null || rating === 3)) return CustomerVoiceSentiments.NEUTRAL;
  if (score > 0) return CustomerVoiceSentiments.POSITIVE;
  if (score < 0) return CustomerVoiceSentiments.NEGATIVE;
  return CustomerVoiceSentiments.NEUTRAL;
}

function matchedPhraseForCluster(text: string, cluster: ThemeClusterDefinition): string {
  const normalized = normalizePhrase(text);
  for (const phrase of cluster.phrases) {
    if (normalized.includes(normalizePhrase(phrase))) return phrase;
  }
  return cluster.label;
}

/** Extract short customer language snippets (not AI summaries). */
export function extractLanguagePhrases(text: string): string[] {
  const phrases: string[] = [];
  const quoted = text.match(/"([^"]{4,60})"/g) ?? [];
  for (const q of quoted) {
    phrases.push(q.replace(/"/g, "").trim());
  }
  const sentences = text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 12 && s.length <= 80);
  for (const sentence of sentences.slice(0, 2)) {
    phrases.push(sentence);
  }
  return [...new Set(phrases)].slice(0, 5);
}

export function extractThemesFromText(
  text: string,
  options: { rating?: number | null; knownServices?: string[] } = {},
): ThemeExtractionResult {
  const clusters = findMatchingClusters(text);
  const hits: ExtractedThemeHit[] = clusters.map((cluster) => ({
    clusterKey: cluster.key,
    label: cluster.label,
    kind: cluster.kind,
    matchedPhrase: matchedPhraseForCluster(text, cluster),
    impactHints: cluster.impactHints,
  }));

  // Flip strength→concern when text/rating is strongly negative for wait/pricing clusters.
  const tone = sentimentFromTextAndRating(text, options.rating ?? null);
  const adjusted = hits.map((hit) => {
    if (
      tone === CustomerVoiceSentiments.NEGATIVE &&
      (hit.clusterKey === "wait_time" || hit.clusterKey === "pricing_concerns")
    ) {
      return { ...hit, kind: ThemeKinds.CONCERN };
    }
    if (
      tone === CustomerVoiceSentiments.POSITIVE &&
      hit.clusterKey === "scheduling_flexibility" &&
      /easy to book|flexible/i.test(text)
    ) {
      return { ...hit, kind: ThemeKinds.STRENGTH };
    }
    return hit;
  });

  return {
    hits: adjusted,
    employees: extractEmployeeMentions(text),
    services: extractServiceMentions(text, options.knownServices ?? []),
    languagePhrases: extractLanguagePhrases(text),
    emotionalTone: tone,
  };
}

/**
 * Merge synonym variants across providers into one canonical theme key.
 * Example: Fast / Quick / Same-day → fast_service.
 */
export function mergeThemeKeys(keys: string[]): string[] {
  return [...new Set(keys.filter(Boolean))];
}

/**
 * Business Brain reasoning that spans providers — pure functions, no I/O.
 *
 * Two distinct crossover shapes, both mission-worked-examples:
 *  1. Upload vs. website content gap: "your brochure highlights X but your
 *     website has very little content targeting that service."
 *  2. Upload vs. Search Console demand: "commercial roofing searches are
 *     increasing, and your brochure already covers commercial roofing" —
 *     cites both evidence sources, never fabricates the conclusion.
 */

import type { SmartUploadKnowledgeFactRecord } from "@/lib/smart-uploads/types";
import type { ExternalIntelligenceInsight } from "@/lib/external-intelligence/types";

const OFFERING_CATEGORIES = new Set(["product", "service", "unique_selling_point"]);

/**
 * Crossover matching compares a short fact statement against a much longer
 * sentence (a search-demand insight, a website services list entry) — plain
 * whole-string Jaccard (as used for duplicate detection, where both sides
 * are similar-length restatements of the same fact) would under-match a
 * short shared phrase inside a longer sentence. This uses the overlap
 * coefficient (intersection / smaller set size) over topic words only
 * (stopwords and short filler words excluded) instead.
 */
const STOPWORDS = new Set([
  "and", "the", "for", "from", "over", "last", "with", "that", "this", "are",
  "was", "were", "have", "has", "had", "your", "you", "our", "their", "than",
  "into", "onto", "also", "very", "little", "much", "period", "grew", "went",
]);

function topicWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length >= 4 && !STOPWORDS.has(token)),
  );
}

/** Overlap coefficient over topic words — 0 when either side has no topic words. */
function topicOverlap(a: string, b: string): number {
  const wordsA = topicWords(a);
  const wordsB = topicWords(b);
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let intersection = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) intersection += 1;
  }
  return intersection / Math.min(wordsA.size, wordsB.size);
}

/** Below this overlap, a fact's topic is considered essentially unrepresented elsewhere. */
const WEBSITE_GAP_MAX_OVERLAP = 0.2;
/** Above this overlap, an upload fact and an external insight are considered "the same topic." */
const CROSSOVER_MIN_OVERLAP = 0.3;

export type WebsiteContentGapObservation = {
  fact: SmartUploadKnowledgeFactRecord;
  documentFileName: string;
};

/**
 * Facts describing an offering (product/service/USP) that has little or no
 * overlap with anything in the business's known website services list —
 * the Part 6 worked example.
 */
export function findWebsiteContentGaps(
  facts: SmartUploadKnowledgeFactRecord[],
  documentFileNameById: Map<string, string>,
  websiteServices: string[],
): WebsiteContentGapObservation[] {
  const activeOfferings = facts.filter(
    (fact) => !fact.superseded_by && OFFERING_CATEGORIES.has(fact.category),
  );
  if (activeOfferings.length === 0 || websiteServices.length === 0) return [];

  return activeOfferings
    .filter((fact) => {
      const maxOverlap = Math.max(0, ...websiteServices.map((service) => topicOverlap(fact.fact, service)));
      return maxOverlap <= WEBSITE_GAP_MAX_OVERLAP;
    })
    .slice(0, 2)
    .map((fact) => ({
      fact,
      documentFileName: documentFileNameById.get(fact.document_id) ?? "an uploaded document",
    }));
}

export type SearchDemandCrossoverMatch = {
  fact: SmartUploadKnowledgeFactRecord;
  insight: ExternalIntelligenceInsight;
  similarity: number;
};

/**
 * Pairs an upload fact with a Search Console-derived demand-trend insight
 * covering the same topic — the Part 8 worked example. Every returned pair
 * cites both the fact's own text and the insight's own text; nothing here
 * invents a shared topic beyond what the overlap check found.
 */
export function findSearchDemandCrossovers(
  facts: SmartUploadKnowledgeFactRecord[],
  searchDemandTrends: ExternalIntelligenceInsight[],
): SearchDemandCrossoverMatch[] {
  const activeOfferings = facts.filter(
    (fact) => !fact.superseded_by && OFFERING_CATEGORIES.has(fact.category),
  );
  if (activeOfferings.length === 0 || searchDemandTrends.length === 0) return [];

  const matches: SearchDemandCrossoverMatch[] = [];
  for (const fact of activeOfferings) {
    let best: { insight: ExternalIntelligenceInsight; similarity: number } | null = null;
    for (const insight of searchDemandTrends) {
      const similarity = topicOverlap(fact.fact, insight.insight);
      if (similarity >= CROSSOVER_MIN_OVERLAP && (!best || similarity > best.similarity)) {
        best = { insight, similarity };
      }
    }
    if (best) matches.push({ fact, insight: best.insight, similarity: best.similarity });
  }

  return matches.sort((a, b) => b.similarity - a.similarity).slice(0, 2);
}

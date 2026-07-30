/**
 * Topic-word overlap — the same technique lib/smart-uploads/crossover.ts uses
 * to pair evidence about the same real-world topic across providers, phrased
 * differently. Deliberately not exact-string clustering: two providers almost
 * never describe "commercial roofing" with identical text.
 */

const STOPWORDS = new Set([
  "and", "the", "for", "from", "over", "last", "with", "that", "this", "are",
  "was", "were", "have", "has", "had", "your", "you", "our", "their", "than",
  "into", "onto", "also", "very", "little", "much", "period", "grew", "went",
  "more", "most", "some", "many", "these", "those", "will", "can", "could",
]);

export function topicWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length >= 4 && !STOPWORDS.has(token)),
  );
}

/** Overlap coefficient (intersection / smaller set size) — 0 when either side has no topic words. */
export function topicOverlap(a: string, b: string): number {
  const wordsA = topicWords(a);
  const wordsB = topicWords(b);
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let intersection = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) intersection += 1;
  }
  return intersection / Math.min(wordsA.size, wordsB.size);
}

/** Two labels are considered "the same topic" for entity clustering above this overlap. */
export const TOPIC_MERGE_THRESHOLD = 0.5;

/** Threshold for resolving a relationship's target entity — lower than
 * TOPIC_MERGE_THRESHOLD because a relationship target label is often a full
 * sentence (e.g. a search insight) being matched against a short entity
 * label, not two similar-length restatements of the same fact. */
export const RELATIONSHIP_TARGET_THRESHOLD = 0.3;

/** Two labels are considered genuinely unrelated below this overlap (used by conflict detection). */
export const TOPIC_UNRELATED_THRESHOLD = 0.2;

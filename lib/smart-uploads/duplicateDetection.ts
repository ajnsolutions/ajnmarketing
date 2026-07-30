/**
 * Duplicate/near-duplicate fact detection — pure, no I/O.
 *
 * Two documents (e.g. a brochure and a service sheet) commonly restate the
 * same fact. Rather than showing the same knowledge twice, a newer duplicate
 * supersedes an older one (persistence.ts sets `superseded_by`), keeping the
 * fact with the higher confidence (or the newer one on a tie) as the live copy.
 */

import type { KnowledgeCategory, SmartUploadKnowledgeFactRecord } from "@/lib/smart-uploads/types";

const CONFIDENCE_RANK: Record<string, number> = { low: 1, medium: 2, high: 3 };

function normalizeForComparison(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2)
  );
}

/** Jaccard similarity of the two facts' significant words. */
export function factSimilarity(a: string, b: string): number {
  const tokensA = normalizeForComparison(a);
  const tokensB = normalizeForComparison(b);
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) intersection += 1;
  }
  const union = new Set([...tokensA, ...tokensB]).size;
  return union === 0 ? 0 : intersection / union;
}

/** Facts are considered duplicates above this similarity threshold. */
export const DUPLICATE_SIMILARITY_THRESHOLD = 0.6;

export type DuplicatePair = {
  keep: SmartUploadKnowledgeFactRecord;
  supersede: SmartUploadKnowledgeFactRecord;
  similarity: number;
};

/**
 * Finds duplicate pairs within one category across possibly-multiple documents.
 * Never crosses categories (a "pricing" fact never supersedes a "service" fact,
 * even if the text overlaps) — category is part of the fact's identity.
 */
export function findDuplicateFacts(
  facts: SmartUploadKnowledgeFactRecord[]
): DuplicatePair[] {
  const active = facts.filter((fact) => !fact.superseded_by);
  const byCategory = new Map<KnowledgeCategory, SmartUploadKnowledgeFactRecord[]>();
  for (const fact of active) {
    const list = byCategory.get(fact.category) ?? [];
    list.push(fact);
    byCategory.set(fact.category, list);
  }

  const pairs: DuplicatePair[] = [];
  const superseded = new Set<string>();

  for (const group of byCategory.values()) {
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        const factA = group[i]!;
        const factB = group[j]!;
        if (superseded.has(factA.id) || superseded.has(factB.id)) continue;

        const similarity = factSimilarity(factA.fact, factB.fact);
        if (similarity < DUPLICATE_SIMILARITY_THRESHOLD) continue;

        const rankA = CONFIDENCE_RANK[factA.confidence] ?? 0;
        const rankB = CONFIDENCE_RANK[factB.confidence] ?? 0;

        let keep = factA;
        let supersede = factB;
        if (rankB > rankA) {
          keep = factB;
          supersede = factA;
        } else if (rankB === rankA) {
          // Same confidence — keep the more recently learned fact.
          keep = new Date(factB.date_learned) >= new Date(factA.date_learned) ? factB : factA;
          supersede = keep === factA ? factB : factA;
        }

        superseded.add(supersede.id);
        pairs.push({ keep, supersede, similarity });
      }
    }
  }

  return pairs;
}

/**
 * Embedding provider abstraction for semantic retrieval over Business Brain
 * knowledge (Smart Upload facts today; any future text-shaped evidence
 * tomorrow). Nothing downstream of this interface should import a specific
 * embedding model/vendor — swapping providers means implementing this
 * interface and changing which provider is constructed, not touching
 * callers or the storage schema (supabase/migrations/033_smart_uploads.sql's
 * `provider_id` + `dimensions` columns let rows from different providers
 * coexist during a migration).
 */

export type EmbeddingVector = number[];

export interface EmbeddingProvider {
  readonly id: string;
  readonly dimensions: number;
  embed(text: string): Promise<EmbeddingVector>;
  embedBatch(texts: string[]): Promise<EmbeddingVector[]>;
}

export class EmbeddingProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmbeddingProviderError";
  }
}

/** Cosine similarity — the standard comparison for normalized embedding vectors. */
export function cosineSimilarity(a: EmbeddingVector, b: EmbeddingVector): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dot = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i]! * b[i]!;
    magnitudeA += a[i]! * a[i]!;
    magnitudeB += b[i]! * b[i]!;
  }

  if (magnitudeA === 0 || magnitudeB === 0) return 0;
  return dot / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
}

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { cosineSimilarity, type EmbeddingProvider } from "@/lib/embeddings/provider";
import { getFactEmbeddingsForBusiness, upsertFactEmbedding } from "@/lib/embeddings/persistence";
import { OpenAIEmbeddingProvider } from "@/lib/embeddings/openaiProvider";
import type { SmartUploadKnowledgeFactRecord } from "@/lib/smart-uploads/types";

/** Default provider — injectable so tests and future providers never depend
 * on this constructor directly. */
export function createDefaultEmbeddingProvider(): EmbeddingProvider {
  return new OpenAIEmbeddingProvider();
}

export async function generateEmbeddingsForFacts(
  supabase: SupabaseClient,
  provider: EmbeddingProvider,
  input: { userId: string; businessProfileId: string; facts: SmartUploadKnowledgeFactRecord[] },
): Promise<{ embedded: number }> {
  const active = input.facts.filter((fact) => !fact.superseded_by);
  if (active.length === 0) return { embedded: 0 };

  const vectors = await provider.embedBatch(active.map((fact) => fact.fact));

  let embedded = 0;
  for (let i = 0; i < active.length; i += 1) {
    const success = await upsertFactEmbedding(supabase, {
      userId: input.userId,
      businessProfileId: input.businessProfileId,
      factId: active[i]!.id,
      providerId: provider.id,
      dimensions: provider.dimensions,
      embedding: vectors[i]!,
    });
    if (success) embedded += 1;
  }

  return { embedded };
}

export type SimilarFactMatch = { factId: string; similarity: number };

/**
 * Ranks a business's already-embedded facts by similarity to a query vector.
 * In-memory cosine ranking today (fine at this scale); a future provider
 * swap to a real ANN index only changes this function's implementation, not
 * its signature or callers.
 */
export async function findSimilarFacts(
  supabase: SupabaseClient,
  input: { userId: string; businessProfileId: string; providerId: string; queryEmbedding: number[]; limit?: number },
): Promise<SimilarFactMatch[]> {
  const embeddings = await getFactEmbeddingsForBusiness(
    supabase,
    input.userId,
    input.businessProfileId,
    input.providerId,
  );

  return embeddings
    .map((row) => ({ factId: row.fact_id, similarity: cosineSimilarity(input.queryEmbedding, row.embedding) }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, input.limit ?? 10);
}

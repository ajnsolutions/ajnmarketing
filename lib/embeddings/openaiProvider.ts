import "server-only";

import OpenAI from "openai";
import { toSafeUserErrorMessage } from "@/lib/security/safe-error-message";
import { EmbeddingProviderError, type EmbeddingProvider, type EmbeddingVector } from "@/lib/embeddings/provider";

/** Update this constant to change the embedding model. Swapping models means
 * changing this constant and `OPENAI_EMBEDDING_DIMENSIONS` — never touching
 * any caller (they only depend on the EmbeddingProvider interface). */
export const OPENAI_EMBEDDING_MODEL = "text-embedding-3-small";
export const OPENAI_EMBEDDING_DIMENSIONS = 1536;

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly id = "openai:text-embedding-3-small";
  readonly dimensions = OPENAI_EMBEDDING_DIMENSIONS;

  private client: OpenAI;

  constructor(apiKey = process.env.OPENAI_API_KEY) {
    if (!apiKey?.trim()) {
      throw new EmbeddingProviderError("OPENAI_API_KEY is not configured");
    }
    this.client = new OpenAI({ apiKey });
  }

  async embed(text: string): Promise<EmbeddingVector> {
    const [vector] = await this.embedBatch([text]);
    return vector!;
  }

  async embedBatch(texts: string[]): Promise<EmbeddingVector[]> {
    if (texts.length === 0) return [];

    try {
      const response = await this.client.embeddings.create({
        model: OPENAI_EMBEDDING_MODEL,
        input: texts,
      });

      return response.data
        .slice()
        .sort((a, b) => a.index - b.index)
        .map((item) => item.embedding);
    } catch (error) {
      throw new EmbeddingProviderError(
        toSafeUserErrorMessage(error, "Embedding generation is temporarily unavailable.")
      );
    }
  }
}

export function isOpenAiEmbeddingConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

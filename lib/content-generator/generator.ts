import {
  isOpenAiContentGeneratorConfigured,
  OpenAIContentGenerator,
} from "@/lib/content-generator/openai-generator";
import type { ContentGenerator } from "@/lib/content-generator/types";

export function createContentGenerator(): ContentGenerator {
  if (!isOpenAiContentGeneratorConfigured()) {
    throw new Error(
      "Content generation is temporarily unavailable. Please try again later."
    );
  }

  return new OpenAIContentGenerator();
}

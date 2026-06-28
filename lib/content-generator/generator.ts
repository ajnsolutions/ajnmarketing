import {
  isOpenAiContentGeneratorConfigured,
  OpenAIContentGenerator,
} from "@/lib/content-generator/openai-generator";
import type { ContentGenerator } from "@/lib/content-generator/types";

export function createContentGenerator(): ContentGenerator {
  if (!isOpenAiContentGeneratorConfigured()) {
    throw new Error(
      "Content generation requires OPENAI_API_KEY. Add it to your server environment and try again."
    );
  }

  return new OpenAIContentGenerator();
}

import type { AiMarketingProfileGenerator } from "@/lib/ai-marketing-profile/types";
import { OpenAiMarketingProfileGenerator } from "@/lib/ai-marketing-profile/openai-generator";

/**
 * Always uses the real OpenAI generator. If OPENAI_API_KEY isn't configured, the generator's
 * constructor throws an AiMarketingProfileGenerationError — this is intentionally NOT caught
 * here and silently swapped for placeholder content; the caller's failure handling (status
 * "failed", logged details, user-facing retry) is the single source of truth for any
 * generation problem, configuration-related or otherwise.
 */
export function createAiMarketingProfileGenerator(): AiMarketingProfileGenerator {
  return new OpenAiMarketingProfileGenerator();
}

export { PlaceholderAiMarketingProfileGenerator } from "@/lib/ai-marketing-profile/placeholder-generator";

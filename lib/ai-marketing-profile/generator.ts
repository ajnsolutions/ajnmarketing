import type { AiMarketingProfileGenerator } from "@/lib/ai-marketing-profile/types";
import { isOpenAiMarketingProfileConfigured, OpenAiMarketingProfileGenerator } from "@/lib/ai-marketing-profile/openai-generator";
import { PlaceholderAiMarketingProfileGenerator } from "@/lib/ai-marketing-profile/placeholder-generator";

export function createAiMarketingProfileGenerator(): AiMarketingProfileGenerator {
  if (isOpenAiMarketingProfileConfigured()) {
    return new OpenAiMarketingProfileGenerator();
  }

  return new PlaceholderAiMarketingProfileGenerator();
}

export { PlaceholderAiMarketingProfileGenerator } from "@/lib/ai-marketing-profile/placeholder-generator";

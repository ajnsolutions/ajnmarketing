import { analyzeWebsiteForDemo, buildWebsiteSnapshot } from "@/lib/interactive-demo/analyze";
import { getCachedDemoResult, setCachedDemoResult } from "@/lib/interactive-demo/cache";
import {
  generateDemoContentExamples,
  WEEKLY_WORKFLOW_STEPS,
} from "@/lib/interactive-demo/content";
import {
  buildMarketingSnapshot,
  generateDemoMarketingProfile,
} from "@/lib/interactive-demo/profile";
import { buildDemoRecommendations } from "@/lib/interactive-demo/recommendations";
import type {
  InteractiveDemoInput,
  InteractiveDemoResult,
} from "@/lib/interactive-demo/types";
import { assertPublicDemoUrl } from "@/lib/interactive-demo/url-safety";

export async function runInteractiveDemo(
  input: InteractiveDemoInput,
): Promise<InteractiveDemoResult> {
  const started = Date.now();
  const websiteUrl = assertPublicDemoUrl(input.websiteUrl);

  const cached = getCachedDemoResult(websiteUrl);
  if (cached) {
    return {
      ...cached,
      meta: {
        ...cached.meta,
        cached: true,
        durationMs: Date.now() - started,
      },
    };
  }

  const { extraction, sourceUrl } = await analyzeWebsiteForDemo({
    ...input,
    websiteUrl,
  });

  const profile = await generateDemoMarketingProfile({
    input: { ...input, websiteUrl },
    extraction,
    sourceUrl,
  });

  const [recommendations, contentExamples] = await Promise.all([
    Promise.resolve(buildDemoRecommendations(extraction)),
    generateDemoContentExamples({
      input: { ...input, websiteUrl },
      extraction,
      profile,
      sourceUrl,
    }),
  ]);

  const result: InteractiveDemoResult = {
    websiteSnapshot: buildWebsiteSnapshot({
      extraction,
      sourceUrl,
      input: { ...input, websiteUrl },
    }),
    marketingSnapshot: buildMarketingSnapshot(profile),
    recommendations,
    contentExamples,
    weeklyWorkflow: [...WEEKLY_WORKFLOW_STEPS],
    meta: {
      cached: false,
      durationMs: Date.now() - started,
      inferredBusinessName:
        input.businessName?.trim() || extraction.businessName || "Your business",
      inferredIndustry: input.industry?.trim() || extraction.industry || "Local services",
      inferredCity:
        input.city?.trim() ||
        extraction.citiesMentioned[0] ||
        extraction.serviceAreas[0] ||
        null,
    },
  };

  setCachedDemoResult(websiteUrl, result);
  return result;
}

import { createWebsiteExtractor } from "@/lib/website-analysis/extractor";
import { fetchWebsiteContent } from "@/lib/website-analysis/fetcher";
import type { InteractiveDemoInput } from "@/lib/interactive-demo/types";
import { emptyExtractorProfile } from "@/lib/interactive-demo/stubs";
import { assertPublicDemoUrl } from "@/lib/interactive-demo/url-safety";
import type { WebsiteExtractionResult } from "@/lib/website-analysis/types";

export async function analyzeWebsiteForDemo(input: InteractiveDemoInput): Promise<{
  extraction: WebsiteExtractionResult;
  sourceUrl: string;
}> {
  const sourceUrl = assertPublicDemoUrl(input.websiteUrl);
  const website = await fetchWebsiteContent(sourceUrl);
  const extractor = createWebsiteExtractor();
  const extraction = await extractor.extract({
    website,
    profile: emptyExtractorProfile({ ...input, websiteUrl: sourceUrl }),
  });

  return { extraction, sourceUrl: website.finalUrl || sourceUrl };
}

export function buildWebsiteSnapshot(options: {
  extraction: WebsiteExtractionResult;
  sourceUrl: string;
  input: InteractiveDemoInput;
}) {
  const { extraction, sourceUrl, input } = options;
  const businessName =
    input.businessName?.trim() || extraction.businessName || "Your business";
  const industry = input.industry?.trim() || extraction.industry || "Local services";

  return {
    kind: "live_findings" as const,
    businessSummary:
      extraction.executiveSummary ||
      `${businessName} appears to be a ${industry.toLowerCase()} business serving ${
        extraction.serviceAreas[0] ||
        input.city ||
        extraction.citiesMentioned[0] ||
        "local customers"
      }.`,
    businessName,
    industry,
    strengths: extraction.strengths.slice(0, 4),
    improvementOpportunities: (
      extraction.highestRoiImprovements.length > 0
        ? extraction.highestRoiImprovements
        : extraction.weaknesses
    ).slice(0, 4),
    services: extraction.primaryServices.slice(0, 6),
    serviceAreas: (
      extraction.serviceAreas.length > 0
        ? extraction.serviceAreas
        : extraction.citiesMentioned
    ).slice(0, 5),
    sourceUrl,
  };
}

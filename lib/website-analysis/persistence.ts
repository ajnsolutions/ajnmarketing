import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  DetectedService,
  SeoFinding,
  WebsiteAnalysis,
  WebsiteAnalysisStatus,
  WebsiteExtractionResult,
} from "@/lib/website-analysis/types";

function toDetectedServices(services: string[]): DetectedService[] {
  return services.map((name, index) => ({
    name,
    confidence: Math.max(72, 98 - index * 4),
    opportunity: index < 2 ? "High" : index < 5 ? "Medium" : "Low",
  }));
}

function buildSeoFindings(extraction: WebsiteExtractionResult, seoScore: number): SeoFinding[] {
  return [
    {
      label: "Meta Titles",
      status: extraction.metaTitle ? "good" : "warning",
      detail: extraction.metaTitle
        ? `Detected title: ${extraction.metaTitle.slice(0, 60)}`
        : "Missing homepage title tag",
    },
    {
      label: "Meta Descriptions",
      status: extraction.metaDescription ? "good" : "warning",
      detail: extraction.metaDescription
        ? "Meta description detected on homepage"
        : "Missing meta description on key pages",
    },
    {
      label: "H1 Headings",
      status: extraction.h1Headings.length > 0 ? "good" : "poor",
      detail:
        extraction.h1Headings.length > 0
          ? `${extraction.h1Headings.length} H1 headings detected`
          : "No H1 heading found",
    },
    {
      label: "Internal Linking",
      status: extraction.internalLinks >= 8 ? "good" : extraction.internalLinks >= 3 ? "warning" : "poor",
      detail: `${extraction.internalLinks} internal links detected`,
    },
    {
      label: "Local Signals",
      status: extraction.citiesMentioned.length >= 2 ? "good" : "warning",
      detail: `${extraction.citiesMentioned.length} cities mentioned on site`,
    },
    {
      label: "Overall SEO Health",
      status: seoScore >= 80 ? "good" : seoScore >= 65 ? "warning" : "poor",
      detail: `Estimated SEO score: ${seoScore}/100`,
    },
  ];
}

function calculateScores(extraction: WebsiteExtractionResult) {
  let seoScore = 70;
  if (extraction.metaTitle) seoScore += 8;
  if (extraction.metaDescription) seoScore += 8;
  if (extraction.h1Headings.length > 0) seoScore += 6;
  if (extraction.internalLinks >= 8) seoScore += 5;
  if (extraction.citiesMentioned.length >= 2) seoScore += 5;
  seoScore -= extraction.seoIssues.length * 4;
  seoScore = Math.max(45, Math.min(98, seoScore));

  let analysisScore = 75;
  if (extraction.primaryServices.length >= 3) analysisScore += 8;
  if (extraction.phoneNumbers.length > 0) analysisScore += 5;
  if (extraction.callsToAction.length > 0) analysisScore += 4;
  if (extraction.brandVoice) analysisScore += 4;
  analysisScore = Math.max(50, Math.min(96, analysisScore));

  return { seoScore, analysisScore };
}

export function mapExtractionToAnalysisRow(
  userId: string,
  businessProfileId: string,
  website: string,
  extraction: WebsiteExtractionResult
) {
  const { seoScore, analysisScore } = calculateScores(extraction);
  const services = toDetectedServices([
    ...extraction.primaryServices,
    ...extraction.secondaryServices,
  ]).slice(0, 8);

  return {
    user_id: userId,
    business_profile_id: businessProfileId,
    website,
    analysis_status: "completed" as WebsiteAnalysisStatus,
    analysis_score: analysisScore,
    brand_voice: extraction.brandVoice,
    tone: extraction.tone,
    keywords: extraction.keywords,
    services,
    cities: extraction.citiesMentioned,
    seo_score: seoScore,
    seo_findings: buildSeoFindings(extraction, seoScore),
    raw_summary: extraction,
  };
}

export async function getWebsiteAnalysisForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<WebsiteAnalysis | null> {
  const { data, error } = await supabase
    .from("website_analysis")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return data as WebsiteAnalysis;
}

export async function upsertWebsiteAnalysisStatus(
  supabase: SupabaseClient,
  input: {
    userId: string;
    businessProfileId: string;
    website: string;
    status: WebsiteAnalysisStatus;
  }
): Promise<WebsiteAnalysis | null> {
  const { data, error } = await supabase
    .from("website_analysis")
    .upsert(
      {
        user_id: input.userId,
        business_profile_id: input.businessProfileId,
        website: input.website,
        analysis_status: input.status,
      },
      { onConflict: "user_id" }
    )
    .select("*")
    .single();

  if (error) return null;
  return data as WebsiteAnalysis;
}

export async function saveWebsiteAnalysisResult(
  supabase: SupabaseClient,
  row: ReturnType<typeof mapExtractionToAnalysisRow>
): Promise<WebsiteAnalysis | null> {
  const { data, error } = await supabase
    .from("website_analysis")
    .upsert(row, { onConflict: "user_id" })
    .select("*")
    .single();

  if (error) return null;
  return data as WebsiteAnalysis;
}

export async function markWebsiteAnalysisFailed(
  supabase: SupabaseClient,
  userId: string,
  website: string,
  businessProfileId: string,
  errorSummary?: string
) {
  await supabase.from("website_analysis").upsert(
    {
      user_id: userId,
      business_profile_id: businessProfileId,
      website,
      analysis_status: "failed",
      raw_summary: errorSummary
        ? {
            businessName: "",
            industry: "",
            primaryServices: [],
            secondaryServices: [],
            serviceAreas: [],
            citiesMentioned: [],
            phoneNumbers: [],
            emailAddresses: [],
            businessHours: [],
            callsToAction: [],
            keywords: [],
            brandVoice: "",
            readingLevel: "",
            tone: "",
            customerPersona: "",
            valueProposition: "",
            metaTitle: null,
            metaDescription: null,
            h1Headings: [],
            seoIssues: [],
            internalLinks: 0,
            pageCountEstimate: 0,
            strengths: [],
            weaknesses: [],
            highestRoiImprovements: [],
            nextRecommendedActions: "",
            executiveSummary: errorSummary,
            contentOpportunities: [],
          }
        : null,
    },
    { onConflict: "user_id" }
  );
}

export function formatRelativeTime(isoDate: string | null | undefined): string {
  if (!isoDate) return "Not yet analyzed";

  const diffMs = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function formatAnalysisStatus(status: WebsiteAnalysisStatus | null | undefined): string {
  switch (status) {
    case "pending":
      return "Queued";
    case "running":
      return "Analyzing";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    default:
      return "Not started";
  }
}

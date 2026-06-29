import {
  createWebsiteExtractor,
  PlaceholderWebsiteExtractor,
} from "@/lib/website-analysis/extractor";
import { fetchWebsiteContentSafe } from "@/lib/website-analysis/fetcher";
import { formatOpenAiError, isOpenAiConfigured } from "@/lib/website-analysis/openai-extractor";
import {
  mapExtractionToAnalysisRow,
  markWebsiteAnalysisFailed,
  saveWebsiteAnalysisResult,
  upsertWebsiteAnalysisStatus,
} from "@/lib/website-analysis/persistence";
import type { WebsiteAnalysis, WebsiteExtractionResult } from "@/lib/website-analysis/types";
import type { BusinessProfile } from "@/lib/business-profile";
import { createClient } from "@/lib/supabase/server";

export async function queueWebsiteAnalysisForProfile(
  profile: BusinessProfile
): Promise<WebsiteAnalysis | null> {
  if (!profile.website?.trim()) return null;

  const supabase = await createClient();

  return upsertWebsiteAnalysisStatus(supabase, {
    userId: profile.user_id,
    businessProfileId: profile.id,
    website: profile.website,
    status: "pending",
  });
}

function buildWebsiteInput(profile: BusinessProfile, website: Awaited<ReturnType<typeof fetchWebsiteContentSafe>>) {
  return {
    website:
      website ??
      ({
        url: profile.website!,
        finalUrl: profile.website!,
        html: "",
        textContent: "",
        fetchedAt: new Date().toISOString(),
      } as const),
    profile,
  };
}

function appendFallbackNote(
  extraction: WebsiteExtractionResult,
  note: string
): WebsiteExtractionResult {
  return {
    ...extraction,
    executiveSummary: `${extraction.executiveSummary} ${note}`.trim(),
  };
}

async function extractWithFallback(
  input: ReturnType<typeof buildWebsiteInput>,
  primaryError?: unknown
): Promise<WebsiteExtractionResult> {
  if (isOpenAiConfigured()) {
    try {
      return await new PlaceholderWebsiteExtractor().extract(input);
    } catch (fallbackError) {
      const primaryMessage = primaryError ? formatOpenAiError(primaryError) : "OpenAI analysis failed";
      const fallbackMessage =
        fallbackError instanceof Error ? fallbackError.message : "Fallback extraction failed";

      throw new Error(`${primaryMessage}. ${fallbackMessage}`);
    }
  }

  throw primaryError instanceof Error
    ? primaryError
    : new Error(formatOpenAiError(primaryError));
}

export async function runWebsiteAnalysisForUser(userId: string): Promise<WebsiteAnalysis | null> {
  const supabase = await createClient();

  const { data: profile, error: profileError } = await supabase
    .from("business_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileError || !profile?.website?.trim()) {
    return null;
  }

  const typedProfile = profile as BusinessProfile;

  await upsertWebsiteAnalysisStatus(supabase, {
    userId,
    businessProfileId: typedProfile.id,
    website: typedProfile.website!,
    status: "running",
  });

  const website = await fetchWebsiteContentSafe(typedProfile.website!);
  const input = buildWebsiteInput(typedProfile, website);
  const extractor = createWebsiteExtractor();

  try {
    let extraction: WebsiteExtractionResult;

    try {
      extraction = await extractor.extract(input);
    } catch (primaryError) {
      if (isOpenAiConfigured()) {
        extraction = appendFallbackNote(
          await extractWithFallback(input, primaryError),
          "(OpenAI analysis was unavailable; basic website extraction was used.)"
        );
      } else {
        throw primaryError;
      }
    }

    const row = mapExtractionToAnalysisRow(
      userId,
      typedProfile.id,
      typedProfile.website!,
      extraction
    );

    const result = await saveWebsiteAnalysisResult(supabase, row);
    return result;
  } catch (error) {
    console.error("[WebsiteAnalysis] Analysis failed:", formatOpenAiError(error));
    await markWebsiteAnalysisFailed(
      supabase,
      userId,
      typedProfile.website!,
      typedProfile.id,
      formatOpenAiError(error)
    );
    return null;
  }
}

export async function queueAndRunWebsiteAnalysis(
  profile: BusinessProfile
): Promise<WebsiteAnalysis | null> {
  await queueWebsiteAnalysisForProfile(profile);
  return runWebsiteAnalysisForUser(profile.user_id);
}

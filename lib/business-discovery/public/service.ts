import "server-only";

/**
 * Public Business Discovery snapshot — orchestration service.
 *
 * validate -> (cache check) -> fetch (hardened) -> extract (graceful
 * fallback) -> adapt (ephemeral, public-safe objects) -> collect (allowlisted
 * collectors only) -> normalize -> build (PR #73, unchanged) -> map to the
 * public contract -> cache + issue a handoff reference.
 *
 * No Supabase client is created or imported anywhere in this file. No user,
 * business, tenant, or Marketing Profile row is ever written. This is
 * intentional and structural, not merely a runtime behavior: there is no
 * import path from this file to any `createClient`/`upsert*`/persistence
 * function in the codebase.
 */

import { createWebsiteExtractor, PlaceholderWebsiteExtractor } from "@/lib/website-analysis/extractor";
import { OpenAIWebsiteExtractor, isOpenAiConfigured } from "@/lib/website-analysis/openai-extractor";
import { createAiMarketingProfileGenerator, PlaceholderAiMarketingProfileGenerator } from "@/lib/ai-marketing-profile/generator";
import { isOpenAiMarketingProfileConfigured } from "@/lib/ai-marketing-profile/openai-generator";
import type { AiMarketingProfileGenerated } from "@/lib/ai-marketing-profile/types";
import type { WebsiteExtractionResult } from "@/lib/website-analysis/types";

import { validatePublicSnapshotUrl, type DnsResolver } from "@/lib/business-discovery/public/urlSafety";
import { fetchPublicSnapshotWebsite, PublicSnapshotFetchError, type PerformPinnedRequestFn } from "@/lib/business-discovery/public/fetchWebsite";
import {
  buildEphemeralPublicAiMarketingProfile,
  buildEphemeralPublicBusinessProfile,
  buildEphemeralPublicWebsiteAnalysis,
} from "@/lib/business-discovery/public/adapter";
import {
  collectAiMarketingProfileObservations,
  collectBusinessProfileObservations,
  collectWebsiteAnalysisObservations,
} from "@/lib/business-discovery/collectors";
import { normalizeBusinessDiscoveryObservations } from "@/lib/business-discovery/normalize";
import { buildBusinessDiscoveryResult } from "@/lib/business-discovery/buildResult";
import { mapToPublicBusinessDiscoveryResult } from "@/lib/business-discovery/public/mapPublicResult";
import { getCachedPublicSnapshot, issuePublicSnapshotReference, setCachedPublicSnapshot } from "@/lib/business-discovery/public/cache";
import { trackPublicSnapshotEvent } from "@/lib/business-discovery/public/observability";
import { PUBLIC_DISCOVERY_SOURCE_ALLOWLIST, type PublicBusinessDiscoveryResultV1, type PublicSnapshotRequestV1 } from "@/lib/business-discovery/public/types";
import type { BusinessDiscoveryObservation } from "@/lib/business-discovery/types";

const EXTRACTION_TIMEOUT_MS = 20_000;
const AI_PROFILE_TIMEOUT_MS = 20_000;

export class PublicSnapshotUpstreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublicSnapshotUpstreamError";
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number, onTimeoutMessage: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new PublicSnapshotUpstreamError(onTimeoutMessage)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

/** Runs extraction, always succeeding by falling back to the deterministic placeholder extractor on any AI failure or timeout. */
async function extractWithGracefulFallback(
  website: Parameters<ReturnType<typeof createWebsiteExtractor>["extract"]>[0]["website"],
  profile: Parameters<ReturnType<typeof createWebsiteExtractor>["extract"]>[0]["profile"]
): Promise<{ extraction: WebsiteExtractionResult; degraded: boolean }> {
  if (isOpenAiConfigured()) {
    try {
      const extraction = await withTimeout(
        new OpenAIWebsiteExtractor().extract({ website, profile }),
        EXTRACTION_TIMEOUT_MS,
        "Website analysis took too long."
      );
      return { extraction, degraded: false };
    } catch {
      // Fall through to the deterministic placeholder — a degraded result beats no result.
    }
  }
  const extraction = await new PlaceholderWebsiteExtractor().extract({ website, profile });
  return { extraction, degraded: true };
}

/** Runs AI Marketing Profile synthesis, always succeeding by falling back to the deterministic placeholder generator. */
async function generateAiProfileWithGracefulFallback(
  extraction: WebsiteExtractionResult,
  ephemeralProfile: ReturnType<typeof buildEphemeralPublicBusinessProfile>,
  ephemeralAnalysis: ReturnType<typeof buildEphemeralPublicWebsiteAnalysis>
): Promise<{ generated: AiMarketingProfileGenerated; degraded: boolean }> {
  const sourceData = {
    businessProfile: ephemeralProfile,
    websiteAnalysis: {
      id: ephemeralAnalysis.id,
      analysis_status: ephemeralAnalysis.analysis_status,
      brand_voice: ephemeralAnalysis.brand_voice,
      tone: ephemeralAnalysis.tone,
      keywords: ephemeralAnalysis.keywords,
      services: extraction.primaryServices.map((name) => ({ name })),
      cities: ephemeralAnalysis.cities,
      raw_summary: extraction,
    },
  };

  if (isOpenAiMarketingProfileConfigured()) {
    try {
      const generated = await withTimeout(
        createAiMarketingProfileGenerator().generate(sourceData),
        AI_PROFILE_TIMEOUT_MS,
        "Business profile synthesis took too long."
      );
      return { generated, degraded: false };
    } catch {
      // Fall through to the deterministic placeholder.
    }
  }
  const generated = await new PlaceholderAiMarketingProfileGenerator().generate(sourceData);
  return { generated, degraded: true };
}

export type RunPublicBusinessDiscoveryOptions = {
  resolver?: DnsResolver;
  requestImpl?: PerformPinnedRequestFn;
};

export async function runPublicBusinessDiscovery(
  request: PublicSnapshotRequestV1,
  options: RunPublicBusinessDiscoveryOptions = {}
): Promise<PublicBusinessDiscoveryResultV1> {
  const started = Date.now();
  trackPublicSnapshotEvent("scan_requested");

  const validated = await validatePublicSnapshotUrl(request.websiteUrl, { resolver: options.resolver }).catch(
    (error) => {
      trackPublicSnapshotEvent("blocked_url");
      throw error;
    }
  );

  const cached = getCachedPublicSnapshot(validated.url);
  if (cached) {
    trackPublicSnapshotEvent("cache_hit", { durationMs: Date.now() - started });
    return cached;
  }
  trackPublicSnapshotEvent("cache_miss");

  let website;
  try {
    website = await fetchPublicSnapshotWebsite(validated, { resolver: options.resolver, requestImpl: options.requestImpl });
  } catch (error) {
    if (error instanceof PublicSnapshotFetchError && error.code === "timeout") {
      trackPublicSnapshotEvent("timeout", { durationMs: Date.now() - started });
    } else {
      trackPublicSnapshotEvent("discovery_failed", { durationMs: Date.now() - started, failureCategory: "fetch" });
    }
    throw error;
  }

  const ephemeralProfile = buildEphemeralPublicBusinessProfile(request, null, website.finalUrl || validated.url);
  const profileInputForExtraction = {
    business_name: ephemeralProfile.business_name,
    industry: ephemeralProfile.industry,
    website: ephemeralProfile.website,
    phone: ephemeralProfile.phone,
    city: ephemeralProfile.city,
    state: ephemeralProfile.state,
    primary_service_area: ephemeralProfile.primary_service_area,
    nearby_cities: ephemeralProfile.nearby_cities,
    primary_services: ephemeralProfile.primary_services,
    emergency_services: ephemeralProfile.emergency_services,
    seasonal_services: ephemeralProfile.seasonal_services,
    specialty_services: ephemeralProfile.specialty_services,
    brand_voice_tone: ephemeralProfile.brand_voice_tone,
    preferred_words: ephemeralProfile.preferred_words,
    avoid_words: ephemeralProfile.avoid_words,
    voice_notes: ephemeralProfile.voice_notes,
  };

  const { extraction, degraded: extractionDegraded } = await extractWithGracefulFallback(
    website,
    profileInputForExtraction
  );

  const finalProfile = buildEphemeralPublicBusinessProfile(request, extraction, website.finalUrl || validated.url);
  const ephemeralAnalysis = buildEphemeralPublicWebsiteAnalysis(extraction, website.finalUrl || validated.url);

  const { generated: aiProfileGenerated, degraded: aiProfileDegraded } = await generateAiProfileWithGracefulFallback(
    extraction,
    finalProfile,
    ephemeralAnalysis
  );
  const ephemeralAiProfile = buildEphemeralPublicAiMarketingProfile(aiProfileGenerated);

  const observations: BusinessDiscoveryObservation[] = [
    ...collectBusinessProfileObservations(finalProfile),
    ...collectWebsiteAnalysisObservations(ephemeralAnalysis),
    ...collectAiMarketingProfileObservations(ephemeralAiProfile),
  ].filter((observation) => PUBLIC_DISCOVERY_SOURCE_ALLOWLIST.has(observation.source));

  const unified = normalizeBusinessDiscoveryObservations(finalProfile.id, observations);
  const internalResult = buildBusinessDiscoveryResult(unified);

  const reference = issuePublicSnapshotReference(validated.url);
  const publicResult = mapToPublicBusinessDiscoveryResult(internalResult, reference, {
    websiteUrl: validated.url,
    businessName: request.businessName ?? null,
    city: request.city ?? null,
    stateOrRegion: request.stateOrRegion ?? null,
  });

  setCachedPublicSnapshot(validated.url, publicResult);

  if (extractionDegraded || aiProfileDegraded) {
    trackPublicSnapshotEvent("discovery_partial", { durationMs: Date.now() - started });
  } else {
    trackPublicSnapshotEvent("discovery_completed", { durationMs: Date.now() - started });
  }

  return publicResult;
}

import type { WebsiteExtractor, WebsiteExtractionResult } from "@/lib/website-analysis/types";
import { inferCustomerPersonaFromSource } from "@/lib/website-analysis/customer-persona";
import { inferContentOpportunitiesFromSource } from "@/lib/website-analysis/content-opportunities";
import { isOpenAiConfigured, OpenAIWebsiteExtractor } from "@/lib/website-analysis/openai-extractor";

function matchAll(text: string, pattern: RegExp): string[] {
  return [...text.matchAll(pattern)].map((match) => match[0].trim()).filter(Boolean);
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function splitServices(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];

  return unique(
    raw
      .split(/[\n,;|•]/)
      .map((item) => item.trim())
      .filter((item) => item.length > 1)
  );
}

function extractMeta(html: string, name: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, "i"),
    new RegExp(`<meta[^>]+property=["']og:${name}["'][^>]+content=["']([^"']+)["']`, "i"),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1].trim();
  }

  return null;
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match?.[1]?.trim() ?? null;
}

function extractHeadings(html: string, tag: "h1" | "h2"): string[] {
  const pattern = new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, "gi");
  return unique(matchAll(html, pattern)).slice(0, 8);
}

function countInternalLinks(html: string, host: string): number {
  const pattern = /href=["']([^"']+)["']/gi;
  let count = 0;

  for (const match of html.matchAll(pattern)) {
    const href = match[1];
    if (href.startsWith("/") || href.includes(host)) count += 1;
  }

  return count;
}

function estimatePageCount(html: string, internalLinks: number): number {
  const navLinks = matchAll(html, /href=["']([^"']+)["']/gi).filter((href) => href.startsWith("/"));
  return Math.max(1, Math.min(50, unique(navLinks).length || Math.ceil(internalLinks / 4)));
}

function inferReadingLevel(text: string): string {
  const words = text.split(/\s+/).filter(Boolean);
  const avgWordLength =
    words.reduce((total, word) => total + word.replace(/[^a-z]/gi, "").length, 0) /
    Math.max(words.length, 1);

  if (avgWordLength <= 4.5) return "Easy to understand";
  if (avgWordLength <= 5.5) return "8th grade — clear and accessible";
  return "Professional reading level";
}

function buildKeywords(text: string, profileWords: string[]): string[] {
  const candidates = matchAll(text.toLowerCase(), /\b[a-z][a-z\s-]{2,24}\b/g)
    .flatMap((phrase) => phrase.split(/\s+/))
    .filter((word) => word.length > 3);

  const frequency = new Map<string, number>();
  for (const word of candidates) {
    frequency.set(word, (frequency.get(word) ?? 0) + 1);
  }

  const topKeywords = [...frequency.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([word]) => word);

  return unique([...profileWords, ...topKeywords]).slice(0, 12);
}

/**
 * Placeholder extractor using HTML heuristics + onboarding profile data.
 * Swap for an OpenAI-backed extractor by implementing WebsiteExtractor elsewhere.
 */
export class PlaceholderWebsiteExtractor implements WebsiteExtractor {
  async extract({
    website,
    profile,
  }: Parameters<WebsiteExtractor["extract"]>[0]): Promise<WebsiteExtractionResult> {
    const html = website.html;
    const text = website.textContent;
    const host = new URL(website.finalUrl).hostname;

    const profilePrimaryServices = splitServices(profile.primary_services);
    const profileSecondaryServices = unique([
      ...splitServices(profile.emergency_services),
      ...splitServices(profile.seasonal_services),
      ...splitServices(profile.specialty_services),
    ]).filter((service) => !profilePrimaryServices.includes(service));

    const headingServices = extractHeadings(html, "h2").slice(0, 6);
    const primaryServices = unique([...profilePrimaryServices, ...headingServices]).slice(0, 8);
    const secondaryServices = unique([...profileSecondaryServices, ...headingServices.slice(3)]).slice(
      0,
      8
    );

    const citiesMentioned = unique([
      profile.city ?? "",
      ...splitServices(profile.nearby_cities),
      ...matchAll(text, /\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)?,\s?[A-Z]{2}\b/g),
    ]).filter(Boolean);

    const phoneNumbers = unique([
      profile.phone ?? "",
      ...matchAll(text, /\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g),
    ]).filter(Boolean);

    const emailAddresses = unique(matchAll(text, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi));
    const callsToAction = unique(
      matchAll(text, /\b(call now|schedule service|book online|get a quote|contact us|free estimate)\b/gi)
    );

    const metaTitle = extractMeta(html, "title") ?? extractTitle(html);
    const metaDescription = extractMeta(html, "description");
    const h1Headings = extractHeadings(html, "h1");
    const internalLinks = countInternalLinks(html, host);
    const pageCountEstimate = estimatePageCount(html, internalLinks);

    const preferredWords = splitServices(profile.preferred_words?.replace(/,/g, "\n"));
    const keywords = buildKeywords(text, preferredWords);

    const businessName = profile.business_name ?? metaTitle ?? "Your Business";
    const industry = profile.industry ?? "Local Service Business";
    const tone =
      profile.brand_voice_tone ??
      (text.toLowerCase().includes("family") ? "Friendly, trustworthy, and local" : "Professional and helpful");

    const brandVoice =
      profile.voice_notes?.trim() ||
      `${businessName} communicates in a ${tone.toLowerCase()} voice focused on local trust, service clarity, and customer confidence.`;

    const seoIssues: string[] = [];
    if (!metaDescription) seoIssues.push("Missing or incomplete meta descriptions");
    if (h1Headings.length === 0) seoIssues.push("No H1 heading detected on homepage");
    if (internalLinks < 5) seoIssues.push("Limited internal linking structure");
    if (citiesMentioned.length < 2) seoIssues.push("Few local city references detected");

    const strengths = [
      primaryServices.length > 0 ? "Clear service offerings detected on the website" : "Website content available for optimization",
      phoneNumbers.length > 0 ? "Phone number prominently available for local leads" : "Business contact details present",
      tone ? "Consistent customer-focused tone" : "Professional presentation",
    ];

    const weaknesses = seoIssues.slice(0, 3);
    const highestRoiImprovements = [
      "Add FAQ sections to top service pages",
      citiesMentioned.length > 1
        ? `Create landing pages for ${citiesMentioned.slice(1, 3).join(" and ")}`
        : "Create geo-targeted landing pages for nearby cities",
      "Implement LocalBusiness schema markup",
    ];

    const cityLabel = profile.city ?? citiesMentioned[0] ?? "your area";
    const input = { website, profile };

    const extractionBase = {
      businessName,
      industry,
      primaryServices,
      secondaryServices,
      serviceAreas: unique([profile.primary_service_area ?? "", ...citiesMentioned]).filter(Boolean),
      citiesMentioned,
      phoneNumbers,
      emailAddresses,
      businessHours: matchAll(text, /\b(mon|tue|wed|thu|fri|sat|sun)[^.\n]{0,40}\d{1,2}(?::\d{2})?\s?(?:am|pm)/gi).slice(
        0,
        3
      ),
      callsToAction: callsToAction.length
        ? callsToAction
        : ["Call now", "Schedule service", "Contact us"],
      keywords,
      brandVoice,
      readingLevel: inferReadingLevel(text.slice(0, 5000)),
      tone,
      customerPersona: inferCustomerPersonaFromSource(input),
      valueProposition:
        h1Headings[0] ??
        `Trusted local ${industry.toLowerCase()} serving ${cityLabel} with fast, professional service.`,
      metaTitle,
      metaDescription,
      h1Headings,
      seoIssues,
      internalLinks,
      pageCountEstimate,
      strengths,
      weaknesses,
      highestRoiImprovements,
      nextRecommendedActions:
        "Approve AI-generated FAQ content, publish local landing pages, and schedule Google Business Profile posts aligned with your highest-opportunity services.",
      executiveSummary: `${businessName} presents as a trusted, locally focused ${industry.toLowerCase()} serving ${cityLabel}. The website provides a foundation for local SEO, Google Business Profile content, and AI-generated marketing assets.`,
    };

    return {
      ...extractionBase,
      contentOpportunities: inferContentOpportunitiesFromSource(input, extractionBase),
    };
  }
}

export function createWebsiteExtractor(): WebsiteExtractor {
  const hasOpenAiKey = isOpenAiConfigured();
  console.log("[WebsiteAnalysis] OPENAI_API_KEY present:", hasOpenAiKey);

  if (hasOpenAiKey) {
    console.log("[WebsiteAnalysis] Selected extractor: OpenAIWebsiteExtractor");
    return new OpenAIWebsiteExtractor();
  }

  console.log("[WebsiteAnalysis] Selected extractor: PlaceholderWebsiteExtractor");
  return new PlaceholderWebsiteExtractor();
}

/**
 * Website import (Part 1) — finds testimonial-shaped quotes in already-
 * fetched website text (lib/website-analysis/fetcher.ts's fetchWebsiteContentSafe,
 * reused rather than re-implemented). Pure, deterministic pattern matching —
 * no AI call for detection; the shared AI extractor (openai-extractor.ts)
 * still runs afterward on each imported quote, exactly like manual/bulk/CSV
 * testimonials. Never invents a quote that isn't a verbatim substring of the
 * page text.
 */

import { MAX_TESTIMONIAL_QUOTE_LENGTH, type RawTestimonialInput } from "@/lib/testimonials/types";

const MIN_QUOTE_LENGTH = 40;
const MAX_QUOTE_LENGTH = 600;
const MAX_CANDIDATES = 25;

// Matches curly ("…"/"…") or straight (".."), quoted spans of plausible
// testimonial length. Global + non-greedy so overlapping quote styles both work.
const QUOTED_SPAN = /[“"]([^“”"]{40,600})[”"]/g;

// A short attribution immediately after a quote, e.g. "— Jane Smith, Owner"
// or "- Jane Smith". Captures name and an optional trailing title/company.
const ATTRIBUTION_AFTER_QUOTE = /^[\s,]*[-–—]\s*([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,3})(?:\s*,\s*([A-Za-z0-9&',\s-]{2,60}?))?(?=[.\n]|$)/;

export function extractTestimonialCandidatesFromPageText(pageText: string): RawTestimonialInput[] {
  if (!pageText.trim()) return [];

  const candidates: RawTestimonialInput[] = [];
  const seen = new Set<string>();

  for (const match of pageText.matchAll(QUOTED_SPAN)) {
    const quote = match[1]?.trim();
    if (!quote || quote.length < MIN_QUOTE_LENGTH) continue;

    const key = quote.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const afterQuote = pageText.slice((match.index ?? 0) + match[0].length, (match.index ?? 0) + match[0].length + 100);
    const attribution = ATTRIBUTION_AFTER_QUOTE.exec(afterQuote);

    candidates.push({
      quote: quote.slice(0, Math.min(quote.length, MAX_QUOTE_LENGTH, MAX_TESTIMONIAL_QUOTE_LENGTH)),
      authorName: attribution?.[1]?.trim() ?? null,
      authorTitle: attribution?.[2]?.trim() ?? null,
    });

    if (candidates.length >= MAX_CANDIDATES) break;
  }

  return candidates;
}

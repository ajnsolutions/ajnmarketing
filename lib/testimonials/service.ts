import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { splitBulkPastedTestimonials } from "@/lib/testimonials/bulkPaste";
import { parseTestimonialsCsv, type TestimonialCsvImportResult } from "@/lib/testimonials/csvImport";
import { extractTestimonialCandidatesFromPageText } from "@/lib/testimonials/websiteImport";
import { OpenAITestimonialExtractor } from "@/lib/testimonials/openai-extractor";
import {
  bulkCreateTestimonials,
  createTestimonial,
  deleteTestimonial as deleteTestimonialRow,
  getActiveTestimonialKnowledgeForUser,
  listTestimonialsForUser,
  replaceKnowledgeFactsForTestimonial,
} from "@/lib/testimonials/persistence";
import {
  TestimonialIngestionMethods,
  type RawTestimonialInput,
  type TestimonialIngestionMethod,
  type TestimonialKnowledgeFactRecord,
  type WebsiteTestimonialRecord,
} from "@/lib/testimonials/types";
import { fetchWebsiteContentSafe } from "@/lib/website-analysis/fetcher";

export type TestimonialIngestionResult = {
  testimonials: WebsiteTestimonialRecord[];
  errors: string[];
};

/**
 * Runs AI knowledge extraction for a single testimonial and persists the
 * result. Best-effort — a failed extraction leaves the testimonial itself
 * intact (it still contributes real Customer Voice evidence via the
 * provider abstraction) and is never treated as a fatal ingestion error.
 */
async function extractAndPersistKnowledge(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
  testimonial: WebsiteTestimonialRecord,
): Promise<TestimonialKnowledgeFactRecord[]> {
  try {
    const extractor = new OpenAITestimonialExtractor();
    const result = await extractor.extract(testimonial.quote);
    return replaceKnowledgeFactsForTestimonial(supabase, {
      userId,
      businessProfileId,
      testimonialId: testimonial.id,
      items: result.items,
    });
  } catch {
    return [];
  }
}

async function ingestRawTestimonials(
  supabase: SupabaseClient,
  input: {
    userId: string;
    businessProfileId: string;
    testimonials: RawTestimonialInput[];
    ingestionMethod: TestimonialIngestionMethod;
  },
): Promise<WebsiteTestimonialRecord[]> {
  if (input.testimonials.length === 0) return [];

  const created = await bulkCreateTestimonials(supabase, {
    userId: input.userId,
    businessProfileId: input.businessProfileId,
    testimonials: input.testimonials,
    ingestionMethod: input.ingestionMethod,
  });

  await Promise.all(
    created.map((testimonial) =>
      extractAndPersistKnowledge(supabase, input.userId, input.businessProfileId, testimonial),
    ),
  );

  return created;
}

export async function ingestManualTestimonial(
  supabase: SupabaseClient,
  input: { userId: string; businessProfileId: string; testimonial: RawTestimonialInput },
): Promise<WebsiteTestimonialRecord | null> {
  const created = await createTestimonial(supabase, {
    userId: input.userId,
    businessProfileId: input.businessProfileId,
    testimonial: input.testimonial,
    ingestionMethod: TestimonialIngestionMethods.MANUAL,
  });
  if (!created) return null;

  await extractAndPersistKnowledge(supabase, input.userId, input.businessProfileId, created);
  return created;
}

export async function ingestBulkPastedTestimonials(
  supabase: SupabaseClient,
  input: { userId: string; businessProfileId: string; pastedText: string },
): Promise<TestimonialIngestionResult> {
  const quotes = splitBulkPastedTestimonials(input.pastedText);
  if (quotes.length === 0) {
    return { testimonials: [], errors: ["No testimonials were found in the pasted text."] };
  }

  const testimonials = await ingestRawTestimonials(supabase, {
    userId: input.userId,
    businessProfileId: input.businessProfileId,
    testimonials: quotes.map((quote) => ({ quote })),
    ingestionMethod: TestimonialIngestionMethods.BULK_PASTE,
  });

  return { testimonials, errors: [] };
}

export async function ingestCsvTestimonials(
  supabase: SupabaseClient,
  input: { userId: string; businessProfileId: string; csvText: string },
): Promise<TestimonialIngestionResult> {
  const parsed: TestimonialCsvImportResult = parseTestimonialsCsv(input.csvText);
  if (parsed.rows.length === 0) {
    return { testimonials: [], errors: parsed.errors.length > 0 ? parsed.errors : ["No testimonials found in the CSV."] };
  }

  const testimonials = await ingestRawTestimonials(supabase, {
    userId: input.userId,
    businessProfileId: input.businessProfileId,
    testimonials: parsed.rows,
    ingestionMethod: TestimonialIngestionMethods.CSV_IMPORT,
  });

  return { testimonials, errors: parsed.errors };
}

export async function ingestWebsiteImportedTestimonials(
  supabase: SupabaseClient,
  input: { userId: string; businessProfileId: string; websiteUrl: string },
): Promise<TestimonialIngestionResult> {
  const fetched = await fetchWebsiteContentSafe(input.websiteUrl);
  if (!fetched) {
    return { testimonials: [], errors: ["Could not reach that website. Check the URL and try again."] };
  }

  const candidates = extractTestimonialCandidatesFromPageText(fetched.textContent).map((candidate) => ({
    ...candidate,
    sourceUrl: fetched.finalUrl,
  }));

  if (candidates.length === 0) {
    return { testimonials: [], errors: ["No testimonial-shaped quotes were found on that page."] };
  }

  const testimonials = await ingestRawTestimonials(supabase, {
    userId: input.userId,
    businessProfileId: input.businessProfileId,
    testimonials: candidates,
    ingestionMethod: TestimonialIngestionMethods.WEBSITE_IMPORT,
  });

  return { testimonials, errors: [] };
}

export async function listTestimonials(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
): Promise<WebsiteTestimonialRecord[]> {
  return listTestimonialsForUser(supabase, userId, businessProfileId);
}

export async function deleteTestimonial(
  supabase: SupabaseClient,
  userId: string,
  testimonialId: string,
): Promise<boolean> {
  return deleteTestimonialRow(supabase, userId, testimonialId);
}

export async function getTestimonialKnowledgeForUser(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
): Promise<TestimonialKnowledgeFactRecord[]> {
  return getActiveTestimonialKnowledgeForUser(supabase, userId, businessProfileId);
}

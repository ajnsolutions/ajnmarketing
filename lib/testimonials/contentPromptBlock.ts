/**
 * Compact prompt blocks for Content Generator — mirrors the shape of
 * lib/smart-uploads/contentPromptBlock.ts and
 * lib/customer-voice/copySuggestions.ts::formatCustomerVoiceForContentPrompt.
 *
 * Two distinct blocks, both grounded, never fabricated:
 *  - Knowledge facts (grouped by category) — reusable business knowledge.
 *  - A small number of real, verbatim quote excerpts — for authentic voice,
 *    explicitly marked so the generator never invents additional quotes.
 */

import {
  TESTIMONIAL_KNOWLEDGE_CATEGORY_LABELS,
  type TestimonialKnowledgeFactRecord,
  type WebsiteTestimonialRecord,
} from "@/lib/testimonials/types";

const MAX_FACTS_PER_CATEGORY = 4;
const MAX_CATEGORIES = 9;
const MAX_QUOTES = 2;
const MAX_QUOTE_EXCERPT_LENGTH = 220;

export function formatTestimonialKnowledgeForContentPrompt(
  facts: TestimonialKnowledgeFactRecord[] | null | undefined,
): string | null {
  const active = facts ?? [];
  if (active.length === 0) return null;

  const byCategory = new Map<string, string[]>();
  for (const fact of active) {
    const list = byCategory.get(fact.category) ?? [];
    if (list.length < MAX_FACTS_PER_CATEGORY) list.push(fact.fact);
    byCategory.set(fact.category, list);
  }

  const lines = [...byCategory.entries()]
    .slice(0, MAX_CATEGORIES)
    .map(([category, categoryFacts]) => {
      const label =
        TESTIMONIAL_KNOWLEDGE_CATEGORY_LABELS[category as keyof typeof TESTIMONIAL_KNOWLEDGE_CATEGORY_LABELS] ??
        category;
      return `${label}: ${categoryFacts.join("; ")}`;
    });

  if (lines.length === 0) return null;

  return [
    "BUSINESS KNOWLEDGE FROM CUSTOMER TESTIMONIALS (use naturally; never invent facts beyond these)",
    ...lines,
  ].join("\n");
}

/**
 * A small number of real, verbatim quote excerpts a generator may reference
 * or lightly attribute — never a license to invent additional quotes or
 * customer stories.
 */
export function formatTestimonialQuotesForContentPrompt(
  testimonials: WebsiteTestimonialRecord[] | null | undefined,
): string | null {
  const active = (testimonials ?? []).filter((t) => t.status === "active" && t.quote.trim().length > 0);
  if (active.length === 0) return null;

  const quotes = active.slice(0, MAX_QUOTES).map((t) => {
    const excerpt =
      t.quote.length > MAX_QUOTE_EXCERPT_LENGTH ? `${t.quote.slice(0, MAX_QUOTE_EXCERPT_LENGTH)}…` : t.quote;
    const attribution = t.author_name ? ` — ${t.author_name}${t.author_title ? `, ${t.author_title}` : ""}` : "";
    return `"${excerpt}"${attribution}`;
  });

  return [
    "REAL CUSTOMER QUOTES (verbatim — reuse only if it fits naturally; never alter, combine, or invent additional quotes)",
    ...quotes,
  ].join("\n");
}

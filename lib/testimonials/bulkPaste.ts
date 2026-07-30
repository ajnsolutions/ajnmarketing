/**
 * Bulk paste ingestion (Part 1) — splits one pasted block of many
 * testimonials into individual quotes. Pure, deterministic, no AI call —
 * the AI extraction step (openai-extractor.ts) runs per-quote afterward.
 */

import { MAX_TESTIMONIAL_QUOTE_LENGTH } from "@/lib/testimonials/types";

const EXPLICIT_SEPARATOR_LINE = /^\s*[-=]{3,}\s*$/;
const MIN_QUOTE_LENGTH = 10;

function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/**
 * Splits pasted text into candidate testimonial quotes. Prefers an explicit
 * separator line ("---" / "===") when present, falls back to blank-line
 * runs, and as a last resort (no blank lines at all, many short lines)
 * treats each non-empty line as its own testimonial.
 */
export function splitBulkPastedTestimonials(text: string): string[] {
  const normalized = normalizeLineEndings(text).trim();
  if (!normalized) return [];

  const lines = normalized.split("\n");
  const hasExplicitSeparator = lines.some((line) => EXPLICIT_SEPARATOR_LINE.test(line));

  let blocks: string[];
  if (hasExplicitSeparator) {
    // EXPLICIT_SEPARATOR_LINE anchors ^/$ to the whole string (no `m` flag),
    // so splitting the full multi-line text against it directly would never
    // match a separator that isn't the entire input. Group by line instead.
    blocks = [];
    let current: string[] = [];
    for (const line of lines) {
      if (EXPLICIT_SEPARATOR_LINE.test(line)) {
        blocks.push(current.join("\n"));
        current = [];
      } else {
        current.push(line);
      }
    }
    blocks.push(current.join("\n"));
  } else if (/\n\s*\n/.test(normalized)) {
    blocks = normalized.split(/\n\s*\n+/);
  } else {
    blocks = lines;
  }

  return blocks
    .map((block) => block.trim())
    .filter((block) => block.length >= MIN_QUOTE_LENGTH)
    .map((block) => block.slice(0, MAX_TESTIMONIAL_QUOTE_LENGTH));
}

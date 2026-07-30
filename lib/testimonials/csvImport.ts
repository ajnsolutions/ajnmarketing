/**
 * CSV import (Part 1, "future-ready interface") — a real, working parser,
 * not just a reserved shape. Pure, deterministic, no AI call. Flexible
 * column naming so a customer's export from any review tool works without
 * a rigid template.
 */

import { MAX_TESTIMONIAL_QUOTE_LENGTH, type RawTestimonialInput } from "@/lib/testimonials/types";

export type TestimonialCsvImportResult = {
  rows: RawTestimonialInput[];
  errors: string[];
};

const MIN_QUOTE_LENGTH = 10;
const MAX_CSV_ROWS = 500;

const COLUMN_ALIASES: Record<keyof RawTestimonialInput, string[]> = {
  quote: ["quote", "testimonial", "review", "text", "content", "comment"],
  authorName: ["author", "authorname", "name", "customer", "customername", "reviewer"],
  authorTitle: ["authortitle", "title", "company", "role", "position"],
  sourceUrl: ["sourceurl", "url", "link", "source"],
  rating: ["rating", "stars", "score"],
  occurredAt: ["date", "occurredat", "reviewdate", "createdat"],
};

function normalizeHeaderCell(cell: string): string {
  return cell.trim().toLowerCase().replace(/[\s_-]/g, "");
}

/** Minimal RFC4180-style parser: quoted fields may contain commas, newlines,
 * and escaped ("") double quotes. */
function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < csvText.length; i += 1) {
    const char = csvText[i]!;

    if (inQuotes) {
      if (char === '"') {
        if (csvText[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      pushField();
    } else if (char === "\n") {
      pushRow();
    } else if (char === "\r") {
      // ignore; \r\n handled by the following \n
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) pushRow();

  return rows.filter((r) => r.some((cell) => cell.trim().length > 0));
}

function buildColumnIndex(header: string[]): Partial<Record<keyof RawTestimonialInput, number>> {
  const normalized = header.map(normalizeHeaderCell);
  const index: Partial<Record<keyof RawTestimonialInput, number>> = {};

  for (const [field, aliases] of Object.entries(COLUMN_ALIASES) as [keyof RawTestimonialInput, string[]][]) {
    const matchIndex = normalized.findIndex((cell) => aliases.includes(cell));
    if (matchIndex !== -1) index[field] = matchIndex;
  }

  return index;
}

export function parseTestimonialsCsv(csvText: string): TestimonialCsvImportResult {
  const trimmed = csvText.trim();
  if (!trimmed) return { rows: [], errors: ["CSV file is empty."] };

  const allRows = parseCsvRows(trimmed);
  if (allRows.length === 0) return { rows: [], errors: ["CSV file is empty."] };

  const [header, ...dataRows] = allRows;
  const columnIndex = buildColumnIndex(header!);

  if (columnIndex.quote === undefined) {
    return {
      rows: [],
      errors: ['CSV must include a "quote" (or "testimonial"/"review"/"text") column.'],
    };
  }

  const rows: RawTestimonialInput[] = [];
  const errors: string[] = [];

  dataRows.slice(0, MAX_CSV_ROWS).forEach((cells, idx) => {
    const rowNumber = idx + 2; // 1-indexed + header row
    const quote = cells[columnIndex.quote!]?.trim() ?? "";

    if (quote.length < MIN_QUOTE_LENGTH) {
      errors.push(`Row ${rowNumber}: quote is missing or too short — skipped.`);
      return;
    }

    const ratingRaw = columnIndex.rating !== undefined ? cells[columnIndex.rating]?.trim() : undefined;
    const rating = ratingRaw ? Number.parseInt(ratingRaw, 10) : null;

    rows.push({
      quote: quote.slice(0, MAX_TESTIMONIAL_QUOTE_LENGTH),
      authorName: columnIndex.authorName !== undefined ? cells[columnIndex.authorName]?.trim() || null : null,
      authorTitle: columnIndex.authorTitle !== undefined ? cells[columnIndex.authorTitle]?.trim() || null : null,
      sourceUrl: columnIndex.sourceUrl !== undefined ? cells[columnIndex.sourceUrl]?.trim() || null : null,
      rating: rating && rating >= 1 && rating <= 5 ? rating : null,
      occurredAt: columnIndex.occurredAt !== undefined ? cells[columnIndex.occurredAt]?.trim() || null : null,
    });
  });

  if (dataRows.length > MAX_CSV_ROWS) {
    errors.push(`Only the first ${MAX_CSV_ROWS} rows were imported.`);
  }

  return { rows, errors };
}

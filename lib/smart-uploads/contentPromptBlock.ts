/**
 * Compact prompt block for Content Generator — reusable business knowledge only,
 * grouped by category. Mirrors the shape of
 * lib/customer-voice/copySuggestions.ts::formatCustomerVoiceForContentPrompt.
 */

import { KNOWLEDGE_CATEGORY_LABELS, type SmartUploadKnowledgeFactRecord } from "@/lib/smart-uploads/types";

const MAX_FACTS_PER_CATEGORY = 4;
const MAX_CATEGORIES = 8;

/** Compact prompt block for Content Generator — grounded facts only. */
export function formatSmartUploadKnowledgeForContentPrompt(
  facts: SmartUploadKnowledgeFactRecord[] | null | undefined,
): string | null {
  const active = (facts ?? []).filter((fact) => !fact.superseded_by);
  if (active.length === 0) return null;

  const byCategory = new Map<string, string[]>();
  for (const fact of active) {
    const list = byCategory.get(fact.category) ?? [];
    if (list.length < MAX_FACTS_PER_CATEGORY) list.push(fact.fact);
    byCategory.set(fact.category, list);
  }

  const lines = [...byCategory.entries()]
    .slice(0, MAX_CATEGORIES)
    .map(([category, facts]) => {
      const label = KNOWLEDGE_CATEGORY_LABELS[category as keyof typeof KNOWLEDGE_CATEGORY_LABELS] ?? category;
      return `${label}: ${facts.join("; ")}`;
    });

  if (lines.length === 0) return null;

  return [
    "BUSINESS KNOWLEDGE FROM UPLOADED DOCUMENTS (use naturally; never invent facts beyond these)",
    ...lines,
  ].join("\n");
}

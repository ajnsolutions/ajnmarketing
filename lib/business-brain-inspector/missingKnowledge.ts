/**
 * Missing knowledge (Part 4) — unifies Business Discovery's own
 * missingInformation list with the Business Knowledge Graph's
 * missingKnowledge gaps into one deduplicated, explained, correctable list.
 * Never invents a gap that isn't already flagged by one of those two
 * existing, real computations.
 */

import type { BusinessDiscoveryResult } from "@/lib/business-discovery/types";
import type { BusinessKnowledgeHealth } from "@/lib/business-knowledge-graph/knowledgeHealth";
import { BrainSections, type BrainCorrectionAction, type MissingKnowledgeItem } from "@/lib/business-brain-inspector/types";

const DISCOVERY_FIELD_CORRECTIONS: Record<string, BrainCorrectionAction> = {
  businessSummary: { label: "Complete Business Setup", href: "/dashboard/setup/business" },
  primaryServices: { label: "Add your services", href: "/dashboard/setup/business" },
  targetCustomers: { label: "Describe your ideal customers", href: "/dashboard/setup/business" },
  brandPersonality: { label: "Set your brand voice", href: "/dashboard/ai-profile" },
  uniqueStrengths: { label: "Add what sets you apart", href: "/dashboard/setup/business" },
  customerPerception: { label: "Connect Customer Voice", href: "/dashboard/customer-voice" },
  competitivePosition: { label: "Review Business Connections", href: "/dashboard/business-connections" },
  growthOpportunities: { label: "See your Growth Advisor", href: "/dashboard" },
};

const GAP_LABEL_CORRECTIONS: Record<string, BrainCorrectionAction> = {
  "Customer sentiment": { label: "Connect Customer Voice", href: "/dashboard/customer-voice" },
  "Website testimonials": { label: "Add testimonials", href: "/dashboard/testimonials" },
  "Search & market performance": { label: "Connect Search Console", href: "/dashboard/search-console" },
  "Uploaded documents": { label: "Upload a document", href: "/dashboard/smart-uploads" },
  "Business profile": { label: "Complete Business Setup", href: "/dashboard/setup/business" },
  "Stated goals": { label: "Set your goals", href: "/dashboard/setup/goals" },
  "Active opportunities": { label: "See your Growth Advisor", href: "/dashboard" },
};

const GAP_LABEL_SECTIONS: Record<string, MissingKnowledgeItem["section"]> = {
  "Customer sentiment": BrainSections.CUSTOMER_THEMES,
  "Website testimonials": BrainSections.CUSTOMER_THEMES,
  "Search & market performance": BrainSections.SEARCH_TRENDS,
  "Uploaded documents": BrainSections.PRODUCTS_SERVICES,
  "Business profile": BrainSections.BUSINESS_IDENTITY,
  "Stated goals": BrainSections.BUSINESS_GOALS,
  "Active opportunities": BrainSections.MARKETING_OPPORTUNITIES,
  "Conflicting signals": BrainSections.BUSINESS_IDENTITY,
};

export function buildMissingKnowledge(input: {
  businessDiscovery?: BusinessDiscoveryResult | null;
  businessKnowledgeHealth?: BusinessKnowledgeHealth | null;
}): MissingKnowledgeItem[] {
  const items: MissingKnowledgeItem[] = [];
  const seen = new Set<string>();

  const push = (item: MissingKnowledgeItem) => {
    const key = item.label.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    items.push(item);
  };

  for (const gap of input.businessDiscovery?.missingInformation ?? []) {
    push({
      id: `discovery_${gap.field}`,
      section: BrainSections.BUSINESS_IDENTITY,
      label: gap.field,
      detail: `${gap.reason} ${gap.suggestedNextAction}`.trim(),
      correction: DISCOVERY_FIELD_CORRECTIONS[gap.field] ?? { label: "Complete Business Setup", href: "/dashboard/setup/business" },
    });
  }

  for (const gap of input.businessKnowledgeHealth?.missingKnowledge ?? []) {
    push({
      id: `knowledge_health_${gap.label.toLowerCase().replace(/\s+/g, "_")}`,
      section: GAP_LABEL_SECTIONS[gap.label] ?? BrainSections.BUSINESS_IDENTITY,
      label: gap.label,
      detail: gap.detail,
      correction: GAP_LABEL_CORRECTIONS[gap.label] ?? null,
    });
  }

  return items;
}

import type { BusinessProfile } from "@/lib/business-profile";
import type { MarketingOpportunityDraft } from "@/lib/marketing-opportunities/types";
import { OpportunityCategories, OpportunitySeverities } from "@/lib/marketing-opportunities/types";

const REQUIRED_FIELDS: Array<{ key: keyof BusinessProfile; label: string }> = [
  { key: "website", label: "website" },
  { key: "phone", label: "phone number" },
  { key: "primary_services", label: "primary services" },
  { key: "city", label: "city" },
  { key: "state", label: "state" },
];

function isBlank(value: unknown): boolean {
  return value == null || String(value).trim() === "";
}

/** Fires when any of a small set of fields the AI/content pipeline relies on are empty. */
export function detectMissingBusinessInfo(businessProfile: BusinessProfile): MarketingOpportunityDraft[] {
  const missing = REQUIRED_FIELDS.filter((field) => isBlank(businessProfile[field.key])).map(
    (field) => field.label
  );

  if (missing.length === 0) return [];

  return [
    {
      category: OpportunityCategories.MISSING_BUSINESS_INFO,
      severity: missing.length >= 3 ? OpportunitySeverities.HIGH : OpportunitySeverities.MEDIUM,
      confidence: 90,
      title: "Business profile is missing key information",
      description: `The following fields are not filled in: ${missing.join(", ")}. A complete profile improves AI-generated content accuracy and local search relevance.`,
      evidence: { missingFields: missing },
      recommendedAction: `Complete the business profile: add ${missing.join(", ")}.`,
      expiresAt: null,
      dedupeKey: "current",
    },
  ];
}

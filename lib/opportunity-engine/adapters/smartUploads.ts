/**
 * Smart Uploads adapter — reuses the existing website-content-gap detector
 * (lib/smart-uploads/crossover.ts) rather than re-implementing gap
 * detection, and surfaces FAQ-tagged facts as a distinct opportunity type.
 */

import { findWebsiteContentGaps } from "@/lib/smart-uploads/crossover";
import { KnowledgeCategories, type SmartUploadDocumentRecord, type SmartUploadKnowledgeFactRecord } from "@/lib/smart-uploads/types";
import { OpportunityTypes, type OpportunityCandidateInput } from "@/lib/opportunity-engine/types";

const SOURCE_PROVIDER_ID = "smart_uploads";
const SOURCE_LABEL = "Smart Uploads";

export function smartUploadsOpportunityCandidates(input: {
  smartUploadFacts?: SmartUploadKnowledgeFactRecord[] | null;
  smartUploadDocuments?: SmartUploadDocumentRecord[] | null;
  websiteServices?: string[] | null;
}): OpportunityCandidateInput[] {
  const facts = (input.smartUploadFacts ?? []).filter((fact) => !fact.superseded_by);
  if (facts.length === 0) return [];

  const candidates: OpportunityCandidateInput[] = [];

  const websiteServices = input.websiteServices ?? [];
  if (websiteServices.length > 0) {
    const documentFileNameById = new Map((input.smartUploadDocuments ?? []).map((doc) => [doc.id, doc.file_name]));
    const [gap] = findWebsiteContentGaps(facts, documentFileNameById, websiteServices);
    if (gap) {
      candidates.push({
        sourceProviderId: SOURCE_PROVIDER_ID,
        sourceLabel: SOURCE_LABEL,
        type: OpportunityTypes.CONTENT_GAP,
        topic: gap.fact.fact,
        statement: `${gap.documentFileName} highlights "${gap.fact.fact}" but your website has very little content on it.`,
        whyNow: "This gap exists in your own uploaded materials right now, not a guess about what might matter.",
        expectedOutcome: "Adding website content on this topic gives search engines and customers something to actually find.",
        confidence: gap.fact.confidence,
        businessImpact: "medium",
        urgency: "low",
        evidenceSummary: `"${gap.fact.fact}" (from ${gap.documentFileName}) is barely represented on your website.`,
        occurredAt: gap.fact.created_at,
      });
    }
  }

  const faqFact = facts.find((fact) => fact.category === KnowledgeCategories.FAQ);
  if (faqFact) {
    candidates.push({
      sourceProviderId: SOURCE_PROVIDER_ID,
      sourceLabel: SOURCE_LABEL,
      type: OpportunityTypes.FAQ,
      topic: faqFact.fact,
      statement: `Your own materials answer a question customers ask: "${faqFact.fact}."`,
      whyNow: "This answer already exists in your uploaded materials — it just isn't public yet.",
      expectedOutcome: "Publishing it as an FAQ answers the question before a customer has to ask, and can attract search traffic on its own.",
      confidence: faqFact.confidence,
      businessImpact: "medium",
      urgency: "low",
      evidenceSummary: faqFact.fact,
      occurredAt: faqFact.created_at,
    });
  }

  return candidates;
}

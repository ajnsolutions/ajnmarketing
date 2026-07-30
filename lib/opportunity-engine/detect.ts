/**
 * Detection (Part 1) — gathers opportunity candidates from every provider
 * adapter. Adding a future provider (Part 9) is exactly: write one adapter
 * producing OpportunityCandidateInput[], and add it to this list. Nothing
 * else in the engine (scoring, dedup, reconciliation, persistence,
 * consumers) needs to change.
 */

import type { BusinessDiscoveryResult } from "@/lib/business-discovery/types";
import type { CustomerVoiceIntelligence } from "@/lib/customer-voice/types";
import type { ExternalIntelligence } from "@/lib/external-intelligence/types";
import type { SmartUploadDocumentRecord, SmartUploadKnowledgeFactRecord } from "@/lib/smart-uploads/types";
import type { BusinessReasoningResult } from "@/lib/business-knowledge-graph/reasoning";
import type { BusinessPattern } from "@/lib/business-learning-engine/types";
import { externalIntelligenceOpportunityCandidates } from "@/lib/opportunity-engine/adapters/externalIntelligence";
import { customerVoiceOpportunityCandidates } from "@/lib/opportunity-engine/adapters/customerVoice";
import { smartUploadsOpportunityCandidates } from "@/lib/opportunity-engine/adapters/smartUploads";
import { businessKnowledgeGraphOpportunityCandidates } from "@/lib/opportunity-engine/adapters/businessKnowledgeGraph";
import { businessLearningEngineOpportunityCandidates } from "@/lib/opportunity-engine/adapters/businessLearningEngine";
import type { OpportunityCandidateInput } from "@/lib/opportunity-engine/types";

export type OpportunityDetectionInput = {
  businessDiscovery?: BusinessDiscoveryResult | null;
  customerVoice?: CustomerVoiceIntelligence | null;
  externalIntelligence?: ExternalIntelligence | null;
  smartUploadFacts?: SmartUploadKnowledgeFactRecord[] | null;
  smartUploadDocuments?: SmartUploadDocumentRecord[] | null;
  businessReasoning?: BusinessReasoningResult | null;
  learningPatterns?: BusinessPattern[] | null;
};

export function detectOpportunityCandidates(
  input: OpportunityDetectionInput,
): OpportunityCandidateInput[] {
  return [
    ...externalIntelligenceOpportunityCandidates(input.externalIntelligence),
    ...customerVoiceOpportunityCandidates(input.customerVoice),
    ...smartUploadsOpportunityCandidates({
      smartUploadFacts: input.smartUploadFacts,
      smartUploadDocuments: input.smartUploadDocuments,
      websiteServices: input.businessDiscovery?.primaryServices?.value,
    }),
    ...businessKnowledgeGraphOpportunityCandidates({ businessReasoning: input.businessReasoning }),
    ...businessLearningEngineOpportunityCandidates(input.learningPatterns),
  ];
}

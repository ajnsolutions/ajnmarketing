/**
 * Customer Voice adapter — covers both Google Reviews and Website
 * Testimonials automatically, since both already flow into one
 * CustomerVoiceIntelligence package (see docs/project-magic/CUSTOMER_VOICE.md,
 * docs/project-magic/WEBSITE_TESTIMONIALS.md). Produces reputation,
 * review-request, and service-spotlight candidates from real themes only —
 * never invents a theme with too little evidence to trust.
 */

import { RecommendedActionTypes } from "@/lib/marketing-decisions/types";
import type { CustomerVoiceIntelligence, CustomerVoiceTheme } from "@/lib/customer-voice/types";
import { VoiceMaturityLabels } from "@/lib/customer-voice/types";
import { OpportunityTypes, type OpportunityCandidateInput } from "@/lib/opportunity-engine/types";

const SOURCE_PROVIDER_ID = "customer_voice";
const SOURCE_LABEL = "Customer Voice";

const MIN_EVIDENCE_FOR_THEME = 2;

function themeCandidate(
  theme: CustomerVoiceTheme,
  type: OpportunityCandidateInput["type"],
  whyNow: string,
  expectedOutcome: string,
  relatedActionType?: string,
): OpportunityCandidateInput {
  return {
    sourceProviderId: SOURCE_PROVIDER_ID,
    sourceLabel: SOURCE_LABEL,
    type,
    topic: theme.label,
    statement: `Customers consistently mention "${theme.label}."`,
    whyNow,
    expectedOutcome,
    confidence: theme.confidence,
    businessImpact: theme.businessImpact,
    urgency: theme.sentiment === "negative" ? "high" : "medium",
    evidenceSummary: `${theme.evidenceCount} customer review${theme.evidenceCount === 1 ? "" : "s"} mention "${theme.label}."`,
    occurredAt: theme.lastUpdated,
    relatedActionType,
  };
}

export function customerVoiceOpportunityCandidates(
  customerVoice: CustomerVoiceIntelligence | null | undefined,
): OpportunityCandidateInput[] {
  if (!customerVoice || customerVoice.emptyState === "no_evidence") return [];

  const candidates: OpportunityCandidateInput[] = [];

  const meaningfulConcern = customerVoice.concerns.find(
    (theme) => theme.evidenceCount >= MIN_EVIDENCE_FOR_THEME && theme.businessImpact === "high",
  );
  if (meaningfulConcern) {
    candidates.push(
      themeCandidate(
        meaningfulConcern,
        OpportunityTypes.REPUTATION,
        "A high-impact customer concern has real, recurring evidence behind it.",
        "Addressing this directly (in service delivery, and in how you talk about it publicly) protects reputation before it affects more customers.",
      ),
    );
  }

  const isEarlyVoiceMaturity =
    customerVoice.score.maturityLabel === VoiceMaturityLabels.CONTINUING_TO_LEARN ||
    customerVoice.score.maturityLabel === VoiceMaturityLabels.LIMITED;
  if (isEarlyVoiceMaturity) {
    candidates.push({
      sourceProviderId: SOURCE_PROVIDER_ID,
      sourceLabel: SOURCE_LABEL,
      type: OpportunityTypes.REVIEW_REQUEST,
      topic: "review volume",
      statement: "Customer feedback volume is still limited.",
      whyNow: "More reviews build a stronger, more trustworthy public record faster the sooner you start.",
      expectedOutcome: "A steady request habit typically grows review volume and gives future customers more to go on.",
      confidence: "medium",
      businessImpact: "medium",
      urgency: "medium",
      evidenceSummary: `Only ${customerVoice.evidenceCount} review signal${customerVoice.evidenceCount === 1 ? "" : "s"} so far.`,
      occurredAt: customerVoice.lastUpdated,
      relatedActionType: RecommendedActionTypes.REQUEST_REVIEWS,
    });
  }

  const topService = customerVoice.frequentlyMentionedServices.find(
    (theme) => theme.evidenceCount >= MIN_EVIDENCE_FOR_THEME && theme.confidence !== "low",
  );
  if (topService) {
    candidates.push(
      themeCandidate(
        topService,
        OpportunityTypes.SERVICE_SPOTLIGHT,
        `Customers already ask about "${topService.label}" often.`,
        "Spotlighting a service customers already bring up on their own tends to convert better than a cold pitch.",
      ),
    );
  }

  return candidates;
}

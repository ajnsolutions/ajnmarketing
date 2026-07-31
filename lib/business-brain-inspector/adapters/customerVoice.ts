/**
 * Customer Voice adapter — Customer Themes. Already merges Google Reviews
 * and Website Testimonials into one CustomerVoiceIntelligence package (see
 * docs/project-magic/CUSTOMER_VOICE.md), so this section automatically
 * reflects both once either provider is connected — no branching required
 * here for the second provider (that's exactly Part 9's ask, already true
 * by construction).
 */

import type { CustomerVoiceIntelligence, CustomerVoiceTheme } from "@/lib/customer-voice/types";
import { fromConfidenceLevel } from "@/lib/business-brain-inspector/confidence";
import { BrainSections, type KnowledgeCard } from "@/lib/business-brain-inspector/types";

const MIN_EVIDENCE_FOR_CARD = 2;

function themeCard(theme: CustomerVoiceTheme, kind: string, contributingProviders: string[]): KnowledgeCard | null {
  if (theme.evidenceCount < MIN_EVIDENCE_FOR_CARD) return null;

  return {
    id: `customer_voice_${theme.key}`,
    section: BrainSections.CUSTOMER_THEMES,
    title: theme.label,
    statement: `Customers consistently ${kind} "${theme.label}."`,
    confidence: fromConfidenceLevel(theme.confidence),
    confidenceReason: `Mentioned in ${theme.evidenceCount} piece${theme.evidenceCount === 1 ? "" : "s"} of customer feedback (${Math.round(theme.percentageOfReviews)}% of reviews covered).`,
    evidenceCount: theme.evidenceCount,
    evidence: contributingProviders.map((providerId) => ({
      sourceProviderId: providerId,
      sourceLabel: providerId === "website_testimonials" ? "Website Testimonials" : "Google Reviews",
      summary: `Contributed evidence toward "${theme.label}."`,
    })),
    correction: { label: "Open Customer Voice", href: "/dashboard/customer-voice" },
  };
}

export function customerVoiceKnowledgeCards(
  customerVoice: CustomerVoiceIntelligence | null | undefined,
): KnowledgeCard[] {
  if (!customerVoice || customerVoice.emptyState === "no_evidence") return [];

  const providers = customerVoice.contributingProviders;
  const cards: Array<KnowledgeCard | null> = [
    ...customerVoice.strengths.map((theme) => themeCard(theme, "mention as a strength", providers)),
    ...customerVoice.frequentlyMentionedServices.map((theme) => themeCard(theme, "ask about", providers)),
    ...customerVoice.concerns.map((theme) => themeCard(theme, "raise as a concern about", providers)),
  ];

  return cards.filter((card): card is KnowledgeCard => card !== null).slice(0, 8);
}

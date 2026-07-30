/**
 * Content Generator pre-fill (Project Magic Phase 2, Part 7) — derives a
 * single, evidence-grounded starting point (content type, goal, topic) from
 * signals the Business Brain already has, so the customer spends less time
 * configuring a prompt from a blank slate. Purely a suggestion the customer
 * can accept or ignore with one click — never auto-submits, never invents a
 * topic that isn't backed by real Customer Voice evidence.
 */

import type { ContentTypeOption } from "@/lib/content-generator/types";
import type { CustomerVoiceIntelligence, CustomerVoiceTheme } from "@/lib/customer-voice/types";

export type ContentGeneratorSuggestion = {
  contentType: ContentTypeOption;
  goal: string;
  topic: string;
  why: string;
};

function meaningfulTheme(theme: CustomerVoiceTheme | undefined): CustomerVoiceTheme | null {
  if (!theme) return null;
  if (theme.evidenceCount < 2 || theme.confidence === "low") return null;
  return theme;
}

/**
 * Prefers a customer-praised strength (build trust with what customers
 * already say), then a frequently-mentioned service (promote what customers
 * already ask about). Returns null rather than guessing when neither exists
 * yet — an honest "nothing to suggest yet" beats a fabricated one.
 */
export function buildContentGeneratorSuggestion(input: {
  customerVoice?: CustomerVoiceIntelligence | null;
}): ContentGeneratorSuggestion | null {
  const topStrength = meaningfulTheme(input.customerVoice?.strengths?.[0]);
  if (topStrength) {
    return {
      contentType: "Google Business Profile Post",
      goal: "Build trust",
      topic: topStrength.label,
      why: `Customers consistently mention "${topStrength.label}" — content reinforcing it plays to a strength you already have evidence for.`,
    };
  }

  const topService = meaningfulTheme(input.customerVoice?.frequentlyMentionedServices?.[0]);
  if (topService) {
    return {
      contentType: "Promotion",
      goal: "Promote a service",
      topic: topService.label,
      why: `"${topService.label}" comes up often in what customers say — a good candidate to promote next.`,
    };
  }

  return null;
}

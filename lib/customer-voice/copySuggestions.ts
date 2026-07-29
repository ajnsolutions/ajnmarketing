/**
 * Marketing Copy Suggestions — concise, evidence-backed only.
 * Never fabricates claims outside Customer Voice themes.
 */

import { insightSentenceForTheme } from "@/lib/customer-voice/possibleActions";
import type { CustomerVoiceIntelligence, CustomerVoiceTheme } from "@/lib/customer-voice/types";
import { ThemeKinds } from "@/lib/customer-voice/types";

export type MarketingCopySurface =
  | "website_headline"
  | "google_business_description"
  | "social_post_opener"
  | "email_subject"
  | "about_page_wording";

export type MarketingCopySuggestion = {
  surface: MarketingCopySurface;
  label: string;
  suggestion: string;
  /** Theme keys that support this suggestion — empty means not emitted. */
  supportingThemeKeys: string[];
  whyBelievable: string;
};

const SURFACE_LABELS: Record<MarketingCopySurface, string> = {
  website_headline: "Website headline",
  google_business_description: "Google Business description",
  social_post_opener: "Social post opener",
  email_subject: "Email subject",
  about_page_wording: "About page wording",
};

function supportedStrengths(intelligence: CustomerVoiceIntelligence): CustomerVoiceTheme[] {
  return [...intelligence.strengths, ...intelligence.frequentlyMentionedServices]
    .filter((theme) => theme.evidenceCount >= 2 && theme.confidence !== "low")
    .slice(0, 4);
}

function languageSnippets(intelligence: CustomerVoiceIntelligence): string[] {
  return intelligence.commonCustomerLanguage
    .filter((theme) => theme.evidenceCount >= 1)
    .flatMap((theme) => theme.languageVariants)
    .map((v) => v.trim())
    .filter((v) => v.length >= 4 && v.length <= 80)
    .slice(0, 6);
}

/**
 * Build copy suggestions only from recurring Customer Voice themes.
 * Returns [] when evidence is too thin — never invents praise.
 */
export function buildMarketingCopySuggestions(
  intelligence: CustomerVoiceIntelligence,
): MarketingCopySuggestion[] {
  if (intelligence.emptyState === "no_evidence") return [];

  const strengths = supportedStrengths(intelligence);
  if (strengths.length === 0 && intelligence.emptyState === "insufficient_evidence") {
    return [];
  }
  if (strengths.length === 0) return [];

  const primary = strengths[0]!;
  const secondary = strengths[1] ?? null;
  const phrases = languageSnippets(intelligence);
  const phrase = phrases[0] ?? null;
  const keys = strengths.map((s) => s.key);

  const suggestions: MarketingCopySuggestion[] = [
    {
      surface: "website_headline",
      label: SURFACE_LABELS.website_headline,
      suggestion: secondary
        ? `${primary.label} — and ${secondary.label.toLowerCase()} customers notice.`
        : `Known for ${primary.label.toLowerCase()}.`,
      supportingThemeKeys: keys.slice(0, 2),
      whyBelievable: `${primary.evidenceCount} supporting mentions · ${primary.confidence} confidence`,
    },
    {
      surface: "google_business_description",
      label: SURFACE_LABELS.google_business_description,
      suggestion: phrase
        ? `Customers often mention ${primary.label.toLowerCase()}. One put it this way: “${phrase}”.`
        : `Customers consistently mention ${primary.label.toLowerCase()} in their feedback.`,
      supportingThemeKeys: [primary.key],
      whyBelievable: insightSentenceForTheme(primary),
    },
    {
      surface: "social_post_opener",
      label: SURFACE_LABELS.social_post_opener,
      suggestion: phrase
        ? `“${phrase}” — that's language from your customers, not a slogan we invented.`
        : `Your customers keep coming back to one theme: ${primary.label.toLowerCase()}.`,
      supportingThemeKeys: [primary.key],
      whyBelievable: `${primary.evidenceCount} reviews support this theme`,
    },
    {
      surface: "email_subject",
      label: SURFACE_LABELS.email_subject,
      suggestion: `What customers notice: ${primary.label.toLowerCase()}`,
      supportingThemeKeys: [primary.key],
      whyBelievable: `Grounded in ${primary.percentageOfReviews}% of reviewed feedback`,
    },
    {
      surface: "about_page_wording",
      label: SURFACE_LABELS.about_page_wording,
      suggestion: secondary
        ? `We're known for ${primary.label.toLowerCase()} and ${secondary.label.toLowerCase()} — in our customers' own words.`
        : `We're known for ${primary.label.toLowerCase()} — reflected in recurring customer feedback.`,
      supportingThemeKeys: keys.slice(0, 2),
      whyBelievable: "Only uses themes with recurring support",
    },
  ];

  return suggestions;
}

/** Compact prompt block for Content Generator — phrases + strengths only. */
export function formatCustomerVoiceForContentPrompt(
  intelligence: CustomerVoiceIntelligence | null | undefined,
): string | null {
  if (!intelligence || intelligence.emptyState === "no_evidence") return null;
  const strengths = supportedStrengths(intelligence).map((t) => t.label);
  const phrases = languageSnippets(intelligence);
  const differentiators = intelligence.strengths
    .filter((t) => t.kind === ThemeKinds.DIFFERENTIATOR && t.evidenceCount >= 2)
    .map((t) => t.label);

  if (strengths.length === 0 && phrases.length === 0) {
    return "Customer Voice: still establishing a baseline — do not invent customer praise.";
  }

  return [
    "CUSTOMER VOICE (use naturally; never keyword-stuff; never invent claims)",
    strengths.length ? `Recurring strengths: ${strengths.join("; ")}` : null,
    differentiators.length ? `Differentiators: ${differentiators.join("; ")}` : null,
    phrases.length ? `Customer language (optional, authentic use only): ${phrases.slice(0, 4).join(" | ")}` : null,
    `Maturity: ${intelligence.score.maturityCopy}`,
  ]
    .filter(Boolean)
    .join("\n");
}

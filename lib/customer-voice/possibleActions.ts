/**
 * Possible Actions — suggestions only.
 * Never prioritized here; Recommendation Engine / Marketing Director decides order.
 */

import type { CustomerVoiceTheme, ThemeKind } from "@/lib/customer-voice/types";
import { ThemeKinds } from "@/lib/customer-voice/types";

export type PossibleAction = {
  id: string;
  label: string;
  href: string | null;
};

const BY_KIND: Record<ThemeKind, PossibleAction[]> = {
  [ThemeKinds.STRENGTH]: [
    { id: "homepage", label: "Highlight on homepage", href: "/dashboard/website-analysis" },
    { id: "gbp", label: "Add to Google Business profile", href: "/dashboard/google-business-profile" },
    { id: "social", label: "Use in social content", href: "/dashboard/content/generator" },
    { id: "email", label: "Mention in email campaigns", href: "/dashboard/content/generator" },
  ],
  [ThemeKinds.DIFFERENTIATOR]: [
    { id: "homepage", label: "Highlight on homepage", href: "/dashboard/website-analysis" },
    { id: "gbp", label: "Feature on Google Business profile", href: "/dashboard/google-business-profile" },
    { id: "about", label: "Reflect in About page wording", href: "/dashboard/website-analysis" },
    { id: "social", label: "Use in social content", href: "/dashboard/content/generator" },
  ],
  [ThemeKinds.CONCERN]: [
    { id: "reply", label: "Review related customer feedback", href: "/dashboard/reviews" },
    { id: "gbp", label: "Clarify on Google Business profile", href: "/dashboard/google-business-profile" },
    { id: "website", label: "Address on website", href: "/dashboard/website-analysis" },
    { id: "content", label: "Create clarifying content", href: "/dashboard/content/generator" },
  ],
  [ThemeKinds.OPPORTUNITY]: [
    { id: "content", label: "Create content around this opportunity", href: "/dashboard/content/generator" },
    { id: "gbp", label: "Surface on Google Business profile", href: "/dashboard/google-business-profile" },
    { id: "plan", label: "Consider in marketing plan", href: "/dashboard/marketing-plan" },
  ],
  [ThemeKinds.REQUEST]: [
    { id: "content", label: "Answer the request in content", href: "/dashboard/content/generator" },
    { id: "website", label: "Address on website or FAQ", href: "/dashboard/website-analysis" },
    { id: "gbp", label: "Clarify on Google Business profile", href: "/dashboard/google-business-profile" },
  ],
  [ThemeKinds.LANGUAGE]: [
    { id: "copy", label: "Reuse this language in marketing copy", href: "/dashboard/content/generator" },
    { id: "gbp", label: "Reflect in Google Business description", href: "/dashboard/google-business-profile" },
    { id: "brand", label: "Align with brand voice", href: "/dashboard/brand-voice" },
  ],
  [ThemeKinds.SERVICE]: [
    { id: "gbp", label: "Feature this service on Google Business", href: "/dashboard/google-business-profile" },
    { id: "content", label: "Create service-focused content", href: "/dashboard/content/generator" },
    { id: "website", label: "Highlight on website", href: "/dashboard/website-analysis" },
  ],
  [ThemeKinds.EMPLOYEE]: [
    { id: "social", label: "Celebrate in social content (with care)", href: "/dashboard/content/generator" },
    { id: "gbp", label: "Consider team highlights on Google Business", href: "/dashboard/google-business-profile" },
  ],
};

export function possibleActionsForTheme(theme: CustomerVoiceTheme): PossibleAction[] {
  return BY_KIND[theme.kind] ?? BY_KIND[ThemeKinds.STRENGTH];
}

export function insightSentenceForTheme(theme: CustomerVoiceTheme): string {
  switch (theme.kind) {
    case ThemeKinds.STRENGTH:
    case ThemeKinds.DIFFERENTIATOR:
      return `Customers consistently praise ${theme.label.toLowerCase()}.`;
    case ThemeKinds.CONCERN:
      return `Customers sometimes raise concerns about ${theme.label.toLowerCase()}.`;
    case ThemeKinds.OPPORTUNITY:
      return `There's an opportunity around ${theme.label.toLowerCase()}.`;
    case ThemeKinds.REQUEST:
      return `Customers often ask about ${theme.label.toLowerCase()}.`;
    case ThemeKinds.SERVICE:
      return `Customers mention ${theme.label} often.`;
    case ThemeKinds.EMPLOYEE:
      return `Customers mention ${theme.label} by name.`;
    case ThemeKinds.LANGUAGE:
      return `Customers naturally say things like “${theme.label}”.`;
    default:
      return theme.label;
  }
}

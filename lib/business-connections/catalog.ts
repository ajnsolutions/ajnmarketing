/**
 * Connection catalog — organized by business purpose, not vendor.
 * Seeds live Google Business Profile + website understanding and placeholders.
 */

import {
  ConnectionCapabilities,
  ConnectionCategories,
  ConnectionProviderIds,
  type ConnectionCatalogEntry,
} from "@/lib/business-connections/types";

export const CONNECTION_CATALOG: readonly ConnectionCatalogEntry[] = [
  // —— Customer Feedback ——
  {
    id: "conn_google_business_profile",
    category: ConnectionCategories.CUSTOMER_FEEDBACK,
    providerId: ConnectionProviderIds.GOOGLE_BUSINESS_PROFILE,
    displayName: "Google Business Profile",
    whatYouLearn:
      "How customers talk about you locally — reviews, questions, and what people notice first.",
    capabilities: [
      ConnectionCapabilities.REVIEWS,
      ConnectionCapabilities.LOCAL_POSTS,
      ConnectionCapabilities.PROFILE_INSIGHTS,
    ],
    businessBrainContribution: {
      summary: "Customer Voice and local presence signals for Growth Advisor.",
      intelligenceSources: ["customer_voice", "business_discovery", "external_intelligence"],
    },
    priority: 1,
    implementation: "live",
    connectHref: "/dashboard/google-business-profile/connect",
    manageHref: "/dashboard/google-business-profile",
  },

  // —— Website & Search ——
  {
    id: "conn_website_analysis",
    category: ConnectionCategories.WEBSITE_AND_SEARCH,
    providerId: ConnectionProviderIds.WEBSITE_ANALYSIS,
    displayName: "Website understanding",
    whatYouLearn:
      "What your website already says about your services, tone, and strengths — so recommendations match your brand.",
    capabilities: [ConnectionCapabilities.WEBSITE_CONTENT],
    businessBrainContribution: {
      summary: "Business Discovery and content understanding from your site.",
      intelligenceSources: ["business_discovery", "website_analysis"],
    },
    priority: 1,
    implementation: "live",
    connectHref: "/dashboard/website-analysis",
    manageHref: "/dashboard/website-analysis",
  },
  {
    id: "conn_search_console",
    category: ConnectionCategories.WEBSITE_AND_SEARCH,
    providerId: ConnectionProviderIds.GOOGLE_SEARCH_CONSOLE,
    displayName: "Search performance",
    whatYouLearn:
      "Which searches bring people to you — so we can focus on the phrases that actually matter.",
    capabilities: [ConnectionCapabilities.SEARCH_PERFORMANCE],
    businessBrainContribution: {
      summary: "Search demand signals for External Intelligence and weekly plans.",
      intelligenceSources: ["external_intelligence"],
    },
    priority: 2,
    implementation: "placeholder",
    connectHref: null,
    manageHref: null,
  },
  {
    id: "conn_website_analytics",
    category: ConnectionCategories.WEBSITE_AND_SEARCH,
    providerId: ConnectionProviderIds.GOOGLE_ANALYTICS,
    displayName: "Website analytics",
    whatYouLearn:
      "Which pages people visit and where they leave — so we improve the journeys that convert.",
    capabilities: [ConnectionCapabilities.WEBSITE_ANALYTICS],
    businessBrainContribution: {
      summary: "Engagement patterns that refine recommendation timing and focus.",
      intelligenceSources: ["external_intelligence", "analytics"],
    },
    priority: 3,
    implementation: "placeholder",
    connectHref: null,
    manageHref: null,
  },

  // —— Advertising ——
  {
    id: "conn_meta_ads",
    category: ConnectionCategories.ADVERTISING,
    providerId: ConnectionProviderIds.META_ADS,
    displayName: "Meta advertising",
    whatYouLearn:
      "Which paid messages resonate — so organic recommendations stay aligned with what’s already working.",
    capabilities: [ConnectionCapabilities.AD_PERFORMANCE],
    businessBrainContribution: {
      summary: "Paid creative and audience patterns (aggregate signals only).",
      intelligenceSources: ["external_intelligence"],
    },
    priority: 1,
    implementation: "placeholder",
    connectHref: null,
    manageHref: null,
  },
  {
    id: "conn_google_ads",
    category: ConnectionCategories.ADVERTISING,
    providerId: ConnectionProviderIds.GOOGLE_ADS,
    displayName: "Google advertising",
    whatYouLearn:
      "Which search ads drive interest — so we reinforce the offers that already attract buyers.",
    capabilities: [ConnectionCapabilities.AD_PERFORMANCE],
    businessBrainContribution: {
      summary: "Paid search intent patterns for Growth Advisor context.",
      intelligenceSources: ["external_intelligence"],
    },
    priority: 2,
    implementation: "placeholder",
    connectHref: null,
    manageHref: null,
  },

  // —— Social Media ——
  {
    id: "conn_facebook_pages",
    category: ConnectionCategories.SOCIAL_MEDIA,
    providerId: ConnectionProviderIds.FACEBOOK_PAGES,
    displayName: "Facebook Page",
    whatYouLearn:
      "How your community engages publicly — so posts and offers feel timely, not generic.",
    capabilities: [ConnectionCapabilities.SOCIAL_ENGAGEMENT],
    businessBrainContribution: {
      summary: "Public engagement themes for content and timing.",
      intelligenceSources: ["customer_voice", "external_intelligence"],
    },
    priority: 1,
    implementation: "placeholder",
    connectHref: null,
    manageHref: null,
  },
  {
    id: "conn_instagram_business",
    category: ConnectionCategories.SOCIAL_MEDIA,
    providerId: ConnectionProviderIds.INSTAGRAM_BUSINESS,
    displayName: "Instagram",
    whatYouLearn:
      "Which visuals and stories get attention — so we suggest content that fits how you show up.",
    capabilities: [ConnectionCapabilities.SOCIAL_ENGAGEMENT],
    businessBrainContribution: {
      summary: "Visual and engagement themes for social recommendations.",
      intelligenceSources: ["external_intelligence"],
    },
    priority: 2,
    implementation: "placeholder",
    connectHref: null,
    manageHref: null,
  },
  {
    id: "conn_linkedin_pages",
    category: ConnectionCategories.SOCIAL_MEDIA,
    providerId: ConnectionProviderIds.LINKEDIN_PAGES,
    displayName: "LinkedIn",
    whatYouLearn:
      "How professional audiences respond — helpful when B2B or hiring visibility matters.",
    capabilities: [ConnectionCapabilities.SOCIAL_ENGAGEMENT],
    businessBrainContribution: {
      summary: "Professional audience signals when relevant to goals.",
      intelligenceSources: ["external_intelligence"],
    },
    priority: 3,
    implementation: "placeholder",
    connectHref: null,
    manageHref: null,
  },

  // —— Communications ——
  {
    id: "conn_call_tracking",
    category: ConnectionCategories.COMMUNICATIONS,
    providerId: ConnectionProviderIds.CALL_TRACKING,
    displayName: "Call tracking",
    whatYouLearn:
      "When people call and which campaigns prompt them — so we prioritize what drives real conversations.",
    capabilities: [ConnectionCapabilities.CALL_SIGNALS],
    businessBrainContribution: {
      summary: "Inbound call patterns for Customer Voice and success metrics.",
      intelligenceSources: ["customer_voice"],
    },
    priority: 1,
    implementation: "placeholder",
    connectHref: null,
    manageHref: null,
  },
  {
    id: "conn_email_inbox",
    category: ConnectionCategories.COMMUNICATIONS,
    providerId: ConnectionProviderIds.EMAIL_INBOX,
    displayName: "Customer email",
    whatYouLearn:
      "Themes in customer questions and replies — so marketing language stays authentic.",
    capabilities: [ConnectionCapabilities.MESSAGE_SIGNALS],
    businessBrainContribution: {
      summary: "Message themes that enrich Customer Voice.",
      intelligenceSources: ["customer_voice"],
    },
    priority: 2,
    implementation: "placeholder",
    connectHref: null,
    manageHref: null,
  },

  // —— Scheduling & Commerce ——
  {
    id: "conn_booking_system",
    category: ConnectionCategories.SCHEDULING_AND_COMMERCE,
    providerId: ConnectionProviderIds.BOOKING_SYSTEM,
    displayName: "Booking & scheduling",
    whatYouLearn:
      "When demand rises and which services book first — so weekly plans match real capacity.",
    capabilities: [ConnectionCapabilities.BOOKING_PATTERNS],
    businessBrainContribution: {
      summary: "Demand and seasonality patterns from appointments.",
      intelligenceSources: ["external_intelligence", "goals"],
    },
    priority: 1,
    implementation: "placeholder",
    connectHref: null,
    manageHref: null,
  },

  // —— CRM & Sales ——
  {
    id: "conn_crm",
    category: ConnectionCategories.CRM_AND_SALES,
    providerId: ConnectionProviderIds.CRM,
    displayName: "CRM & pipeline",
    whatYouLearn:
      "Where leads come from and stall — so recommendations support the stages that need help.",
    capabilities: [ConnectionCapabilities.PIPELINE_SIGNALS],
    businessBrainContribution: {
      summary: "Lead-source and pipeline pattern intelligence (aggregate only).",
      intelligenceSources: ["goals", "customer_voice"],
    },
    priority: 1,
    implementation: "placeholder",
    connectHref: null,
    manageHref: null,
  },

  // —— Documents ——
  {
    id: "conn_smart_uploads",
    category: ConnectionCategories.DOCUMENTS,
    providerId: ConnectionProviderIds.SMART_UPLOADS,
    displayName: "Business documents",
    whatYouLearn:
      "Details from brochures, menus, or service sheets — so we stop guessing what’s on paper.",
    capabilities: [ConnectionCapabilities.DOCUMENT_KNOWLEDGE],
    businessBrainContribution: {
      summary: "Owner-provided document knowledge for Business Discovery.",
      intelligenceSources: ["business_discovery", "smart_uploads"],
    },
    priority: 1,
    implementation: "placeholder",
    connectHref: null,
    manageHref: null,
  },
] as const;

export function getCatalogEntry(id: string): ConnectionCatalogEntry | null {
  return CONNECTION_CATALOG.find((entry) => entry.id === id) ?? null;
}

export function catalogByCategory(): Map<
  ConnectionCatalogEntry["category"],
  ConnectionCatalogEntry[]
> {
  const map = new Map<ConnectionCatalogEntry["category"], ConnectionCatalogEntry[]>();
  for (const entry of CONNECTION_CATALOG) {
    const list = map.get(entry.category) ?? [];
    list.push(entry);
    map.set(entry.category, list);
  }
  for (const [category, list] of map) {
    map.set(
      category,
      list.slice().sort((a, b) => a.priority - b.priority),
    );
  }
  return map;
}

/**
 * Business Connections — provider-agnostic connection model.
 *
 * Helps the Business Brain understand what information is available and what
 * additional signals would improve recommendations. Architecture + experience
 * only — most providers are catalog placeholders, not live integrations.
 *
 * See docs/project-magic/BUSINESS_CONNECTIONS.md.
 */

/** Business-purpose categories — not vendor names. */
export const ConnectionCategories = {
  CUSTOMER_FEEDBACK: "customer_feedback",
  WEBSITE_AND_SEARCH: "website_and_search",
  ADVERTISING: "advertising",
  SOCIAL_MEDIA: "social_media",
  COMMUNICATIONS: "communications",
  SCHEDULING_AND_COMMERCE: "scheduling_and_commerce",
  CRM_AND_SALES: "crm_and_sales",
  DOCUMENTS: "documents",
} as const;

export type ConnectionCategoryId =
  (typeof ConnectionCategories)[keyof typeof ConnectionCategories];

export const CONNECTION_CATEGORY_LABELS: Record<ConnectionCategoryId, string> = {
  customer_feedback: "Customer Feedback",
  website_and_search: "Website & Search",
  advertising: "Advertising",
  social_media: "Social Media",
  communications: "Communications",
  scheduling_and_commerce: "Scheduling & Commerce",
  crm_and_sales: "CRM & Sales",
  documents: "Documents",
};

/** Opaque provider ids — consumers should not branch on vendor for product logic. */
export const ConnectionProviderIds = {
  GOOGLE_BUSINESS_PROFILE: "google_business_profile",
  WEBSITE_ANALYSIS: "website_analysis",
  GOOGLE_SEARCH_CONSOLE: "google_search_console",
  GOOGLE_ANALYTICS: "google_analytics",
  META_ADS: "meta_ads",
  GOOGLE_ADS: "google_ads",
  FACEBOOK_PAGES: "facebook_pages",
  INSTAGRAM_BUSINESS: "instagram_business",
  LINKEDIN_PAGES: "linkedin_pages",
  CALL_TRACKING: "call_tracking",
  EMAIL_INBOX: "email_inbox",
  BOOKING_SYSTEM: "booking_system",
  CRM: "crm",
  SMART_UPLOADS: "smart_uploads",
  WEBSITE_TESTIMONIALS: "website_testimonials",
} as const;

export type ConnectionProviderId =
  (typeof ConnectionProviderIds)[keyof typeof ConnectionProviderIds];

export const ConnectionStatuses = {
  NOT_CONNECTED: "not_connected",
  CONNECTED: "connected",
  NEEDS_ATTENTION: "needs_attention",
  COMING_SOON: "coming_soon",
  UNAVAILABLE: "unavailable",
} as const;

export type ConnectionStatus = (typeof ConnectionStatuses)[keyof typeof ConnectionStatuses];

export const CONNECTION_STATUS_LABELS: Record<ConnectionStatus, string> = {
  not_connected: "Not connected",
  connected: "Connected",
  needs_attention: "Needs attention",
  coming_soon: "Coming soon",
  unavailable: "Unavailable",
};

export const ConnectionHealthLevels = {
  HEALTHY: "healthy",
  ATTENTION: "attention",
  UNKNOWN: "unknown",
  NOT_APPLICABLE: "not_applicable",
} as const;

export type ConnectionHealth =
  (typeof ConnectionHealthLevels)[keyof typeof ConnectionHealthLevels];

export const CONNECTION_HEALTH_LABELS: Record<ConnectionHealth, string> = {
  healthy: "Healthy",
  attention: "Needs attention",
  unknown: "Unknown",
  not_applicable: "Not applicable yet",
};

/** What a connection can contribute when live. */
export const ConnectionCapabilities = {
  REVIEWS: "reviews",
  LOCAL_POSTS: "local_posts",
  PROFILE_INSIGHTS: "profile_insights",
  WEBSITE_CONTENT: "website_content",
  SEARCH_PERFORMANCE: "search_performance",
  WEBSITE_ANALYTICS: "website_analytics",
  AD_PERFORMANCE: "ad_performance",
  SOCIAL_ENGAGEMENT: "social_engagement",
  CALL_SIGNALS: "call_signals",
  MESSAGE_SIGNALS: "message_signals",
  BOOKING_PATTERNS: "booking_patterns",
  PIPELINE_SIGNALS: "pipeline_signals",
  DOCUMENT_KNOWLEDGE: "document_knowledge",
} as const;

export type ConnectionCapabilityId =
  (typeof ConnectionCapabilities)[keyof typeof ConnectionCapabilities];

export const CAPABILITY_LABELS: Record<ConnectionCapabilityId, string> = {
  reviews: "Customer reviews",
  local_posts: "Local posts",
  profile_insights: "Local profile insights",
  website_content: "Website content understanding",
  search_performance: "Search performance",
  website_analytics: "Website analytics",
  ad_performance: "Ad performance",
  social_engagement: "Social engagement",
  call_signals: "Call signals",
  message_signals: "Message signals",
  booking_patterns: "Booking patterns",
  pipeline_signals: "Sales pipeline signals",
  document_knowledge: "Document knowledge",
};

/** How the connection strengthens Business Brain understanding. */
export type BusinessBrainContribution = {
  /** Short customer-safe summary of what we learn. */
  summary: string;
  /** Intelligence source keys this feeds (opaque). */
  intelligenceSources: string[];
};

export type ConnectionNextAction = {
  id: string;
  label: string;
  href: string | null;
  /** True when this action can start now (not a future placeholder). */
  availableNow: boolean;
};

/**
 * Static catalog definition — provider-agnostic seed data.
 * `implementation` separates live wiring from designed placeholders.
 */
export type ConnectionCatalogEntry = {
  id: string;
  category: ConnectionCategoryId;
  providerId: ConnectionProviderId;
  /** Customer-facing name — value-led, not vendor-first when possible. */
  displayName: string;
  /** "What will I learn if you connect this?" */
  whatYouLearn: string;
  capabilities: ConnectionCapabilityId[];
  businessBrainContribution: BusinessBrainContribution;
  /** Relative priority within category (1 = highest). */
  priority: number;
  implementation: "live" | "placeholder";
  /** Deep link when a live setup path exists. */
  connectHref: string | null;
  manageHref: string | null;
};

/** Runtime connection state for one catalog entry. */
export type BusinessConnection = ConnectionCatalogEntry & {
  status: ConnectionStatus;
  health: ConnectionHealth;
  lastSyncAt: string | null;
  availableCapabilities: ConnectionCapabilityId[];
  recommendedNextActions: ConnectionNextAction[];
};

export type BusinessBrainReadinessState = "available" | "unavailable" | "partial" | "coming_soon";

export type BusinessBrainReadinessItem = {
  id: string;
  label: string;
  state: BusinessBrainReadinessState;
  detail: string;
  relatedConnectionIds: string[];
};

export type NextConnectionRecommendation = {
  connectionId: string;
  displayName: string;
  why: string;
  whatYouLearn: string;
  href: string | null;
  category: ConnectionCategoryId;
};

export type BusinessConnectionsSnapshot = {
  generatedAt: string;
  connections: BusinessConnection[];
  byCategory: Array<{
    category: ConnectionCategoryId;
    label: string;
    connections: BusinessConnection[];
  }>;
  readiness: BusinessBrainReadinessItem[];
  recommendedNext: NextConnectionRecommendation | null;
  emptyState: "no_profile" | "nothing_connected" | null;
};

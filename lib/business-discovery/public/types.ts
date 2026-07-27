/**
 * Public (pre-auth) Business Discovery contract — the foundation for the
 * future Free Marketing Snapshot (docs/project-magic/FREE_MARKETING_SNAPSHOT.md).
 *
 * This is a deliberately narrower, versioned, and separately-typed contract
 * from the authenticated BusinessDiscoveryResult in
 * lib/business-discovery/types.ts. It is not a "public mode" flag threaded
 * through the authenticated pipeline — it is its own request/response shape,
 * its own source allowlist, and its own orchestration path
 * (lib/business-discovery/public/service.ts), so an accidental import of an
 * authenticated-only collector is a type error here, not a runtime leak.
 *
 * See docs/BUSINESS_DISCOVERY_PUBLIC_SNAPSHOT.md for the full architecture,
 * threat model, and privacy model.
 */

import type { DiscoveryInsight, DiscoverySourceType } from "@/lib/business-discovery/types";

export const PUBLIC_SNAPSHOT_CONTRACT_VERSION = "v1" as const;

/**
 * The only sources the public path may ever draw from. This is a strict
 * subset of DiscoverySourceType (enforced by the `satisfies` check below) —
 * anything requiring authentication (Google Business Profile, public reviews,
 * Market Context, future connectors, Smart Uploads) is absent by construction,
 * not filtered out after the fact.
 */
export const PublicDiscoverySourceTypes = {
  VISITOR_SUPPLIED: "business_profile",
  WEBSITE: "website",
  AI_WEBSITE_ANALYSIS: "ai_website_analysis",
  AI_MARKETING_PROFILE: "ai_marketing_profile",
} as const satisfies Record<string, DiscoverySourceType>;

export type PublicDiscoverySourceType =
  (typeof PublicDiscoverySourceTypes)[keyof typeof PublicDiscoverySourceTypes];

export const PUBLIC_DISCOVERY_SOURCE_ALLOWLIST: ReadonlySet<DiscoverySourceType> = new Set(
  Object.values(PublicDiscoverySourceTypes)
);

// ---------------------------------------------------------------------------
// Request contract
// ---------------------------------------------------------------------------

/** Field length caps — generous enough for real input, tight enough to bound request cost/storage. */
export const PUBLIC_SNAPSHOT_FIELD_LIMITS = {
  websiteUrl: 2048,
  businessName: 200,
  city: 100,
  stateOrRegion: 100,
  country: 100,
} as const;

/** Hard cap on the serialized request body, enforced before JSON parsing. */
export const PUBLIC_SNAPSHOT_MAX_REQUEST_BYTES = 8 * 1024; // 8 KB

export type PublicSnapshotRequestV1 = {
  contractVersion: typeof PUBLIC_SNAPSHOT_CONTRACT_VERSION;
  websiteUrl: string;
  businessName?: string;
  city?: string;
  stateOrRegion?: string;
  country?: string;
};

/** The exact, allowlisted key set accepted in a raw request body — anything else is rejected, not ignored silently. */
export const PUBLIC_SNAPSHOT_REQUEST_KEYS = [
  "contractVersion",
  "websiteUrl",
  "businessName",
  "city",
  "stateOrRegion",
  "country",
] as const;

// ---------------------------------------------------------------------------
// Response contract
// ---------------------------------------------------------------------------

export type PublicOnlinePresence = {
  website: DiscoveryInsight<{ connected: boolean; analyzed: boolean }>;
  googleBusinessProfile: DiscoveryInsight<{ connected: boolean }>;
  socialPresence: DiscoveryInsight<null>;
};

export type PublicMissingInformationItem = {
  field: string;
  reason: string;
  suggestedNextAction: string;
};

/** Overall Confidence Tier — label + explanation only. Never a raw score, per the existing confidenceLabels.ts convention. */
export type PublicOverallConfidence = {
  tier: string;
  label: string;
  explanation: string;
};

export type PublicBusinessDiscoveryResultV1 = {
  contractVersion: typeof PUBLIC_SNAPSHOT_CONTRACT_VERSION;
  generatedAt: string;
  /** Opaque, time-limited handoff token — never a raw database identifier. See public/cache.ts. */
  snapshotReference: string;
  /** The visitor-supplied, canonicalized website URL this snapshot describes — not sensitive, the visitor entered it themselves; needed so a later continuation/onboarding step doesn't have to re-ask for it. */
  websiteUrl: string;
  /** The visitor-supplied business name, if given — not AI-derived, so it carries no confidence tier of its own. */
  businessName: string | null;
  /** Visitor-supplied location hints, if given — same reasoning as businessName. */
  city: string | null;
  stateOrRegion: string | null;
  businessSummary: DiscoveryInsight<string>;
  primaryServices: DiscoveryInsight<string[]>;
  likelyTargetCustomers: DiscoveryInsight<string>;
  brandPersonality: DiscoveryInsight<string[]>;
  visibleStrengths: DiscoveryInsight<string[]>;
  onlinePresence: PublicOnlinePresence;
  possibleGrowthOpportunities: DiscoveryInsight<string[]>;
  missingOrUnclearInformation: PublicMissingInformationItem[];
  overallConfidence: PublicOverallConfidence;
};

// ---------------------------------------------------------------------------
// Structured error contract
// ---------------------------------------------------------------------------

export const PublicSnapshotErrorCodes = {
  VALIDATION_FAILED: "validation_failed",
  BLOCKED_URL: "blocked_url",
  RATE_LIMITED: "rate_limited",
  TIMEOUT: "timeout",
  UPSTREAM_UNAVAILABLE: "upstream_unavailable",
  INTERNAL_ERROR: "internal_error",
} as const;

export type PublicSnapshotErrorCode =
  (typeof PublicSnapshotErrorCodes)[keyof typeof PublicSnapshotErrorCodes];

export type PublicSnapshotErrorResponse = {
  error: {
    code: PublicSnapshotErrorCode;
    message: string;
  };
};

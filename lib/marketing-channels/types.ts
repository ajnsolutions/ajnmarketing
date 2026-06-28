/**
 * Shared marketing channel architecture.
 * Google Business is the first provider; future channels plug into the same patterns:
 * sync -> persistence -> dashboard/home stats -> optional AI actions.
 */
export type MarketingChannelProvider =
  | "google_business"
  | "facebook"
  | "instagram"
  | "linkedin"
  | "youtube";

export type ChannelSyncStatistics = {
  locationsSynced: number;
  reviewsSynced: number;
  postsSynced: number;
  insightsSynced: number;
};

export type ChannelSyncLogStatus = "running" | "success" | "partial" | "failed";

export type ChannelSyncResult = {
  success: boolean;
  provider: MarketingChannelProvider;
  statistics: ChannelSyncStatistics;
  error?: string;
};

export type ChannelConnectionState = {
  provider: MarketingChannelProvider;
  connected: boolean;
  setupRequired: boolean;
  setupMessage?: string;
  lastSyncedAt: string | null;
};

export type ChannelProviderDefinition = {
  provider: MarketingChannelProvider;
  displayName: string;
  oauthConfigured: boolean;
};

export const MARKETING_CHANNEL_PROVIDERS: ChannelProviderDefinition[] = [
  { provider: "google_business", displayName: "Google Business Profile", oauthConfigured: true },
  { provider: "facebook", displayName: "Facebook", oauthConfigured: false },
  { provider: "instagram", displayName: "Instagram", oauthConfigured: false },
  { provider: "linkedin", displayName: "LinkedIn", oauthConfigured: false },
  { provider: "youtube", displayName: "YouTube", oauthConfigured: false },
];

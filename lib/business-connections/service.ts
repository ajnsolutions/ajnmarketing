import "server-only";

/**
 * Load Business Connections snapshot for the signed-in user.
 * Reuses existing GBP + website analysis — does not invent new OAuth flows.
 */

import { getBusinessProfileForUser } from "@/lib/business-profile-server";
import { composeBusinessConnectionsSnapshot } from "@/lib/business-connections/compose";
import type { BusinessConnectionsSnapshot } from "@/lib/business-connections/types";
import type { LiveConnectionSignals } from "@/lib/business-connections/resolve";
import {
  getGoogleBusinessProfileConnectionStatusForCurrentUser,
  isGoogleConnectionStorageConfigured,
} from "@/lib/google-business-profile/service";
import { isGoogleBusinessOAuthConfigured } from "@/lib/google-business-profile/oauth";
import {
  getGoogleSearchConsoleConnectionStatusForCurrentUser,
  isSearchConsoleConnectionStorageConfigured,
} from "@/lib/google-search-console/service";
import { isGoogleSearchConsoleOAuthConfigured } from "@/lib/google-search-console/oauth";
import { createClient } from "@/lib/supabase/server";
import { getWebsiteAnalysisForUser } from "@/lib/website-analysis/persistence";
import { hasNoWebsiteConfirmed } from "@/lib/onboarding-storage";
import { listSmartUploadDocumentsForUser } from "@/lib/smart-uploads/persistence";
import { listTestimonialsForUser } from "@/lib/testimonials/persistence";

export async function getBusinessConnectionsSnapshotForCurrentUser(): Promise<BusinessConnectionsSnapshot | null> {
  const profile = await getBusinessProfileForUser();
  if (!profile) {
    return composeBusinessConnectionsSnapshot(
      {
        gbpConnected: false,
        gbpNeedsAttention: false,
        gbpLastSyncAt: null,
        hasWebsite: false,
        websiteAnalyzed: false,
        websiteAnalyzedAt: null,
        searchConsoleConnected: false,
        searchConsoleNeedsAttention: false,
        searchConsoleLastSyncAt: null,
        smartUploadsConnected: false,
        smartUploadsNeedsAttention: false,
        smartUploadsLastSyncAt: null,
        testimonialsConnected: false,
        testimonialsLastSyncAt: null,
      },
      { hasProfile: false },
    );
  }

  const supabase = await createClient();
  const [gbpStatus, websiteAnalysis, searchConsoleStatus, smartUploadDocuments, testimonials] = await Promise.all([
    getGoogleBusinessProfileConnectionStatusForCurrentUser().catch(() => null),
    getWebsiteAnalysisForUser(supabase, profile.user_id).catch(() => null),
    getGoogleSearchConsoleConnectionStatusForCurrentUser().catch(() => null),
    listSmartUploadDocumentsForUser(supabase, profile.user_id).catch(() => []),
    listTestimonialsForUser(supabase, profile.user_id, profile.id).catch(() => []),
  ]);

  const platformUnavailable =
    !isGoogleBusinessOAuthConfigured() || !isGoogleConnectionStorageConfigured();

  const connection = gbpStatus?.connection ?? null;
  const gbpConnected = Boolean(gbpStatus?.connected && gbpStatus.scopesValid);
  const gbpNeedsAttention = Boolean(
    connection &&
      !gbpConnected &&
      (connection.connection_status === "expired" ||
        connection.connection_status === "revoked" ||
        connection.connection_status === "error" ||
        (connection.connection_status === "connected" && gbpStatus && !gbpStatus.scopesValid)),
  );

  const hasWebsite =
    Boolean(profile.website?.trim()) && !hasNoWebsiteConfirmed(profile.voice_notes);

  const searchConsolePlatformUnavailable =
    !isGoogleSearchConsoleOAuthConfigured() || !isSearchConsoleConnectionStorageConfigured();

  const searchConsoleConnection = searchConsoleStatus?.connection ?? null;
  const searchConsoleConnected = Boolean(
    searchConsoleStatus?.connected && searchConsoleStatus.scopesValid && searchConsoleStatus.propertySelected,
  );
  const searchConsoleNeedsAttention = Boolean(
    searchConsoleConnection &&
      !searchConsoleConnected &&
      (searchConsoleConnection.connection_status === "expired" ||
        searchConsoleConnection.connection_status === "revoked" ||
        searchConsoleConnection.connection_status === "error" ||
        (searchConsoleConnection.connection_status === "connected" &&
          searchConsoleStatus &&
          (!searchConsoleStatus.scopesValid || !searchConsoleStatus.propertySelected))),
  );

  const smartUploadsConnected = smartUploadDocuments.some((doc) => doc.status === "extracted");
  const smartUploadsNeedsAttention =
    !smartUploadsConnected && smartUploadDocuments.some((doc) => doc.status === "processing" || doc.status === "failed");
  const smartUploadsLastSyncAt =
    smartUploadDocuments
      .filter((doc) => doc.processed_at)
      .map((doc) => doc.processed_at as string)
      .sort()
      .at(-1) ?? null;

  const testimonialsConnected = testimonials.length > 0;
  const testimonialsLastSyncAt =
    testimonials
      .map((t) => t.updated_at)
      .sort()
      .at(-1) ?? null;

  const signals: LiveConnectionSignals = {
    gbpConnected,
    gbpNeedsAttention,
    gbpLastSyncAt: connection?.last_synced_at ?? null,
    hasWebsite,
    websiteAnalyzed: Boolean(websiteAnalysis),
    websiteAnalyzedAt: websiteAnalysis?.updated_at ?? websiteAnalysis?.created_at ?? null,
    gbpPlatformUnavailable: platformUnavailable && !gbpConnected && !gbpNeedsAttention,
    searchConsoleConnected,
    searchConsoleNeedsAttention,
    searchConsoleLastSyncAt: searchConsoleConnection?.last_synced_at ?? null,
    searchConsolePlatformUnavailable:
      searchConsolePlatformUnavailable && !searchConsoleConnected && !searchConsoleNeedsAttention,
    smartUploadsConnected,
    smartUploadsNeedsAttention,
    smartUploadsLastSyncAt,
    testimonialsConnected,
    testimonialsLastSyncAt,
  };

  return composeBusinessConnectionsSnapshot(signals, { hasProfile: true });
}

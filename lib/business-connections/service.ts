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
import { createClient } from "@/lib/supabase/server";
import { getWebsiteAnalysisForUser } from "@/lib/website-analysis/persistence";
import { hasNoWebsiteConfirmed } from "@/lib/onboarding-storage";

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
      },
      { hasProfile: false },
    );
  }

  const supabase = await createClient();
  const [gbpStatus, websiteAnalysis] = await Promise.all([
    getGoogleBusinessProfileConnectionStatusForCurrentUser().catch(() => null),
    getWebsiteAnalysisForUser(supabase, profile.user_id).catch(() => null),
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

  const signals: LiveConnectionSignals = {
    gbpConnected,
    gbpNeedsAttention,
    gbpLastSyncAt: connection?.last_synced_at ?? null,
    hasWebsite,
    websiteAnalyzed: Boolean(websiteAnalysis),
    websiteAnalyzedAt: websiteAnalysis?.updated_at ?? websiteAnalysis?.created_at ?? null,
    gbpPlatformUnavailable: platformUnavailable && !gbpConnected && !gbpNeedsAttention,
  };

  return composeBusinessConnectionsSnapshot(signals, { hasProfile: true });
}

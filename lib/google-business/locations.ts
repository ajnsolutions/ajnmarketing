import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  GOOGLE_ACCOUNT_MANAGEMENT_BASE,
  GOOGLE_BUSINESS_INFORMATION_BASE,
  googleApiFetch,
} from "@/lib/google-business/google-api";
import type { GoogleApiAccount, GoogleApiLocation } from "@/lib/google-business/types";
import { upsertGoogleBusinessLocation } from "@/lib/google-business/persistence";

const LOCATION_READ_MASK = [
  "name",
  "title",
  "phoneNumbers",
  "websiteUri",
  "storefrontAddress",
  "categories",
  "metadata",
].join(",");

export async function syncGoogleBusinessLocations(
  supabase: SupabaseClient,
  input: {
    userId: string;
    businessProfileId: string;
    connectionId: string;
    accessToken: string;
  }
): Promise<{ locationsSynced: number; primaryLocation: Awaited<ReturnType<typeof upsertGoogleBusinessLocation>> }> {
  const accountsResponse = await googleApiFetch<{ accounts?: GoogleApiAccount[] }>(
    `${GOOGLE_ACCOUNT_MANAGEMENT_BASE}/accounts`,
    input.accessToken
  );

  const accounts = accountsResponse.accounts ?? [];
  if (accounts.length === 0) {
    throw new Error("No Google Business accounts found for this connection.");
  }

  let locationsSynced = 0;
  let primaryLocation: Awaited<ReturnType<typeof upsertGoogleBusinessLocation>> = null;

  for (const [accountIndex, account] of accounts.entries()) {
    const accountName = account.name;
    if (!accountName) continue;

    const locationsResponse = await googleApiFetch<{ locations?: GoogleApiLocation[] }>(
      `${GOOGLE_BUSINESS_INFORMATION_BASE}/${accountName}/locations?readMask=${encodeURIComponent(LOCATION_READ_MASK)}&pageSize=100`,
      input.accessToken
    );

    const locations = locationsResponse.locations ?? [];

    for (const [locationIndex, location] of locations.entries()) {
      if (!location.name) continue;

      const saved = await upsertGoogleBusinessLocation(supabase, {
        userId: input.userId,
        businessProfileId: input.businessProfileId,
        connectionId: input.connectionId,
        googleLocationId: location.name,
        googleAccountId: accountName,
        locationTitle: location.title ?? null,
        primaryCategory: location.categories?.primaryCategory?.displayName ?? null,
        phone: location.phoneNumbers?.primaryPhone ?? null,
        websiteUri: location.websiteUri ?? null,
        addressJson: (location.storefrontAddress as Record<string, unknown>) ?? {},
        profileMetadata: (location.metadata as Record<string, unknown>) ?? {},
        averageRating: null,
        reviewCount: 0,
        verificationStatus:
          typeof location.metadata?.hasGoogleUpdated === "boolean"
            ? location.metadata.hasGoogleUpdated
              ? "Google updated"
              : "Verified"
            : null,
        isPrimary: accountIndex === 0 && locationIndex === 0,
      });

      if (saved) {
        locationsSynced += 1;
        if (saved.is_primary || !primaryLocation) {
          primaryLocation = saved;
        }
      }
    }
  }

  return { locationsSynced, primaryLocation };
}
